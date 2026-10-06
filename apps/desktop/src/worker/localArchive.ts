import { open, readdir, readFile, stat, type FileHandle } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { ArchiveFormat, FolderNode, MessageRef, OpenProgress, SpecialFolder, StoreInfo } from '../shared/types'
import { foldForIndex, squash } from '../shared/text'
import { collectSenders, yieldToEventLoop, type Archive, type ContentIndexOptions, type IndexedItem } from './archive'
import { classifyAttachment } from './attachmentTypes'
import { followPath, NotFoundError, resolveMime, resolveMsg, type ResolvedMessage } from './details'
import { collectFolderIds, computeTotals, detectSpecialFolder, sortFolders } from './folders'
import { headerMeta, readHeaders, type HeaderMeta, type Mailbox } from './headers'
import { referencedContentIds } from './html'
import { looksLikeMbox, readMboxMessage, scanMbox } from './mbox'
import { looksLikeMsg, msgDate, msgRecipients, msgSender, readMsg } from './msg'
import { kindOf } from './pstFields'
import { PstError } from './indexer'

/**
 * Mail archives made of plain files: a single EML or MSG file, an MBOX file
 * (Thunderbird, Apple Mail, Google Takeout) or a folder containing any of
 * these. Folders mirror the directory structure; Google Takeout labels
 * become folders.
 */

type Source = { type: 'eml'; path: string } | { type: 'msg'; path: string } | { type: 'mbox'; path: string; start: number; end: number }

export type LocalFormat = 'eml' | 'msg' | 'mbox'

const PREVIEW_LENGTH = 240
const MAX_BODY_INDEX_LENGTH = 512 * 1024
const HEADER_READ_LIMIT = 64 * 1024
const MAX_SCAN_DEPTH = 12
const MAX_FILES = 250_000
const YIELD_INTERVAL_MS = 30

/** Detects the format of a file from its first bytes and extension. */
export async function detectLocalFormat(path: string): Promise<LocalFormat | null> {
  const handle = await open(path, 'r')
  try {
    const start = Buffer.alloc(512)
    const { bytesRead } = await handle.read(start, 0, 512, 0)
    const head = start.subarray(0, bytesRead)
    if (looksLikeMsg(head)) return 'msg'
    if (looksLikeMbox(head)) return 'mbox'
    const ext = extname(path).toLowerCase()
    if (ext === '.mbox' || ext === '.mbx') return 'mbox'
    if (ext === '.eml' || ext === '.emlx' || ext === '.mht' || looksLikeEml(head)) return 'eml'
    return null
  } finally {
    await handle.close()
  }
}

function looksLikeEml(head: Buffer): boolean {
  const text = head.toString('latin1')
  return /^(?:[!-9;-~]+:[^\r\n]*\r?\n(?:[ \t][^\r\n]*\r?\n)*){2,}/.test(text) && /^(from|date|subject|message-id|received|return-path|mime-version):/im.test(text)
}

interface OpenOptions {
  onProgress?: (progress: OpenProgress) => void
  isCanceled?: () => boolean
}

export class LocalArchive implements Archive {
  readonly items: IndexedItem[] = []
  readonly itemById = new Map<number, IndexedItem>()
  readonly folderById = new Map<number, FolderNode>()
  readonly subtreeIds = new Map<number, Set<number>>()
  folders: FolderNode[] = []
  senders: ReturnType<typeof collectSenders> = []
  store!: StoreInfo
  contentIndexed = false

  private readonly sources = new Map<number, Source>()
  private nextFolderId = 1
  private nextItemId = 1
  private skipped = 0
  private totalBytes = 0

  private constructor(private readonly rootPath: string) {}

  static async open(path: string, options: OpenOptions = {}): Promise<LocalArchive> {
    const started = Date.now()
    const archive = new LocalArchive(path)
    let info
    try {
      info = await stat(path)
    } catch {
      throw new PstError('NOT_FOUND', `File not found: ${path}`)
    }
    options.onProgress?.({ phase: 'opening', done: 0, total: 0 })

    let format: ArchiveFormat
    if (info.isDirectory()) {
      const appleMbox = await appleMailMbox(path)
      if (appleMbox) {
        format = 'mbox'
        await archive.addMbox(appleMbox, displayName(path), null, options)
      } else {
        format = 'folder'
        await archive.addDirectory(path, null, 0, options)
      }
    } else {
      const detected = await detectLocalFormat(path)
      if (!detected) throw new PstError('NOT_PST', `Unsupported file: ${path}`)
      format = detected
      if (detected === 'mbox') await archive.addMbox(path, displayName(path), null, options)
      else {
        const folder = archive.createFolder(displayName(path), null)
        await archive.addFile(path, detected, folder)
      }
    }
    if (archive.items.length === 0) throw new PstError('NOT_PST', `No messages found in ${path}`)
    archive.finish(format, started)
    return archive
  }

