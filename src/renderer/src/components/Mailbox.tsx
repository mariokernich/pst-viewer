import clsx from 'clsx'
import { Code, Lock, PanelLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'
import { useApp } from '@/store'
import { ExportMenu } from './ExportMenu'
import { MessageList } from './MessageList'
import { ReadingPane } from './ReadingPane'
import { SearchBox } from './SearchBox'
import { Sidebar } from './Sidebar'
import { IconButton } from './ui/Button'
import { Segmented } from './ui/Controls'

const SIDEBAR = { key: 'ui.sidebarWidth', initial: 248, min: 190, max: 420 }
const LIST = { key: 'ui.listWidth', initial: 410, min: 300, max: 680 }

function useStoredWidth(spec: typeof SIDEBAR): [number, (w: number) => void] {
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(spec.key))
      return stored >= spec.min && stored <= spec.max ? stored : spec.initial
    } catch {
      return spec.initial
    }
  })
  const update = useCallback(
    (w: number) => {
      const clamped = Math.round(Math.min(spec.max, Math.max(spec.min, w)))
      setWidth(clamped)
      try {
        localStorage.setItem(spec.key, String(clamped))
      } catch {
        // ignore
      }
    },
    [spec]
  )
  return [width, update]
}

const MIN_READING_WIDTH = 380

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export function Mailbox() {
  const sidebarVisible = useApp((s) => s.sidebarVisible)
  const [sidebarWidth, setSidebarWidth] = useStoredWidth(SIDEBAR)
  const [storedListWidth, setListWidth] = useStoredWidth(LIST)
  // Keep the reading pane usable in narrow windows by shrinking the list first.
  const windowWidth = useWindowWidth()
  const listWidth = Math.max(LIST.min - 20, Math.min(storedListWidth, windowWidth - (sidebarVisible ? sidebarWidth : 0) - MIN_READING_WIDTH))

  return (
    <div className="flex h-full">
      {sidebarVisible && (
        <>
          <Sidebar width={sidebarWidth} />
          <Resizer width={sidebarWidth} onResize={setSidebarWidth} onReset={() => setSidebarWidth(SIDEBAR.initial)} label={t('folders')} />
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col bg-surface shadow-[-1px_0_0_var(--line)]">
        <Toolbar listWidth={listWidth} />
        <div className="flex min-h-0 flex-1">
          <MessageList width={listWidth} />
          <Resizer width={listWidth} onResize={setListWidth} onReset={() => setListWidth(LIST.initial)} label={t('searchResults')} />
          <ReadingPane />
        </div>
      </div>
    </div>
  )
}

function Toolbar({ listWidth }: { listWidth: number }) {
  const sidebarVisible = useApp((s) => s.sidebarVisible)
  const platform = useApp((s) => s.info?.platform)
  const detail = useApp((s) => s.detail)
  const bodyView = useApp((s) => s.bodyView)
  const setUi = useApp((s) => s.setUi)
  const isMac = platform === 'darwin'

  return (
    <div
      className={clsx('drag flex h-[52px] shrink-0 items-center gap-2 border-b border-line pr-3', platform === 'win32' && 'pr-[150px]')}
      style={{ paddingLeft: !sidebarVisible && isMac ? 84 : 10 }}
    >
      <IconButton icon={PanelLeft} label={t('toggleSidebar')} active={!sidebarVisible} onClick={() => setUi({ sidebarVisible: !sidebarVisible })} />
      <div className="flex min-w-0 items-center" style={{ width: Math.max(260, listWidth - 46) }}>
        <SearchBox />
      </div>
      <div className="flex-1" />
      {detail && detail.html !== null && detail.text.trim() && (
        <Segmented
          label={t('viewHtml')}
          size="sm"
          value={bodyView}
          onChange={(value) => setUi({ bodyView: value })}
          options={[
            { value: 'html', label: t('viewHtml') },
            { value: 'text', label: t('viewText') }
          ]}
        />
      )}
      {detail && <IconButton icon={Code} label={t('showHeaders')} onClick={() => setUi({ headersOpen: true })} />}
      {detail && <ExportMenu detail={detail} />}
      <span
        className="ml-1 hidden h-7 items-center gap-1.5 rounded-full bg-fill px-2.5 text-[11.5px] font-medium text-fg-muted min-[1100px]:inline-flex"
        title={t('readOnlyTooltip')}
      >
        <Lock className="size-3" strokeWidth={2.4} />
        {t('readOnly')}
      </span>
    </div>
  )
}

/** Vertical drag handle between two panes. */
function Resizer({ width, onResize, onReset, label }: { width: number; onResize: (w: number) => void; onReset: () => void; label: string }) {
  const start = useRef<{ x: number; width: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      tabIndex={-1}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, width }
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        onResize(start.current.width + event.clientX - start.current.x)
      }}
      onPointerUp={() => {
        start.current = null
        setDragging(false)
      }}
      onDoubleClick={onReset}
      className="group relative z-20 -mx-[3px] w-[6px] shrink-0 cursor-col-resize"
    >
      <div className={clsx('absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 transition-colors', dragging ? 'bg-accent' : 'group-hover:bg-accent/50')} />
    </div>
  )
}
