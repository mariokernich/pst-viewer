import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  session,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from 'electron'
import { stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type {
  AppInfo,
  AttachmentPreview,
  ExportDocument,
  IpcResult,
  LanguageSetting,
  MenuCommand,
  MessageRef,
  PstErrorCode,
  SaveResult,
  SearchRequest,
  ThemeSource
} from '../shared/types'
import { sanitizeFileName } from '../shared/files'
import { sanitizeFilters, sanitizeSort } from '../shared/filters'
import {
  attachmentCopy,
  initAttachmentCopies,
  openCopy,
  PREVIEW_SCHEME,
  previewOf,
  quickLook,
  registerPreviewScheme,
  removeAttachmentCopiesSync,
  resetAttachmentCopies
} from './attachments'
import { printDocument, removeExportFiles, renderPdf } from './exporter'
import { formatLocale, setLanguageSetting, t, uiLocale } from './i18n'
import { buildMenu } from './menu'
import { addRecentFile, clearRecentFiles, listRecentFiles, removeRecentFile, settings } from './store'
import { PstWorkerClient, WorkerError } from './workerClient'

const DEV_URL = process.env.ELECTRON_RENDERER_URL
const PST_EXTENSIONS = /\.(pst|ost)$/i

let mainWindow: BrowserWindow | null = null
let currentFile: string | null = null
let pendingPath: string | null = null
let allowRemoteImages = false
/** Paths the renderer may reveal in Finder/Explorer. */
const revealablePaths = new Set<string>()

const worker = new PstWorkerClient({
  onProgress: (progress) => mainWindow?.webContents.send('pst:progress', progress),
  onIndexProgress: (progress) => mainWindow?.webContents.send('pst:indexProgress', progress)
})

app.setName('PST Viewer')
// Allows isolated profiles, e.g. for end-to-end tests.
if (process.env.PST_VIEWER_USER_DATA) app.setPath('userData', process.env.PST_VIEWER_USER_DATA)
registerPreviewScheme()

// -----------------------------------------------------------------------------
// Single instance & "open with"

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const path = pstPathFromArgv(argv)
    if (path) requestOpen(path)
  })
  app.on('open-file', (event, path) => {
    event.preventDefault()
    requestOpen(path)
  })
  pendingPath = pstPathFromArgv(process.argv)
  app.whenReady().then(init)
}

function pstPathFromArgv(argv: string[]): string | null {
  return argv.slice(1).find((arg) => PST_EXTENSIONS.test(arg) && !arg.startsWith('-')) ?? null
}

function requestOpen(path: string): void {
  if (mainWindow && !mainWindow.webContents.isLoading()) mainWindow.webContents.send('app:openPath', path)
  else pendingPath = path
}

// -----------------------------------------------------------------------------
// Startup

async function init(): Promise<void> {
  nativeTheme.themeSource = settings().get('themeSource') ?? 'system'
  hardenSession()
  await initAttachmentCopies()
  registerIpc()
  await refreshMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  nativeTheme.on('updated', () => {
    mainWindow?.setBackgroundColor(windowBackground())
  })
  if (process.platform === 'darwin') {
    systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', () => {
      mainWindow?.webContents.send('app:accentColor', accentColor())
    })
  } else {
    systemPreferences.on('accent-color-changed', () => mainWindow?.webContents.send('app:accentColor', accentColor()))
  }
}

app.on('window-all-closed', () => {
  worker.stop()
  currentFile = null
  if (process.platform !== 'darwin') app.quit()
  else void refreshMenu()
})

app.on('before-quit', () => worker.stop())
app.on('will-quit', () => {
  removeAttachmentCopiesSync()
  void removeExportFiles()
})

function windowBackground(): string {
  if (process.platform === 'darwin') return '#00000000'
  return nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f5f5f7'
}

