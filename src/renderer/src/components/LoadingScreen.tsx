import { t } from '@/i18n'
import { useApp } from '@/store'
import { Button } from './ui/Button'
import { PstFileIcon } from './WelcomeScreen'

export function LoadingScreen() {
  const path = useApp((s) => s.loadingPath) ?? ''
  const progress = useApp((s) => s.progress)
  const cancelOpen = useApp((s) => s.cancelOpen)
  const name = path.split(/[\\/]/).pop() ?? path

  const determinate = progress?.phase === 'indexing' && progress.total > 0
  const percent = determinate ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0
  const status =
    progress?.phase === 'indexing'
      ? t('loadingIndexing')
      : progress?.phase === 'scanning'
        ? t('loadingScanning')
        : progress?.phase === 'finishing'
          ? t('loadingFinishing')
          : t('loadingOpening')

  return (
    <div className="flex h-full flex-col">
      <div className="drag h-11 shrink-0" />
      <div className="flex flex-1 items-center justify-center pb-16">
        <div className="w-[440px] animate-slide-up rounded-3xl border border-line bg-surface/80 p-7 shadow-card backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <PstFileIcon />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold" title={path}>
                {t('loadingTitle', { name })}
              </div>
              <div className="mt-0.5 text-[12.5px] text-fg-muted" aria-live="polite">
                {status}
              </div>
            </div>
          </div>

          <div
            className="mt-6 h-1.5 overflow-hidden rounded-full bg-fill"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={determinate ? percent : undefined}
          >
            {determinate ? (
              <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
            ) : (
              <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
            )}
          </div>

          <div className="mt-2.5 flex h-4 items-center justify-between gap-4 text-[11.5px] text-fg-muted tabular-nums">
            <span className="truncate">{determinate && progress.folderName ? t('loadingFolder', { name: progress.folderName }) : ''}</span>
            <span className="shrink-0">{determinate ? t('loadingProgress', { done: progress.done, total: progress.total }) : ''}</span>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={cancelOpen}>{t('cancel')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