  close(): void {
    // Files are opened per request; nothing to release.
  }

  async resolve(ref: MessageRef): Promise<ResolvedMessage> {
    const source = this.sources.get(ref.id)
    if (!source) throw new NotFoundError(`Item ${ref.id} not found`)
    return followPath(await loadSource(source), ref.path ?? [])
  }

  // ---------------------------------------------------------------------------
  // Discovery

  private createFolder(name: string, parent: FolderNode | null, special: SpecialFolder | null = null): FolderNode {
    const node: FolderNode = {
      id: this.nextFolderId++,
      name,
      special: special ?? detectSpecialFolder(name, '', 0),
      containerClass: 'IPF.Note',
      itemCount: 0,
      unreadCount: 0,
      totalCount: 0,
      children: []
    }
    this.folderById.set(node.id, node)
    if (parent) parent.children.push(node)
    else this.folders.push(node)
    return node
  }

  /**
   * Adds a directory as a folder. Apple Mail keeps a mailbox as "Name.mbox"
   * directory with the messages in structural sub directories
   * (".../Data/0/1/Messages/1234.emlx"); those are collected into the mailbox
   * folder (`target`) instead of becoming folders of their own.
   */
  private async addDirectory(dir: string, parent: FolderNode | null, depth: number, options: OpenOptions, target: FolderNode | null = null): Promise<void> {
    if (depth > MAX_SCAN_DEPTH || this.sources.size >= MAX_FILES) return
    const folder = target ?? this.createFolder(displayName(dir), parent)
    const mailbox = target ?? (/\.mbox$/i.test(dir) ? folder : null)
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.name.startsWith('.') || this.sources.size >= MAX_FILES) continue
      const path = join(dir, entry.name)
      if (options.isCanceled?.()) throw new PstError('CANCELED', 'Canceled')
      if (entry.isDirectory()) {
        const appleMbox = await appleMailMbox(path)
        if (appleMbox) await this.addMbox(appleMbox, displayName(path), folder, options)
        else if (mailbox && !/\.mbox$/i.test(entry.name)) await this.addDirectory(path, folder, depth + 1, options, mailbox)
        else await this.addDirectory(path, folder, depth + 1, options)
        continue
      }
      if (!entry.isFile()) continue
      // Outlook data files are archives of their own and are opened separately.
      if (/\.(pst|ost)$/i.test(entry.name)) continue
      const format = await detectLocalFormat(path).catch(() => null)
      if (format === 'mbox') await this.addMbox(path, displayName(path), folder, options)
      else if (format === 'eml' || format === 'msg') {
        await this.addFile(path, format, folder)
        options.onProgress?.({ phase: 'scanning', done: this.items.length, total: 0, folderName: folder.name })
      }
    }
  }

  private async addFile(path: string, format: 'eml' | 'msg', folder: FolderNode): Promise<void> {
    try {
      const size = (await stat(path)).size
      this.totalBytes += size
      if (format === 'eml') {
        const handle = await open(path, 'r')
        try {
          const head = await readStart(handle, 0, Math.min(size, HEADER_READ_LIMIT))
          const emlx = emlxBounds(head)
          const meta = headerMeta(readHeaders(emlx ? head.subarray(emlx.start) : head))
          if (emlx) {
            const plistStart = emlx.start + emlx.length
            applyEmlxFlags(meta, await readStart(handle, plistStart, Math.min(Math.max(0, size - plistStart), HEADER_READ_LIMIT)))
          }
          this.addItem({ type: 'eml', path }, itemFromHeaders(meta, emlx ? emlx.length : size), folder)
        } finally {
          await handle.close()
        }
      } else {
        const { data } = readMsg(await readFile(path))
        const from = msgSender(data)
        const recipients = msgRecipients(data)
        const messageClass = data.messageClass || 'IPM.Note'
        const toLine = squash(recipients.filter((r) => r.type === 'to').map((r) => r.name || r.email).join('; '))
        this.addItem(
          { type: 'msg', path },
          baseItem({
            kind: kindOf(messageClass),
            messageClass,
            subject: data.subject ?? '',
            fromName: from.name,
            fromEmail: from.email,
            toLine,
            date: msgDate(data),
            size,
            hasAttachments: (data.attachments ?? []).some((a) => !a.attachmentHidden),
            isRead: data.messageFlags === undefined ? true : (data.messageFlags & 0x01) !== 0,
            flagged: false,
            importance: 1,
            recipientsText: recipients.map((r) => `${r.name} ${r.email}`).join(' ')
          }),
          folder
        )
      }
    } catch {
      this.skipped++
    }
  }

  private async addMbox(path: string, name: string, parent: FolderNode | null, options: OpenOptions): Promise<void> {
    const scan = await scanMbox(path, (done, total) => options.onProgress?.({ phase: 'scanning', done, total, folderName: name }), options.isCanceled)
    if (options.isCanceled?.()) throw new PstError('CANCELED', 'Canceled')
    this.totalBytes += scan.size
    const fallback = this.createFolder(name, parent)
    const labelFolders = new Map<string, FolderNode>()
    const handle = await open(path, 'r')
    let lastYield = Date.now()
    try {
      for (let i = 0; i < scan.offsets.length; i++) {
        const start = scan.offsets[i]
        const end = i + 1 < scan.offsets.length ? scan.offsets[i + 1] : scan.size
        try {
          const raw = await readStart(handle, start, Math.min(end - start, HEADER_READ_LIMIT))
          // Skip the "From " envelope line.
          const lineEnd = raw.indexOf(0x0a)
          const meta = headerMeta(readHeaders(lineEnd >= 0 ? raw.subarray(lineEnd + 1) : raw))
          const labels = applyGmailLabels(meta)
          const item = itemFromHeaders(meta, end - start)
          const folders = labels.map((label) => this.labelFolder(label, fallback, labelFolders))
          this.addItem({ type: 'mbox', path, start, end }, item, folders[0] ?? fallback, folders.slice(1))
        } catch {
          this.skipped++
        }
        if (Date.now() - lastYield > YIELD_INTERVAL_MS) {
          options.onProgress?.({ phase: 'indexing', done: i, total: scan.offsets.length, folderName: name })
          await yieldToEventLoop()
          lastYield = Date.now()
          if (options.isCanceled?.()) throw new PstError('CANCELED', 'Canceled')
        }
      }
    } finally {
      await handle.close()
    }
    // With labels the file folder only keeps messages without any label; empty folders are pruned later.
  }

  /** Folder for a Gmail label; "A/B" labels become nested folders. */
  private labelFolder(label: string, fallback: FolderNode, cache: Map<string, FolderNode>): FolderNode {
    const cached = cache.get(label)
    if (cached) return cached
    const parts = label.split('/').filter(Boolean)
    let parent: FolderNode | null = this.folders.includes(fallback) ? null : findParent(this.folders, fallback)
    let node: FolderNode | null = null
    let path = ''
    for (const part of parts) {
      path = path ? `${path}/${part}` : part
      node = cache.get(path) ?? null
      if (!node) {
        node = this.createFolder(part, parent)
        cache.set(path, node)
      }
      parent = node
    }
    return node ?? fallback
  }

  private addItem(source: Source, item: IndexedItem, folder: FolderNode, extra: FolderNode[] = []): void {
    item.id = this.nextItemId++
    item.folderId = folder.id
    const extraIds = extra.filter((f) => f.id !== folder.id).map((f) => f.id)
    if (extraIds.length > 0) item.extraFolderIds = extraIds
    this.items.push(item)
    this.itemById.set(item.id, item)
    this.sources.set(item.id, source)
    for (const f of [folder, ...extra.filter((e) => e.id !== folder.id)]) {
      f.itemCount++
      if (!item.isRead) f.unreadCount++
    }
  }

  private finish(format: ArchiveFormat, started: number): void {
    pruneEmpty(this.folders, this.folderById)
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
    for (const f of this.folders) computeTotals(f)
    sortFolders(this.folders, collator)
    for (const node of this.folderById.values()) this.subtreeIds.set(node.id, collectFolderIds(node))
    this.senders = collectSenders(this.items)

    let min = Infinity
    let max = -Infinity
    for (const item of this.items) {
      if (item.date > 0) {
        if (item.date < min) min = item.date
        if (item.date > max) max = item.date
      }
    }
    this.store = {
      filePath: this.rootPath,
      fileName: basename(this.rootPath),
      fileSize: this.totalBytes,
      displayName: displayName(this.rootPath),
      format,
      itemCount: this.items.length,
      folderCount: this.folderById.size,
      dateRange: Number.isFinite(min) ? { min, max } : null,
      indexMs: Date.now() - started,
      skippedItems: this.skipped
    }
  }

  // ---------------------------------------------------------------------------
  // Content indexing

  async indexContent(options: ContentIndexOptions = {}): Promise<void> {
    const pending = this.items.filter((item) => !item.indexed)
    const priority = options.priorityFolderId ?? null
    if (priority !== null) {
      const first = this.subtreeIds.get(priority) ?? new Set([priority])
      pending.sort((a, b) => Number(first.has(b.folderId)) - Number(first.has(a.folderId)))
    }
    const total = pending.length
    let done = 0
    let lastYield = Date.now()
    let lastReport = 0
    options.onProgress?.(0, total)
    for (const item of pending) {
      if (options.isCanceled?.()) return
      try {
        const source = this.sources.get(item.id)
        if (source) applyContent(item, await loadSource(source))
      } catch {
        // keep the list data
      }
      item.indexed = true
      done++
      const now = Date.now()
      if (now - lastReport > 250) {
        lastReport = now
        options.onProgress?.(done, total)
      }
      if (now - lastYield > YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
      }
    }
    this.contentIndexed = true
    this.senders = collectSenders(this.items)
    options.onProgress?.(total, total)
  }
}

