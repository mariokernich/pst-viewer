import { Upload } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import type { MenuCommand } from '@shared/types'
import { bridge } from '@/api'
import { setLocale, t } from '@/i18n'
import { useApp } from '@/store'
import { AttachmentPreviewDialog } from './components/AttachmentPreview'
import { EmbeddedMessageDialog, HeadersDialog, SearchHelpDialog } from './components/Dialogs'
import { LoadingScreen } from './components/LoadingScreen'
import { Mailbox } from './components/Mailbox'
import { Toast } from './components/Toast'
import { WelcomeScreen } from './components/WelcomeScreen'

export function App() {
  const screen = useApp((s) => s.screen)
  const ready = useApp((s) => s.info !== null)
  // Remount the UI when the language changes; data lives in the store.
  const localeKey = useApp((s) => `${s.info?.locale}-${s.info?.formatLocale}`)
  const dragActive = useFileDrop()
  useMenuCommands()
  useKeyboardShortcuts()
  useBridgeEvents()

  useEffect(() => {
    void useApp.getState().init()
  }, [])

  if (!ready) return null
  return (
    <Fragment key={localeKey}>
      {screen === 'welcome' && <WelcomeScreen dragActive={dragActive} />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'mailbox' && <Mailbox />}
      {dragActive && screen === 'mailbox' && <DropOverlay />}
      <SearchHelpDialog />
      <HeadersDialog />
      <EmbeddedMessageDialog />
      <AttachmentPreviewDialog />
      <Toast />
    </Fragment>
  )
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-accent/10 p-6 backdrop-blur-[2px]">
      <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-accent">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg">
          <Upload className="size-7" strokeWidth={1.8} />
        </div>
        <div className="mt-3 text-[15px] font-semibold">{t('dropOverlay')}</div>
      </div>
    </div>
  )
}

/** Accepts a PST file dropped anywhere on the window. */
function useFileDrop(): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent): boolean => !!event.dataTransfer?.types.includes('Files')
    const onEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth++
      if (useApp.getState().screen !== 'loading') setActive(true)
    }
    const onOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setActive(false)
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      depth = 0
      setActive(false)
      const files = [...(event.dataTransfer?.files ?? [])]
      const file = files.find((f) => /\.(pst|ost)$/i.test(f.name)) ?? files[0]
      if (!file) return
      const path = bridge.getPathForFile(file)
      if (path) void useApp.getState().openFile(path)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])
  return active
}

function useMenuCommands(): void {
  useEffect(
    () =>
      bridge.onMenuCommand((command: MenuCommand) => {
        const state = useApp.getState()
        const inMailbox = state.screen === 'mailbox'
        switch (command) {
          case 'open':
            void state.openDialog('file')
            break
          case 'openFolder':
            void state.openDialog('folder')
            break
          case 'close':
            if (inMailbox) void state.closeFile()
            break
          case 'find':
            if (inMailbox) state.focusSearch()
            break
          case 'toggleFilters':
            if (inMailbox) state.setUi({ filtersOpen: !state.filtersOpen })
            break
          case 'toggleSidebar':
            if (inMailbox) state.setUi({ sidebarVisible: !state.sidebarVisible })
            break
          case 'showHeaders':
            if (inMailbox && state.detail) state.setUi({ headersOpen: true })
            break
          case 'searchHelp':
            state.setUi({ helpOpen: true })
            break
          case 'exportPdf':
          case 'exportEml':
          case 'exportText':
          case 'print': {
            const detail = inMailbox ? state.currentDetail() : null
            if (!detail) break
            if (command === 'print') void state.printMessage(detail)
            else void state.exportMessage(detail, command === 'exportPdf' ? 'pdf' : command === 'exportEml' ? 'eml' : 'txt')
            break
          }
        }
      }),
    []
  )
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

/** Mail-client style keyboard navigation. */
function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const state = useApp.getState()
      if (state.screen !== 'mailbox' || event.defaultPrevented) return
      if (isEditable(event.target) || document.querySelector('dialog[open]')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      switch (event.key) {
        case 'ArrowDown':
        case 'j':
          event.preventDefault()
          state.moveSelection(1)
          break
        case 'ArrowUp':
        case 'k':
          event.preventDefault()
          state.moveSelection(-1)
          break
        case 'PageDown':
          event.preventDefault()
          state.moveSelection(10)
          break
        case 'PageUp':
          event.preventDefault()
          state.moveSelection(-10)
          break
        case 'Home':
          event.preventDefault()
          void state.selectIndex(0)
          break
        case 'End':
          event.preventDefault()
          if (state.result) void state.selectIndex(state.result.total - 1)
          break
        case '/':
          event.preventDefault()
          state.focusSearch()
          break
        case 'Escape':
          if (state.query) state.setQuery('', true)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Platform class, system accent colour and open requests from the main process. */
function useBridgeEvents(): void {
  const info = useApp((s) => s.info)
  useEffect(() => {
    if (!info) return
    const root = document.documentElement
    root.classList.add(`platform-${info.platform}`)
    const applyAccent = (color: string | null): void => {
      if (color) root.style.setProperty('--accent', color)
      else root.style.removeProperty('--accent')
    }
    applyAccent(info.accentColor)
    const offAccent = bridge.onAccentColor(applyAccent)
    const offOpen = bridge.onOpenPath((path) => void useApp.getState().openFile(path))
    const offRecent = bridge.onRecentChanged(() => void useApp.getState().refreshRecent())
    const offIndex = bridge.onIndexProgress((progress) => useApp.getState().handleIndexProgress(progress))
    const offLocale = bridge.onLocaleChange(({ locale, formatLocale }) => {
      setLocale(locale, formatLocale)
      const current = useApp.getState().info
      if (current) useApp.setState({ info: { ...current, locale, formatLocale } })
    })
    return () => {
      offAccent()
      offOpen()
      offRecent()
      offIndex()
      offLocale()
    }
  }, [info])
}