function createWindow(): void {
  const saved = settings().get('windowBounds')
  const bounds = saved && isVisibleOnSomeDisplay(saved) ? saved : { width: 1360, height: 860 }
  const isMac = process.platform === 'darwin'

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 860,
    minHeight: 540,
    show: false,
    title: t().appName,
    backgroundColor: windowBackground(),
    titleBarStyle: process.platform === 'linux' ? 'default' : 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 18 }, vibrancy: 'sidebar' as const, visualEffectState: 'followWindow' as const }
      : process.platform === 'win32'
        ? { titleBarOverlay: { color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000', height: 52 }, backgroundMaterial: 'mica' as const }
        : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      navigateOnDragDrop: false
    }
  })
  mainWindow = win
  if (saved?.maximized) win.maximize()

  win.once('ready-to-show', () => win.show())
  win.on('close', () => {
    const b = win.getNormalBounds()
    settings().set('windowBounds', { ...b, maximized: win.isMaximized() })
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  if (process.platform === 'win32') {
    nativeTheme.on('updated', () => {
      if (!win.isDestroyed()) win.setTitleBarOverlay({ symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000' })
    })
  }

  if (DEV_URL) void win.loadURL(DEV_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function isVisibleOnSomeDisplay(b: { x?: number; y?: number; width: number; height: number }): boolean {
  if (b.x === undefined || b.y === undefined) return true
  return screen.getAllDisplays().some(({ workArea: a }) => b.x! < a.x + a.width - 100 && b.x! + b.width > a.x + 100 && b.y! >= a.y - 10 && b.y! < a.y + a.height - 100)
}

function accentColor(): string | null {
  try {
    const color = systemPreferences.getAccentColor()
    return color ? `#${color.slice(0, 6)}` : null
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// Security

function isAppUrl(url: string): boolean {
  if (DEV_URL) return url.startsWith(DEV_URL)
  return url.startsWith('file://') && url.includes('/renderer/index.html')
}

function hardenSession(): void {
  const ses = session.defaultSession
  // Only writing to the clipboard (copy address / headers) is permitted.
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'clipboard-sanitized-write'))
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write')
  // Nothing is downloaded through the browser layer - except when the user saves
  // an attachment from the PDF viewer's toolbar, which then asks for a location.
  ses.on('will-download', (event, item) => {
    if (!item.getURL().startsWith(`${PREVIEW_SCHEME}://`)) {
      event.preventDefault()
      return
    }
    item.setSaveDialogOptions({ title: t().saveAttachmentTitle, defaultPath: join(app.getPath('downloads'), sanitizeFileName(item.getFilename())) })
  })

  // Block all network access except the dev server and, after explicit consent
  // for a message, remote images referenced by that message.
  const devHost = DEV_URL ? new URL(DEV_URL).host : null
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    let host = ''
    try {
      host = new URL(details.url).host
    } catch {
      // invalid URL - cancel below
    }
    if (devHost && host === devHost) return callback({})
    if (allowRemoteImages && details.resourceType === 'image') return callback({})
    callback({ cancel: true })
  })

  app.on('web-contents-created', (_event, contents) => {
    // Links of the app itself are opened via IPC; anything else (e.g. a link
    // in a PDF) asks before leaving the app.
    contents.setWindowOpenHandler(({ url }) => {
      void confirmOpenExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-frame-navigate', (details) => {
      if (details.isMainFrame) {
        if (isAppUrl(details.url)) return
        details.preventDefault()
        if (/^(https?|mailto):/i.test(details.url)) void confirmOpenExternal(details.url)
        return
      }
      if (!isAllowedSubframeUrl(details.url)) details.preventDefault()
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('context-menu', (_event, params) => {
      const s = t()
      const template: MenuItemConstructorOptions[] = []
      if (params.linkURL && /^(https?|mailto):/i.test(params.linkURL)) {
        template.push({ label: s.openLink, click: () => void openExternalSafe(params.linkURL) })
        template.push({ label: s.copyLink, click: () => clipboard.writeText(params.linkURL.replace(/^mailto:/i, '')) })
        template.push({ type: 'separator' })
      }
      if (params.isEditable) {
        template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' })
      } else if (params.selectionText.trim()) {
        template.push({ role: 'copy' })
      }
      template.push({ role: 'selectAll' })
      Menu.buildFromTemplate(template).popup()
    })
  })
}

/** Sub frames: mail bodies (about:srcdoc), attachment previews and Chromium's PDF viewer. */
function isAllowedSubframeUrl(url: string): boolean {
  return url.startsWith('about:') || url.startsWith(`${PREVIEW_SCHEME}://`) || url.startsWith(`chrome-extension://${PDF_VIEWER_EXTENSION}/`)
}

const PDF_VIEWER_EXTENSION = 'mhjfbmdgcfjbbpaeojofohoefgiehjai'

async function confirmOpenExternal(url: string): Promise<void> {
  if (!/^(https?|mailto):/i.test(url)) return
  const s = t()
  const options = { type: 'question' as const, message: s.openLinkQuestion, detail: url, buttons: [s.openLink, s.cancel], defaultId: 0, cancelId: 1 }
  const { response } = mainWindow ? await dialog.showMessageBox(mainWindow, options) : await dialog.showMessageBox(options)
  if (response === 0) await openExternalSafe(url)
}

async function openExternalSafe(url: string): Promise<void> {
  try {
    const parsed = new URL(url)
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) await shell.openExternal(parsed.toString())
  } catch {
    // ignore invalid URLs
  }
}

// -----------------------------------------------------------------------------
// IPC

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return !!mainWindow && event.sender === mainWindow.webContents && !!event.senderFrame && isAppUrl(event.senderFrame.url)
}

function toIpcError(err: unknown): { code: PstErrorCode; message: string } {
  if (err instanceof WorkerError) return { code: err.code, message: err.message }
  if (err instanceof Error && err.message === 'BLOCKED') return { code: 'BLOCKED', message: err.message }
  return { code: 'UNKNOWN', message: err instanceof Error ? err.message : String(err) }
}

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<R>> => {
    if (!isTrustedSender(event)) return { ok: false, error: { code: 'UNKNOWN', message: 'Untrusted sender' } }
    try {
      return { ok: true, value: await fn(...(args as A)) }
    } catch (err) {
      return { ok: false, error: toIpcError(err) }
    }
  })
}

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new Error(`Invalid ${name}`)
  return value
}

