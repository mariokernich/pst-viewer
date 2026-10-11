import { app, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from 'electron'
import { links } from '../shared/links'
import type { LanguageSetting, MenuCommand, RecentFile, ThemeSource } from '../shared/types'
import { languageSetting, t, uiLocale } from './i18n'
import { autoCheckEnabled, checkInteractively, installNow, readyVersion, setAutoCheck, updatesSupported } from './updater'

export interface MenuHandlers {
  command: (command: MenuCommand) => void
  openPath: (path: string) => void
  clearRecent: () => void
  setTheme: (source: ThemeSource) => void
  setLanguage: (language: LanguageSetting) => void
  hasOpenFile: boolean
}

export function buildMenu(recent: RecentFile[], handlers: MenuHandlers): void {
  const s = t()
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged
  const cmd =
    (command: MenuCommand): MenuItemConstructorOptions['click'] =>
    () =>
      handlers.command(command)

  const recentItems: MenuItemConstructorOptions[] =
    recent.length > 0
      ? [
          ...recent.map<MenuItemConstructorOptions>((file) => ({
            label: file.name,
            sublabel: file.path,
            enabled: file.exists,
            click: () => handlers.openPath(file.path)
          })),
          { type: 'separator' },
          { label: s.clearRecent, click: handlers.clearRecent }
        ]
      : [{ label: s.noRecent, enabled: false }]

  const ready = readyVersion()
  const updateItems: MenuItemConstructorOptions[] = updatesSupported()
    ? [
        ready ? { label: s.restartToUpdate, click: installNow } : { label: s.checkForUpdates, click: () => void checkInteractively() },
        { label: s.autoCheckUpdates, type: 'checkbox', checked: autoCheckEnabled(), click: (item) => setAutoCheck(item.checked) }
      ]
    : []

  const theme = nativeTheme.themeSource
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: s.appName,
            submenu: [
              { role: 'about', label: s.about },
              ...updateItems,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          } satisfies MenuItemConstructorOptions
        ]
      : []),
    {
      label: isMac ? s.file : s.fileWin,
      submenu: [
        { label: s.open, accelerator: 'CmdOrCtrl+O', click: cmd('open') },
        { label: s.openFolder, accelerator: 'CmdOrCtrl+Shift+O', click: cmd('openFolder') },
        { label: s.openRecent, submenu: recentItems },
        { type: 'separator' },
        { label: s.exportPdf, enabled: handlers.hasOpenFile, click: cmd('exportPdf') },
        { label: s.exportEml, enabled: handlers.hasOpenFile, click: cmd('exportEml') },
        { label: s.exportText, enabled: handlers.hasOpenFile, click: cmd('exportText') },
        { type: 'separator' },
        { label: s.print, accelerator: 'CmdOrCtrl+P', enabled: handlers.hasOpenFile, click: cmd('print') },
        { type: 'separator' },
        { label: s.closeFile, accelerator: 'CmdOrCtrl+Shift+W', enabled: handlers.hasOpenFile, click: cmd('close') },
        ...(isMac ? [{ role: 'close' } satisfies MenuItemConstructorOptions] : [{ type: 'separator' }, { role: 'quit' }] satisfies MenuItemConstructorOptions[])
      ]
    },
    {
      label: s.edit,
      submenu: [
        { role: 'copy' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: s.find, accelerator: 'CmdOrCtrl+F', enabled: handlers.hasOpenFile, click: cmd('find') },
        { label: s.filters, accelerator: 'CmdOrCtrl+Alt+F', enabled: handlers.hasOpenFile, click: cmd('toggleFilters') }
      ]
    },
    {
      label: s.view,
      submenu: [
        { label: s.toggleSidebar, accelerator: isMac ? 'Ctrl+Cmd+S' : 'Ctrl+Shift+S', enabled: handlers.hasOpenFile, click: cmd('toggleSidebar') },
        { label: s.showHeaders, accelerator: 'CmdOrCtrl+Alt+U', enabled: handlers.hasOpenFile, click: cmd('showHeaders') },
        { type: 'separator' },
        {
          label: s.appearance,
          submenu: (
            [
              ['system', s.appearanceSystem],
              ['light', s.appearanceLight],
              ['dark', s.appearanceDark]
            ] as const
          ).map(([source, label]) => ({
            label,
            type: 'radio',
            checked: theme === source,
            click: () => handlers.setTheme(source)
          }))
        },
        {
          label: s.language,
          submenu: (
            [
              ['system', s.languageSystem],
              ['de', 'Deutsch'],
              ['en', 'English']
            ] as const
          ).map(([language, label]) => ({
            label,
            type: 'radio',
            checked: languageSetting() === language,
            click: () => handlers.setLanguage(language)
          }))
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] satisfies MenuItemConstructorOptions[] : [])
      ]
    },
    {
      label: s.window,
      role: 'windowMenu'
    },
    {
      label: s.help,
      role: 'help',
      submenu: [
        { label: s.searchHelp, click: cmd('searchHelp') },
        { type: 'separator' },
        { label: s.website, click: () => void shell.openExternal(links.website(uiLocale())) },
        { label: s.sourceCode, click: () => void shell.openExternal(links.sourceCode) },
        { label: s.reportProblem, click: () => void shell.openExternal(links.reportProblem) },
        ...(isMac || updateItems.length === 0 ? [] : [{ type: 'separator' } satisfies MenuItemConstructorOptions, ...updateItems])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