// -----------------------------------------------------------------------------
// Helpers

async function loadSource(source: Source): Promise<ResolvedMessage> {
  if (source.type === 'msg') return resolveMsg(await readFile(source.path))
  if (source.type === 'mbox') return resolveMime(await readMboxMessage(source.path, source.start, source.end))
  const data = await readFile(source.path)
  const emlx = emlxBounds(data)
  return resolveMime(emlx ? data.subarray(emlx.start, emlx.start + emlx.length) : data)
}

/**
 * Apple Mail .emlx files: a line with the message length, the message and a
 * property list with flags. Returns where the message is, or null for plain
 * .eml files (which never start with a number-only line).
 */
export function emlxBounds(data: Buffer): { start: number; length: number } | null {
  const m = /^(\d{1,12})[ \t]*\r?\n/.exec(data.subarray(0, 24).toString('latin1'))
  if (!m) return null
  return { start: m[0].length, length: Number(m[1]) }
}

/** Read and flag state from the property list of an .emlx file. */
function applyEmlxFlags(meta: HeaderMeta, plist: Buffer): void {
  const m = /<key>flags<\/key>\s*<integer>(\d+)<\/integer>/.exec(plist.toString('utf8'))
  if (!m) return
  const flags = Number(m[1])
  meta.isRead = (flags & 0x01) !== 0
  meta.flagged = (flags & 0x10) !== 0
}