function int(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`Invalid ${name}`)
  return value
}

function ref(value: unknown): MessageRef {
  const v = value as MessageRef
  if (!v || typeof v !== 'object') throw new Error('Invalid message reference')
  const path = v.path === undefined ? undefined : Array.isArray(v.path) ? v.path.map((p) => int(p, 'path')) : undefined
  return { id: int(v.id, 'id'), ...(path && path.length ? { path } : {}) }
}

function searchRequest(value: unknown): SearchRequest {
  const v = value as SearchRequest
  if (!v || typeof v !== 'object' || typeof v.text !== 'string' || !v.filters || !v.sort) throw new Error('Invalid search request')
  return {
    text: v.text.slice(0, 2000),
    folderId: v.folderId === null ? null : int(v.folderId, 'folderId'),
    includeSubfolders: !!v.includeSubfolders,
    filters: sanitizeFilters(v.filters),
    sort: sanitizeSort(v.sort),
    now: typeof v.now === 'number' ? v.now : Date.now(),
    firstDayOfWeek: v.firstDayOfWeek === 0 ? 0 : 1,
    pageSize: Math.min(1000, Math.max(1, int(v.pageSize, 'pageSize')))
  }
}

async function refreshMenu(): Promise<void> {
  buildMenu(await listRecentFiles(), {
    command: (command: MenuCommand) => {
      if (!mainWindow) {
        createWindow()
        if (command !== 'open') return
        mainWindow!.webContents.once('did-finish-load', () => mainWindow?.webContents.send('menu:command', command))
        return
      }
      mainWindow.webContents.send('menu:command', command)
    },
    openPath: (path) => {
      if (!mainWindow) {
        pendingPath = path
        createWindow()
      } else requestOpen(path)
    },
    clearRecent: () => {
      clearRecentFiles()
      void refreshMenu()
      mainWindow?.webContents.send('recent:changed')
    },
    setTheme,
    setLanguage,
    hasOpenFile: currentFile !== null
  })
}

function setTheme(source: ThemeSource): void {
  nativeTheme.themeSource = source
  settings().set('themeSource', source)
  void refreshMenu()
  mainWindow?.webContents.send('app:theme', source)
}

function setLanguage(language: LanguageSetting): void {
  setLanguageSetting(language)
  void refreshMenu()
  if (mainWindow) {
    mainWindow.setTitle(currentFile ? `${basename(currentFile)} – ${t().appName}` : t().appName)
    mainWindow.webContents.send('app:locale', { locale: uiLocale(), formatLocale: formatLocale() })
  }
}

function setCurrentFile(path: string | null): void {
  currentFile = path
  if (mainWindow) {
    if (process.platform === 'darwin') mainWindow.setRepresentedFilename(path ?? '')
    mainWindow.setTitle(path ? `${basename(path)} – ${t().appName}` : t().appName)
  }
  void refreshMenu()
}

