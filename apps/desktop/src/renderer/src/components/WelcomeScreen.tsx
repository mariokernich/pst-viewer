import clsx from 'clsx'
import { Bug, CircleAlert, Clock, Download, Folder, FolderSearch, FolderOpen, Globe, Lock, Upload, X } from 'lucide-react'
import { useRef } from 'react'
import { links } from '@shared/links'
import type { RecentFile } from '@shared/types'
import { bridge } from '@/api'
import { errorMessage, locale, t, tp } from '@/i18n'
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
      <div className="drag flex h-11 shrink-0 items-center justify-end px-3 in-[.platform-win32]:pr-40">
        <UpdatePill />
      </div>
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
            <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-fg-muted">{t('dropHint')}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" size="lg" icon={FolderOpen} onClick={() => void openDialog('file')}>
                {t('openFile')}
              </Button>
              <Button variant="ghost" size="lg" icon={Folder} className="text-accent" onClick={() => void openDialog('folder')}>
                {t('openFolder')}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label={t('supportedFormats')}>
              {['PST', 'MSG', 'EML', 'MBOX'].map((format) => (
                <span key={format} className="rounded-md bg-fill px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-fg-muted">
                  {format}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-[12.5px] text-fg-muted">
            <Lock className="size-3.5 shrink-0" strokeWidth={2} />
            <span>{t('readOnlyNote')}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>O</Kbd>
              {t('shortcutOpen')}
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>{isMac ? '⇧⌘' : 'Ctrl+Shift'}</Kbd>
              <Kbd>O</Kbd>
              {t('openFolder').replace(/\s*…$/, '')}
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
      <Footer />
    </div>
  )
}

/** Shown once an update has been downloaded; it is also installed on the next quit. */
function UpdatePill() {
  const version = useApp((s) => s.info?.updateReady)
  if (!version) return null
  return (
    <div className="flex animate-pop-in items-center gap-2 rounded-full bg-accent/12 py-1 pr-1 pl-3 text-[12px] font-medium text-accent">
      <Download className="size-3.5" strokeWidth={2.2} />
      {t('updateReady', { version })}
      <button type="button" onClick={() => void bridge.installUpdate()} className="rounded-full bg-surface px-2.5 py-0.5 text-fg shadow-sm transition-colors hover:bg-hover">
        {t('restart')}
      </button>
    </div>
  )
}

function Footer() {
  const version = useApp((s) => s.info?.version)
  const link = (href: string, label: string, Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        void bridge.openExternal(href)
      }}
      className="flex items-center gap-1.5 rounded-md text-accent hover:underline focus-visible:underline"
    >
      <Icon className="size-3.5" strokeWidth={2} />
      {label}
    </a>
  )
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-line px-6 py-3 text-[12px] text-fg-subtle">
      {version && <span>{t('version', { version })}</span>}
      {link(links.website(locale()), t('website'), Globe)}
      {link(links.sourceCode, t('sourceCode'), GitHubIcon)}
      {link(links.reportProblem, t('reportProblem'), Bug)}
      <span>{t('openSource')}</span>
    </footer>
  )
}

/** lucide-react no longer ships brand icons. */
function GitHubIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
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
  const details = [prettyPath(dirname(file.path)), file.isFolder ? null : formatSize(file.size), file.itemCount !== null ? tp('itemCount', file.itemCount) : null].filter(Boolean)

  return (
    <li className="group relative">
      <button
        type="button"
        data-recent-row
        onClick={() => void openFile(file.path)}
        title={file.path}
        className={clsx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 pr-20 text-left transition-colors hover:bg-hover focus-visible:bg-hover', !file.exists && 'opacity-55')}
      >
        <PstFileIcon path={file.path} isFolder={file.isFolder} />
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

/** Document icon with the file type, or a folder for folders of mail files. */
export function PstFileIcon({ className, path = '', isFolder = false }: { className?: string; path?: string; isFolder?: boolean }) {
  if (isFolder) {
    return (
      <div className={clsx('flex h-11 w-9 shrink-0 items-center justify-center', className)} aria-hidden>
        <Folder className="size-8 text-accent" strokeWidth={1.5} fill="color-mix(in srgb, var(--accent) 18%, transparent)" />
      </div>
    )
  }
  const ext = (/\.(pst|ost|msg|eml|emlx|mbox|mbx)$/i.exec(path)?.[1] ?? 'mail').toUpperCase()
  const label = ext === 'MBX' ? 'MBOX' : ext === 'EMLX' ? 'EML' : ext
  const color = label === 'PST' || label === 'OST' ? '#4a64ff' : label === 'MSG' ? '#0a84ff' : label === 'EML' ? '#1f9d55' : label === 'MBOX' ? '#8e4ec6' : '#6b7280'
  return (
    <svg viewBox="0 0 40 48" className={clsx('h-11 w-9 shrink-0 drop-shadow-sm', className)} aria-hidden>
      <path d="M6 1h20l13 13v28a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5V6a5 5 0 0 1 5-5z" fill="var(--surface-raised)" stroke="var(--line-strong)" />
      <path d="M26 1v9a4 4 0 0 0 4 4h9" fill="none" stroke="var(--line-strong)" />
      <rect x="4" y="25" width="32" height="13" rx="4" fill={color} />
      <text x="20" y="34.6" textAnchor="middle" fontSize={label.length > 3 ? 7.5 : 8.5} fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </svg>
  )
}
