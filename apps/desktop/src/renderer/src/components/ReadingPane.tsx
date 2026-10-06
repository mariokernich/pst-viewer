import { CircleAlert, MailOpen } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { t } from '@/i18n'
import { useApp } from '@/store'
import { MessageView } from './MessageView'
import { Button } from './ui/Button'
import { Kbd, Spinner } from './ui/Controls'

const NO_TERMS: string[] = []

export function ReadingPane() {
  const detail = useApp((s) => s.detail)
  const detailState = useApp((s) => s.detailState)
  const selectedId = useApp((s) => s.selectedId)
  const terms = useApp((s) => s.result?.highlightTerms ?? NO_TERMS)
  const view = useApp((s) => s.bodyView)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [detail])

  let content: React.ReactNode
  if (selectedId === null) content = <NoSelection />
  else if (detailState === 'error') content = <LoadError />
  else if (!detail || (detailState === 'loading' && detail.ref.id !== selectedId))
    content = (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-fg-muted">
        <Spinner /> {t('loadingMessage')}
      </div>
    )
  else content = <MessageView key={detail.ref.id} detail={detail} terms={terms} view={view} scrollContainer={scroller} />

  return (
    <section aria-label={detail?.subject || t('noSelection')} className="flex min-w-0 flex-1 flex-col border-l border-line bg-surface">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {content}
      </div>
    </section>
  )
}

function NoSelection() {
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  return (
    <div className="flex h-full animate-fade-in flex-col items-center justify-center px-10 pb-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-[20px] bg-fill text-fg-subtle">
        <MailOpen className="size-8" strokeWidth={1.4} />
      </div>
      <div className="mt-4 text-[16px] font-semibold">{t('noSelection')}</div>
      <p className="mt-1 max-w-[300px] text-[13px] leading-relaxed text-fg-muted">{t('noSelectionHint')}</p>
      <div className="mt-6 grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-2 text-[12px] text-fg-muted">
        <span className="flex justify-end gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </span>
        <span className="text-left">
          {t('previousMessage')} / {t('nextMessage')}
        </span>
        <span className="flex justify-end gap-1">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>F</Kbd>
        </span>
        <span className="text-left">{t('shortcutSearch')}</span>
        <span className="flex justify-end gap-1">
          <Kbd>{isMac ? '⌥⌘' : 'Ctrl+Alt'}</Kbd>
          <Kbd>F</Kbd>
        </span>
        <span className="text-left">{t('filters')}</span>
      </div>
    </div>
  )
}

function LoadError() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 pb-12 text-center">
      <CircleAlert className="size-8 text-danger" strokeWidth={1.6} />
      <div className="mt-3 text-[14px] font-semibold">{t('messageError')}</div>
      <Button size="sm" className="mt-4" onClick={() => useApp.getState().reloadDetail()}>
        {t('retry')}
      </Button>
    </div>
  )
}