/** Read-only temporary copy of an attachment of the open file. */
async function copyOfAttachment(messageRef: MessageRef, index: number): ReturnType<typeof attachmentCopy> {
  const info = await worker.request('attachmentInfo', { ref: messageRef, index })
  const key = `${currentFile}|${messageRef.id}/${(messageRef.path ?? []).join('/')}|${index}`
  return attachmentCopy(key, info, async (targetPath) => {
    await worker.request('saveAttachment', { ref: messageRef, index, targetPath })
  })
}

let lastExportDirectory: string | null = null

const EXPORT_EXTENSIONS: Record<'pdf' | 'eml' | 'txt', string> = { pdf: 'pdf', eml: 'eml', txt: 'txt' }

async function askExportPath(suggestedName: string, format: 'pdf' | 'eml' | 'txt'): Promise<string | null> {
  const s = t()
  const extension = EXPORT_EXTENSIONS[format]
  const fileName = `${sanitizeFileName(suggestedName, 'message').slice(0, 150)}.${extension}`
  const filterName = format === 'pdf' ? s.pdfFilter : format === 'eml' ? s.emlFilter : s.textFilter
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: format === 'pdf' ? s.exportPdfTitle : format === 'eml' ? s.exportEmlTitle : s.exportTextTitle,
    defaultPath: join(lastExportDirectory ?? app.getPath('documents'), fileName),
    filters: [{ name: filterName, extensions: [extension] }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })
  if (result.canceled || !result.filePath) return null
  lastExportDirectory = dirname(result.filePath)
  return result.filePath
}

function exportDocument(value: unknown): ExportDocument {
  const d = value as ExportDocument
  if (!d || typeof d !== 'object' || (d.format !== 'pdf' && d.format !== 'txt') || typeof d.content !== 'string') throw new Error('Invalid document')
  if (d.content.length > 200 * 1024 * 1024) throw new Error('Document too large')
  return {
    format: d.format,
    content: d.content,
    suggestedName: typeof d.suggestedName === 'string' ? d.suggestedName : 'message',
    footer: typeof d.footer === 'string' ? d.footer.slice(0, 300) : '',
    allowRemote: d.allowRemote === true
  }
}

/** Letter in North America, A4 elsewhere. */
function pageSize(): 'A4' | 'Letter' {
  const region = formatLocale().split('-')[1]?.toUpperCase() ?? ''
  return ['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE'].includes(region) ? 'Letter' : 'A4'
}

