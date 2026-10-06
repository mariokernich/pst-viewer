import { app, BrowserWindow, session, type Session } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Renders export documents (built by the renderer from a sanitised message)
 * in a hidden, locked down window: no JavaScript, no network unless remote
 * images were allowed for the message, separate in-memory session.
 */
const PARTITION = 'pst-viewer-export'

let current: { documentUrl: string; allowRemote: boolean } | null = null
let queue: Promise<unknown> = Promise.resolve()
let configured: Session | null = null

function exportSession(): Session {
  if (configured) return configured
  const ses = session.fromPartition(PARTITION)
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.on('will-download', (event) => event.preventDefault())
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (!current) return callback({ cancel: true })
    if (details.url === current.documentUrl || details.url.startsWith('data:')) return callback({})
    if (current.allowRemote && details.resourceType === 'image' && /^https?:/i.test(details.url)) return callback({})
    callback({ cancel: true })
  })
  configured = ses
  return ses
}

async function withDocument<T>(html: string, allowRemote: boolean, run: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const dir = join(app.getPath('temp'), 'pst-viewer-export')
    await mkdir(dir, { recursive: true })
    const file = join(dir, `${randomUUID()}.html`)
    await writeFile(file, html, 'utf8')
    current = { documentUrl: pathToFileURL(file).href, allowRemote }
    const win = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        session: exportSession(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: false,
        spellcheck: false
      }
    })
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    try {
      await win.loadFile(file)
      return await run(win)
    } finally {
      current = null
      if (!win.isDestroyed()) win.destroy()
      await rm(file, { force: true }).catch(() => undefined)
    }
  })
  queue = task.catch(() => undefined)
  return task
}

export interface PdfOptions {
  allowRemote: boolean
  pageSize: 'A4' | 'Letter'
  /** Shown left in the page footer, e.g. the subject. */
  footer: string
}

export function renderPdf(html: string, options: PdfOptions): Promise<Buffer> {
  return withDocument(html, options.allowRemote, (win) =>
    win.webContents.printToPDF({
      pageSize: options.pageSize,
      printBackground: true,
      margins: { top: 0.55, bottom: 0.65, left: 0.55, right: 0.55 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(options.footer),
      generateTaggedPDF: true
    })
  )
}

export function printDocument(html: string, allowRemote: boolean): Promise<boolean> {
  return withDocument(
    html,
    allowRemote,
    (win) =>
      new Promise<boolean>((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, (success) => resolve(success))
      })
  )
}

function footerTemplate(text: string): string {
  const escaped = text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<div style="width:100%;margin:0 0.55in;display:flex;justify-content:space-between;gap:24px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:7.5pt;color:#8e8e93"><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escaped}</span><span style="white-space:nowrap"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
}

export async function removeExportFiles(): Promise<void> {
  await rm(join(app.getPath('temp'), 'pst-viewer-export'), { recursive: true, force: true }).catch(() => undefined)
}
