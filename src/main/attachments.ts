import { app, protocol, shell, type BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, createReadStream, readdirSync, rmSync } from 'node:fs'
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { fileExtension, isUnsafeToOpen } from '../shared/files'
import type { AttachmentFileInfo, AttachmentPreview, PreviewKind } from '../shared/types'

/**
 * Attachments are viewed and opened from read-only temporary copies. They are
 * served to the renderer through a private protocol and removed when the app
 * quits (and, as a fallback, on the next start).
 */
export const PREVIEW_SCHEME = 'pst-preview'

interface TempCopy {
  token: string
  path: string
  info: AttachmentFileInfo
}

const root = (): string => join(app.getPath('temp'), 'pst-viewer-attachments')
const copiesByKey = new Map<string, TempCopy>()
const copiesByToken = new Map<string, TempCopy>()

/** Must run before the app is ready. */
export function registerPreviewScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PREVIEW_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
  ])
}

export async function initAttachmentCopies(): Promise<void> {
  await removeTree(root())
  protocol.handle(PREVIEW_SCHEME, serve)
}

/** Forgets the copies of the previous file (the files stay until quit). */
export function resetAttachmentCopies(): void {
  copiesByKey.clear()
  copiesByToken.clear()
}

/** Deletes all copies; synchronous so it can run while the app quits. */
export function removeAttachmentCopiesSync(): void {
  resetAttachmentCopies()
  const dir = root()
  try {
    if (process.platform === 'win32') {
      for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
        try {
          chmodSync(join(dir, entry), 0o666)
        } catch {
          // ignore
        }
      }
    }
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // best effort, stale copies are removed on the next start
  }
}

/**
 * Returns a read-only temporary copy of an attachment, creating it with
 * `write` on first use.
 */
export async function attachmentCopy(key: string, info: AttachmentFileInfo, write: (targetPath: string) => Promise<void>): Promise<TempCopy> {
  const existing = copiesByKey.get(key)
  if (existing && (await exists(existing.path))) return existing
  const token = randomUUID()
  const dir = join(root(), token)
  await mkdir(dir, { recursive: true })
  const path = join(dir, info.fileName)
  await write(path)
  // Before making the file read-only: extended attributes need write access.
  if (process.platform === 'darwin') await quarantine(path)
  // Read-only, so that apps opening the copy do not suggest editing it in place.
  await chmod(path, 0o444).catch(() => undefined)
  const copy: TempCopy = { token, path, info }
  copiesByKey.set(key, copy)
  copiesByToken.set(token, copy)
  return copy
}

export function previewOf(copy: TempCopy): AttachmentPreview {
  const kind = previewKind(copy.info)
  return {
    url: `${PREVIEW_SCHEME}://file/${copy.token}/${encodeURIComponent(copy.info.fileName)}`,
    fileName: copy.info.fileName,
    mimeType: copy.info.mimeType,
    size: copy.info.size,
    kind,
    canOpen: !isUnsafeToOpen(copy.info.fileName, copy.info.mimeType)
  }
}

/** Opens a copy with the default app of the operating system. */
export async function openCopy(copy: TempCopy): Promise<void> {
  if (isUnsafeToOpen(copy.info.fileName, copy.info.mimeType)) throw new Error('BLOCKED')
  const error = await shell.openPath(copy.path)
  if (error) throw new Error(error)
}

/** Shows the macOS Quick Look panel for a copy. */
export function quickLook(window: BrowserWindow, copy: TempCopy): void {
  window.previewFile(copy.path, copy.info.fileName)
}

// -----------------------------------------------------------------------------

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon'
}
const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac'
}
const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg'
}
const TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'log', 'md', 'markdown', 'json', 'xml', 'ini', 'cfg', 'conf', 'yaml', 'yml', 'sql', 'css',
  'js', 'ts', 'py', 'java', 'c', 'h', 'cpp', 'cs', 'sh', 'bat', 'ps1', 'eml', 'diff', 'patch', 'properties', 'toml', 'srt', 'vtt'
])

export function previewKind(info: AttachmentFileInfo): PreviewKind {
  const ext = fileExtension(info.fileName)
  const mime = info.mimeType.toLowerCase()
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (IMAGE_TYPES[ext] || /^image\/(png|jpe?g|gif|webp|bmp|avif|x-icon)$/.test(mime)) return 'image'
  if (ext === 'svg' || mime === 'image/svg+xml') return 'image'
  if (ext === 'csv' || ext === 'tsv' || mime === 'text/csv') return 'csv'
  if (ext === 'ics' || ext === 'vcs' || mime === 'text/calendar' || mime === 'application/ics') return 'calendar'
  if (ext === 'vcf' || mime === 'text/vcard' || mime === 'text/x-vcard') return 'contact'
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || mime === 'text/html') return 'html'
  if (AUDIO_TYPES[ext]) return 'audio'
  if (VIDEO_TYPES[ext]) return 'video'
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime === 'application/json') return 'text'
  return 'none'
}

/** Content type for serving: only media is served with its real type. */
function servedType(info: AttachmentFileInfo): string {
  const ext = fileExtension(info.fileName)
  switch (previewKind(info)) {
    case 'pdf':
      return 'application/pdf'
    case 'image':
      return ext === 'svg' ? 'image/svg+xml' : (IMAGE_TYPES[ext] ?? info.mimeType)
    case 'audio':
      return AUDIO_TYPES[ext] ?? info.mimeType
    case 'video':
      return VIDEO_TYPES[ext] ?? info.mimeType
    default:
      // Text, HTML and everything else is only ever read as bytes by the renderer.
      return 'application/octet-stream'
  }
}

async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const token = url.pathname.split('/')[1] ?? ''
  const copy = url.host === 'file' ? copiesByToken.get(token) : undefined
  if (!copy) return new Response('Not found', { status: 404 })
  let size: number
  try {
    size = (await stat(copy.path)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const headers: Record<string, string> = {
    // Only reachable from inside the app; copies are addressed by unguessable tokens.
    'Access-Control-Allow-Origin': '*',
    'Content-Type': servedType(copy.info),
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store'
  }
  // Everything except PDFs (rendered by Chromium's viewer) must never run as a document.
  if (previewKind(copy.info) !== 'pdf') headers['Content-Security-Policy'] = "default-src 'none'; sandbox"

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (range && size > 0) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const body = Readable.toWeb(createReadStream(copy.path, { start, end })) as ReadableStream
    return new Response(body, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
    })
  }
  const body = Readable.toWeb(createReadStream(copy.path)) as ReadableStream
  return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
}

/** Marks a file as downloaded so that Gatekeeper and other apps treat it with care. */
function quarantine(path: string): Promise<void> {
  const value = `0081;${Math.floor(Date.now() / 1000).toString(16)};PST Viewer;`
  return new Promise((resolve) => execFile('/usr/bin/xattr', ['-w', 'com.apple.quarantine', value, path], () => resolve()))
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function removeTree(dir: string): Promise<void> {
  // Read-only files cannot be deleted on Windows; make them writable first.
  if (process.platform === 'win32') {
    const entries = await readdir(dir, { recursive: true }).catch(() => [] as string[])
    await Promise.all(entries.map((e) => chmod(join(dir, e), 0o666).catch(() => undefined)))
  }
  await rm(dir, { recursive: true, force: true }).catch(() => undefined)
}