function registerIpc(): void {
  handle('app:getInfo', (): AppInfo => {
    const path = pendingPath
    pendingPath = null
    return {
      platform: process.platform,
      version: app.getVersion(),
      locale: uiLocale(),
      formatLocale: formatLocale(),
      accentColor: accentColor(),
      themeSource: nativeTheme.themeSource,
      pendingPath: path
    }
  })

  handle('app:setTheme', (source: unknown) => {
    if (source !== 'system' && source !== 'light' && source !== 'dark') throw new Error('Invalid theme')
    setTheme(source)
  })

  handle('app:setRemoteImages', (allowed: unknown) => {
    allowRemoteImages = allowed === true
  })

  handle('dialog:openPst', async (): Promise<string | null> => {
    const s = t()
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: s.openDialogTitle,
      buttonLabel: s.openDialogButton,
      properties: ['openFile'],
      filters: [
        { name: s.pstFilter, extensions: ['pst', 'ost'] },
        { name: s.allFiles, extensions: ['*'] }
      ]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle('pst:open', async (path: unknown) => {
    const filePath = str(path, 'path')
    let size = 0
    try {
      const s = await stat(filePath)
      if (!s.isFile()) throw new Error()
      size = s.size
    } catch {
      throw new WorkerError('NOT_FOUND', filePath)
    }
    setCurrentFile(null)
    allowRemoteImages = false
    resetAttachmentCopies()
    await worker.restart()
    try {
      const result = await worker.request('open', { path: filePath })
      addRecentFile(filePath, size, result.store.itemCount)
      revealablePaths.add(filePath)
      setCurrentFile(filePath)
      return result
    } catch (err) {
      worker.stop()
      void refreshMenu()
      throw err
    }
  })

  handle('pst:cancelOpen', () => {
    worker.cancel()
  })

  handle('pst:close', () => {
    resetAttachmentCopies()
    worker.stop()
    allowRemoteImages = false
    setCurrentFile(null)
  })

  handle('pst:search', (req: unknown) => worker.request('search', searchRequest(req)))

  handle('pst:page', (token: unknown, offset: unknown, limit: unknown) =>
    worker.request('page', { token: int(token, 'token'), offset: int(offset, 'offset'), limit: Math.min(1000, int(limit, 'limit')) })
  )

  handle('pst:message', (r: unknown) => worker.request('message', ref(r)))

  handle('pst:saveAttachment', async (r: unknown, index: unknown): Promise<SaveResult> => {
    const messageRef = ref(r)
    const attachmentIndex = int(index, 'index')
    const info = await worker.request('attachmentInfo', { ref: messageRef, index: attachmentIndex })
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: t().saveAttachmentTitle,
      defaultPath: join(app.getPath('downloads'), info.fileName),
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })
    if (result.canceled || !result.filePath) return { status: 'canceled' }
    const saved = await worker.request('saveAttachment', { ref: messageRef, index: attachmentIndex, targetPath: result.filePath })
    revealablePaths.add(result.filePath)
    return saved
  })

  handle('pst:previewAttachment', async (r: unknown, index: unknown): Promise<AttachmentPreview> => {
    return previewOf(await copyOfAttachment(ref(r), int(index, 'index')))
  })

  handle('pst:openAttachment', async (r: unknown, index: unknown) => {
    const copy = await copyOfAttachment(ref(r), int(index, 'index'))
    try {
      await openCopy(copy)
    } catch (err) {
      if (err instanceof Error && err.message === 'BLOCKED') throw err
      throw new WorkerError('OPEN_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  handle('pst:quickLook', async (r: unknown, index: unknown) => {
    if (process.platform !== 'darwin' || !mainWindow) return
    quickLook(mainWindow, await copyOfAttachment(ref(r), int(index, 'index')))
  })

  handle('export:eml', async (r: unknown, name: unknown): Promise<SaveResult> => {
    const messageRef = ref(r)
    const target = await askExportPath(str(name, 'name'), 'eml')
    if (!target) return { status: 'canceled' }
    const saved = await worker.request('exportEml', { ref: messageRef, targetPath: target })
    revealablePaths.add(target)
    return saved
  })

  handle('export:document', async (doc: unknown): Promise<SaveResult> => {
    const d = exportDocument(doc)
    const target = await askExportPath(d.suggestedName, d.format)
    if (!target) return { status: 'canceled' }
    if (d.format === 'pdf') {
      await writeFile(target, await renderPdf(d.content, { allowRemote: d.allowRemote, pageSize: pageSize(), footer: d.footer }))
    } else {
      await writeFile(target, d.content, 'utf8')
    }
    revealablePaths.add(target)
    return { status: 'saved', path: target, count: 1 }
  })

  handle('export:print', async (doc: unknown): Promise<boolean> => {
    const d = exportDocument(doc)
    return printDocument(d.content, d.allowRemote)
  })

  handle('pst:saveAttachments', async (r: unknown): Promise<SaveResult> => {
    const messageRef = ref(r)
    const s = t()
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: s.saveAllTitle,
      buttonLabel: s.saveAllButton,
      defaultPath: app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    })
    const directory = result.filePaths[0]
    if (result.canceled || !directory) return { status: 'canceled' }
    const saved = await worker.request('saveAttachments', { ref: messageRef, directory })
    revealablePaths.add(directory)
    return saved
  })

  handle('recent:list', async () => {
    const files = await listRecentFiles()
    for (const f of files) revealablePaths.add(f.path)
    return files
  })

  handle('recent:remove', async (path: unknown) => {
    removeRecentFile(str(path, 'path'))
    await refreshMenu()
    return listRecentFiles()
  })

  handle('recent:clear', async () => {
    clearRecentFiles()
    await refreshMenu()
  })

  handle('shell:openExternal', (url: unknown) => openExternalSafe(str(url, 'url')))

  handle('shell:showItemInFolder', (path: unknown) => {
    const p = str(path, 'path')
    if (!revealablePaths.has(p)) throw new Error('Path not allowed')
    shell.showItemInFolder(p)
  })
}