async function readStart(handle: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(Math.max(0, length))
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
  return buffer.subarray(0, bytesRead)
}

/** Apple Mail exports mailboxes as "Name.mbox" folders with an "mbox" file inside. */
async function appleMailMbox(dir: string): Promise<string | null> {
  const candidate = join(dir, 'mbox')
  try {
    const info = await stat(candidate)
    return info.isFile() ? candidate : null
  } catch {
    return null
  }
}

function displayName(path: string): string {
  return basename(path).replace(/\.(eml|emlx|msg|mbox|mbx)$/i, '')
}

function findParent(nodes: FolderNode[], child: FolderNode): FolderNode | null {
  for (const node of nodes) {
    if (node.children.includes(child)) return node
    const found = findParent(node.children, child)
    if (found) return found
  }
  return null
}

function pruneEmpty(nodes: FolderNode[], byId: Map<number, FolderNode>): void {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    pruneEmpty(node.children, byId)
    if (node.itemCount === 0 && node.children.length === 0) {
      nodes.splice(i, 1)
      byId.delete(node.id)
    }
  }
}

const READ_LABELS = /^(opened|geöffnet|geoeffnet|read|gelesen)$/i
const UNREAD_LABELS = /^(unread|ungelesen)$/i
const STARRED_LABELS = /^(starred|markiert|mit stern)$/i

