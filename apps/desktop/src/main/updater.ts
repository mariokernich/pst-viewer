import { app, dialog, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { t } from './i18n'
import { settings } from './store'

/**
 * Updates of the downloads from GitHub Releases (electron-updater reads
 * latest*.yml of the newest release). Store builds are updated by the store,
 * and of the Linux packages only the AppImage can replace itself.
 *
 * The update check is the only request the app makes on its own; it uses its
 * own session, the app session stays blocked (see hardenSession).
 */

const CHECK_INTERVAL = 6 * 60 * 60 * 1000

export interface UpdaterHooks {
  window: () => BrowserWindow | null
  /** Called when an update was downloaded or the state changed otherwise. */
  changed: () => void
  /** Called right before the app quits to install an update. */
  beforeInstall: () => void
}

let hooks: UpdaterHooks | null = null
let downloadedVersion: string | null = null
let pending: Promise<string | null> | null = null
let timer: NodeJS.Timeout | null = null

export function updatesSupported(): boolean {
  if (!app.isPackaged || process.mas || process.windowsStore) return false
  return process.platform !== 'linux' || !!process.env.APPIMAGE
}

export function autoCheckEnabled(): boolean {
  return settings().get('autoUpdate') ?? true
}

export function readyVersion(): string | null {
  return downloadedVersion
}

export function initUpdater(h: UpdaterHooks): void {
  if (!updatesSupported()) return
  hooks = h
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  autoUpdater.on('update-downloaded', (info) => {
    downloadedVersion = info.version
    hooks?.changed()
  })
  // Failed background checks (offline, release still uploading) are retried later.
  autoUpdater.on('error', () => undefined)
  scheduleChecks()
}

export function setAutoCheck(enabled: boolean): void {
  settings().set('autoUpdate', enabled)
  scheduleChecks()
}

function scheduleChecks(): void {
  if (timer) clearInterval(timer)
  timer = null
  if (!hooks || !autoCheckEnabled()) return
  check().catch(() => undefined)
  timer = setInterval(() => check().catch(() => undefined), CHECK_INTERVAL)
}

/** Checks and downloads; resolves to the version that is ready, or null. */
function check(): Promise<string | null> {
  if (downloadedVersion) return Promise.resolve(downloadedVersion)
  pending ??= (async () => {
    const result = await autoUpdater.checkForUpdates()
    if (!result?.isUpdateAvailable) return null
    await result.downloadPromise
    return result.updateInfo.version
  })().finally(() => {
    pending = null
  })
  return pending
}

/** "Check for Updates…" in the menu: like the background check, but with feedback. */
export async function checkInteractively(): Promise<void> {
  if (!hooks) return
  const s = t()
  const win = hooks.window()
  const show = (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
  try {
    const version = await check()
    if (version) {
      const { response } = await show({ type: 'info', message: s.updateReady.replace('{version}', version), detail: s.updateReadyDetail, buttons: [s.restartNow, s.later], defaultId: 0, cancelId: 1 })
      if (response === 0) installNow()
    } else {
      await show({ type: 'info', message: s.upToDate, detail: s.upToDateDetail.replace('{version}', app.getVersion()), buttons: ['OK'] })
    }
  } catch {
    await show({ type: 'warning', message: s.updateFailed, detail: s.updateFailedDetail, buttons: ['OK'] })
  }
}

export function installNow(): void {
  if (!downloadedVersion) return
  hooks?.beforeInstall()
  autoUpdater.quitAndInstall()
}
