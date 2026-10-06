import { ArrowLeft, Check, Copy, CornerDownLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { messages, t } from '@/i18n'
import { useApp } from '@/store'
import { ExportMenu } from './ExportMenu'
import { MessageView } from './MessageView'
import { Button, IconButton } from './ui/Button'
import { Spinner } from './ui/Controls'
import { Dialog } from './ui/Overlay'

export function HeadersDialog() {
  const open = useApp((s) => s.headersOpen)
  const detail = useApp((s) => s.detail)
  const [copied, setCopied] = useState(false)
  const close = (): void => useApp.getState().setUi({ headersOpen: false })
  const headers = detail?.headers ?? ''

  return (
    <Dialog
      open={open && !!detail}
      onClose={close}
      title={t('headersTitle')}
      closeLabel={t('close')}
      className="w-[min(860px,92vw)]"
      actions={
        headers && (
          <Button
            size="sm"
            icon={copied ? Check : Copy}
            onClick={() => {
              void navigator.clipboard.writeText(headers).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? t('copied') : t('copy')}
          </Button>
        )
      }
    >
      {headers ? (
        <pre className="selectable p-5 font-mono text-[11.5px] leading-[1.6] break-all whitespace-pre-wrap text-fg">{headers}</pre>
      ) : (
        <p className="p-6 text-[13px] text-fg-muted">{t('noHeaders')}</p>
      )}
    </Dialog>
  )
}

export function SearchHelpDialog() {
  const open = useApp((s) => s.helpOpen)
  const screen = useApp((s) => s.screen)
  const close = (): void => useApp.getState().setUi({ helpOpen: false })
  const rows = messages().helpRows

  return (
    <Dialog open={open} onClose={close} title={t('helpTitle')} closeLabel={t('close')} className="w-[min(640px,92vw)]">
      <div className="p-5">
        <p className="text-[13px] leading-relaxed text-fg-muted">{t('helpIntro')}</p>
        {screen === 'mailbox' && <p className="mt-1 text-[12px] text-fg-subtle">{t('helpTry')}</p>}
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          {rows.map(([example, description]) => (
            <button
              key={example}
              type="button"
              disabled={screen !== 'mailbox'}
              onClick={() => {
                close()
                useApp.getState().setQuery(example, true)
                useApp.getState().commitQuery()
                useApp.getState().focusSearch()
              }}
              className="group flex w-full items-center gap-4 border-b border-line px-4 py-2.5 text-left last:border-b-0 enabled:hover:bg-hover"
            >
              <code className="w-[230px] shrink-0 font-mono text-[12px] text-accent">{example}</code>
              <span className="flex-1 text-[12.5px] text-fg-muted">{description}</span>
              <CornerDownLeft className="size-3.5 text-fg-subtle opacity-0 group-enabled:group-hover:opacity-100" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-fg-subtle">{t('helpEnglish')}</p>
      </div>
    </Dialog>
  )
}

const NO_TERMS: string[] = []

export function EmbeddedMessageDialog() {
  const stack = useApp((s) => s.embedded)
  const closeEmbedded = useApp((s) => s.closeEmbedded)
  const scroller = useRef<HTMLDivElement>(null)
  const top = stack[stack.length - 1]

  return (
    <Dialog
      open={stack.length > 0}
      onClose={() => closeEmbedded(true)}
      title={
        <span className="flex items-center gap-2">
          {stack.length > 1 && <IconButton icon={ArrowLeft} size="sm" label={t('close')} onClick={() => closeEmbedded()} />}
          <span className="truncate">{top?.detail?.subject || t('attachedMessage')}</span>
        </span>
      }
      closeLabel={t('close')}
      className="h-[86vh] w-[min(980px,94vw)]"
      actions={top?.detail ? <ExportMenu detail={top.detail} /> : null}
    >
      <div ref={scroller} className="h-full overflow-y-auto bg-surface">
        {top?.detail ? (
          <MessageView key={JSON.stringify(top.ref)} detail={top.detail} terms={NO_TERMS} view="html" scrollContainer={scroller} />
        ) : top?.error ? (
          <p className="p-8 text-center text-[13px] text-fg-muted">{t('messageError')}</p>
        ) : (
          <div className="flex h-60 items-center justify-center gap-2 text-[13px] text-fg-muted">
            <Spinner /> {t('loadingMessage')}
          </div>
        )}
      </div>
    </Dialog>
  )
}
