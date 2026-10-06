import clsx from 'clsx'
import { CircleAlert, Clock, FolderSearch, FolderOpen, Lock, Upload, X } from 'lucide-react'
import { useRef } from 'react'
import type { RecentFile } from '@shared/types'
import { bridge } from '@/api'
import { errorMessage, t, tp } from '@/i18n'
import { dirname, formatRelative, formatSize, prettyPath } from '@/lib/format'
import { useApp } from '@/store'
import { AppIcon } from './AppIcon'
import { Button, IconButton } from './ui/Button'
import { Kbd } from './ui/Controls'

export function WelcomeScreen({ dragActive }: { dragActive: boolean }) {
  const recent = useApp((s) => s.recent)
  const openError = useApp((s) => s.openError)
  const openDialog = useApp((s) => s.openDialog)
  const isMac = useApp((s) => s.info?.platform === 'darwin')

  return (
    <div className="flex h-full flex-col">
      <div className="drag h-11 shrink-0" />
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[clamp(2rem,4vw,3rem)] overflow-auto px-8 pb-12 max-[820px]:flex-col max-[820px]:justify-start">
        <section className="flex w-[min(420px,40vw)] shrink-0 animate-slide-up flex-col max-[820px]:w-full max-[820px]:max-w-[420px]">
          <AppIcon size={84} className="drop-shadow-[0_10px_24px_rgb(70_80_255/0.35)]" />
          <h1 className="mt-6 text-[32px] leading-tight font-semibold tracking-tight">{t('appName')}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{t('tagline')}</p>

          {openError && <OpenErrorBanner />}

          <div
            className={clsx(
              'mt-7 flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-7 text-center transition-all duration-200',
              dragActive ? 'scale-[1.02] border-accent bg-accent/10' : 'border-line-strong bg-surface/40'
            )}
          >
            <div className={clsx('flex size-12 items-center justify-center rounded-2xl transition-colors', dragActive ? 'bg-accent text-accent-fg' : 'bg-fill text-fg-muted')}>
              <Upload className="size-6" strokeWidth={1.8} />
            </div>
            <div className="mt-3 text-[15px] font-semibold">{dragActive ? t('dropOverlay') : t('dropHere')}</div>
            <p className="mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-fg-muted">{t('dropHint')}</p>
            <Button variant="primary" size="lg" icon={FolderOpen} className="mt-5" onClick={() => void openDialog()}>
              {t('openFile')}
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-2 text-[12.5px] text-fg-muted">
            <Lock className="size-3.5 shrink-0" strokeWidth={2} />
            <span>{t('readOnlyNote')}</span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>O</Kbd>
              {t('shortcutOpen')}
            </span>
          </div>
        </section>

        <section
          aria-label={t('recentFiles')}
          className="flex max-h-[min(600px,100%)] w-[min(480px,46vw)] shrink-0 animate-slide-up flex-col rounded-3xl border border-line bg-surface/75 shadow-card backdrop-blur-xl [animation-delay:60ms] max-[820px]:w-full max-[820px]:max-w-[480px]"
        >
          <header className="flex h-12 shrink-0 items-center justify-between pr-2.5 pl-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold">
              <Clock className="size-4 text-fg-muted" strokeWidth={2} />
              {t('recentFiles')}
            </h2>
            {recent.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void useApp.getState().clearRecent()} className="text-fg-muted">
                {t('clearList')}
              </Button>
            )}
          </header>
          {recent.length === 0 ? <EmptyRecent /> : <RecentList files={recent} />}
        </section>
      </div>
    </div>
  )
}

function OpenErrorBanner() {
  const error = useApp((s) => s.openError)!
  const dismiss = useApp((s) => s.dismissError)
  const isRecent = useApp((s) => s.recent.some((r) => r.path === error.path))
  return (
    <div role="alert" className="mt-6 flex animate-pop-in gap-3 rounded-2xl border border-danger/25 bg-danger/8 p-3.5">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">{t('errorTitle')}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{errorMessage(error.code)}</div>
        <div className="mt-1 truncate text-[11.5px] text-fg-subtle" title={error.path}>
          {prettyPath(error.path)}
        </div>
        {error.code === 'NOT_FOUND' && isRecent && (
          <Button
            size="sm"
            className="mt-2.5"
            onClick={() => {
              void useApp.getState().removeRecent(error.path)
              dismiss()
            }}
          >
            {t('removeFromList')}
          </Button>
        )}
      </div>
      <IconButton icon={X} label={t('dismiss')} size="sm" onClick={dismiss} />
    </div>
  )
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center px-8 pt-8 pb-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-fill text-fg-subtle">
        <Clock className="size-6" strokeWidth={1.6} />
      </div>
      <div className="mt-3 text-[13.5px] font-semibold">{t('noRecentFiles')}</div>
      <p className="mt-1 max-w-[280px] text-[12.5px] leading-relaxed text-fg-muted">{t('noRecentFilesHint')}</p>
    </div>
  )
}

function RecentList({ files }: { files: RecentFile[] }) {
  const listRef = useRef<HTMLUListElement>(null)

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-recent-row]') ?? [])]
    const idx = rows.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1)
    rows[next]?.focus()
    event.preventDefault()
  }

  return (
    <ul ref={listRef} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-auto px-2 pb-2">
      {files.map((file) => (
        <RecentRow key={file.path} file={file} />
      ))}
    </ul>
  )
}

function RecentRow({ file }: { file: RecentFile }) {
  const openFile = useApp((s) => s.openFile)
  const removeRecent = useApp((s) => s.removeRecent)
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  const details = [prettyPath(dirname(file.path)), formatSize(file.size), file.itemCount !== null ? tp('itemCount', file.itemCount) : null].filter(Boolean)

  return (
    <li className="group relative">
      <button
        type="button"
        data-recent-row
        onClick={() => void openFile(file.path)}
        title={file.path}
        className={clsx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 pr-20 text-left transition-colors hover:bg-hover focus-visible:bg-hover', !file.exists && 'opacity-55')}
      >
        <PstFileIcon />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold">{file.name}</span>
            {!file.exists && <span className="shrink-0 rounded-full bg-danger/12 px-1.5 py-px text-[10.5px] font-semibold text-danger">{t('fileMissing')}</span>}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-fg-muted">{details.join(' · ')}</div>
          <div className="mt-0.5 text-[11.5px] text-fg-subtle">{t('openedAgo', { time: formatRelative(file.lastOpened) })}</div>
        </div>
      </button>
      <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {file.exists && (
          <IconButton icon={FolderSearch} size="sm" label={isMac ? t('showInFinder') : t('showInFolder')} onClick={() => void bridge.showItemInFolder(file.path)} />
        )}
        <IconButton icon={X} size="sm" label={t('removeFromList')} onClick={() => void removeRecent(file.path)} />
      </div>
    </li>
  )
}

export function PstFileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" className={clsx('h-11 w-9 shrink-0 drop-shadow-sm', className)} aria-hidden>
      <path d="M6 1h20l13 13v28a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5V6a5 5 0 0 1 5-5z" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <path d="M26 1v9a4 4 0 0 0 4 4h9" fill="none" stroke="var(--line-strong)" />
      <rect x="6" y="25" width="28" height="13" rx="4" fill="#4a64ff" />
      <text x="20" y="34.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        PST
      </text>
    </svg>
  )
}