/** Turns Gmail system labels into flags and returns the folder labels. */
function applyGmailLabels(meta: HeaderMeta): string[] {
  const folders: string[] = []
  for (const label of meta.labels) {
    if (READ_LABELS.test(label)) meta.isRead = true
    else if (UNREAD_LABELS.test(label)) meta.isRead = false
    else if (STARRED_LABELS.test(label)) meta.flagged = true
    else folders.push(label)
  }
  if (meta.labels.length > 0 && !meta.labels.some((l) => UNREAD_LABELS.test(l)) && meta.labels.some((l) => READ_LABELS.test(l))) meta.isRead = true
  // Well-known folders first, so that they become the primary folder.
  const rank = (label: string): number => {
    const special = detectSpecialFolder(label, '', 0)
    return special === 'inbox' ? 0 : special === 'sent' ? 1 : special === 'drafts' ? 2 : special ? 3 : 4
  }
  return folders.sort((a, b) => rank(a) - rank(b))
}

interface BaseFields {
  kind: IndexedItem['kind']
  messageClass: string
  subject: string
  fromName: string
  fromEmail: string
  toLine: string
  date: number
  size: number
  hasAttachments: boolean
  isRead: boolean
  flagged: boolean
  importance: 0 | 1 | 2
  recipientsText: string
}

function baseItem(f: BaseFields): IndexedItem {
  return {
    id: 0,
    folderId: 0,
    kind: f.kind,
    messageClass: f.messageClass,
    subject: f.subject,
    fromName: f.fromName,
    fromEmail: f.fromEmail,
    toLine: f.toLine,
    date: f.date,
    size: f.size,
    attachmentCount: f.hasAttachments ? 1 : 0,
    isRead: f.isRead,
    importance: f.importance,
    flagged: f.flagged,
    security: /^IPM\.Note\.SMIME/i.test(f.messageClass) ? 'signed' : null,
    preview: '',
    attachmentKinds: 0,
    indexed: false,
    sSubject: foldForIndex(f.subject),
    sFrom: foldForIndex(`${f.fromName} ${f.fromEmail}`),
    sTo: foldForIndex(`${f.toLine} ${f.recipientsText}`),
    sBody: '',
    sAttach: ''
  }
}

function mailboxText(list: Mailbox[]): string {
  return list.map((m) => `${m.name} ${m.email}`).join(' ')
}

function itemFromHeaders(meta: HeaderMeta, size: number): IndexedItem {
  return baseItem({
    kind: 'mail',
    messageClass: 'IPM.Note',
    subject: meta.subject,
    fromName: meta.from.name || meta.from.email,
    fromEmail: meta.from.email,
    toLine: squash(meta.to.map((m) => m.name || m.email).join('; ')),
    date: meta.date,
    size,
    hasAttachments: meta.hasAttachments,
    isRead: meta.isRead,
    flagged: meta.flagged,
    importance: meta.importance,
    recipientsText: `${mailboxText(meta.to)} ${mailboxText(meta.cc)} ${mailboxText(meta.bcc)}`
  })
}

/** Adds body, attachments and decoded addresses of a loaded message to its index entry. */
function applyContent(item: IndexedItem, message: ResolvedMessage): void {
  const content = message.content
  const cids = referencedContentIds(content.html)
  let attachmentCount = 0
  let attachmentKinds = 0
  const names: string[] = []
  for (const att of content.attachments) {
    if (att.hidden || (att.contentId !== '' && cids.has(att.contentId))) continue
    attachmentCount++
    attachmentKinds |= classifyAttachment(att.name, att.mimeType, att.isMessage)
    names.push(att.name)
  }
  const text = content.text.length > MAX_BODY_INDEX_LENGTH ? content.text.slice(0, MAX_BODY_INDEX_LENGTH) : content.text
  item.attachmentCount = attachmentCount
  item.attachmentKinds = attachmentKinds
  item.security = content.security
  item.preview = squash(text.slice(0, PREVIEW_LENGTH * 2)).slice(0, PREVIEW_LENGTH)
  item.sBody = foldForIndex(text)
  item.sAttach = foldForIndex(names.join(' '))
  if (message.kind === 'mime') {
    // The full parse decodes names more reliably than the quick header scan.
    const from = message.email.from && !message.email.from.group ? message.email.from : undefined
    if (from?.address) {
      item.fromEmail = from.address
      item.fromName = squash(from.name || from.address)
      item.sFrom = foldForIndex(`${item.fromName} ${item.fromEmail}`)
    }
    if (message.email.subject !== undefined && !item.subject) {
      item.subject = message.email.subject
      item.sSubject = foldForIndex(item.subject)
    }
  }
}
