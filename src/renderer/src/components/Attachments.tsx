import clsx from 'clsx'
import { Download, ExternalLink, Eye, Mail, ScanEye } from 'lucide-react'
import { useRef, useState } from 'react'
import type { AttachmentInfo, MessageRef } from '@shared/types'
import { t, tp } from '@/i18n'
import { formatSize } from '@/lib/format'
import { useApp } from '@/store'
import { Button } from './ui/Button'
import { Menu, type MenuEntry } from './ui/Overlay'

const TYPE_COLORS: [RegExp, string, string][] = [
  [/\.pdf$/i, '#e5484d', 'PDF'],
  [/\.(docx?|docm|dotx?|odt|rtf|pages)$/i, '#2f6fe4', 'DOC'],
  [/\.(xlsx?|xlsm|xlsb|csv|ods|numbers)$/i, '#1f9d55', 'XLS'],
  [/\.(pptx?|pptm|ppsx?|odp|key)$/i, '#e8590c', 'PPT'],
  [/\.(png|jpe?g|gif|bmp|tiff?|webp|heic|svg)$/i, '#8e4ec6', 'IMG'],
  [/\.(zip|rar|7z|gz|tgz|tar|bz2)$/i, '#9a6b2f', 'ZIP'],
  [/\.(ics|vcs)$/i, '#d6409f', 'ICS'],
  [/\.(vcf)$/i, '#0f9d9a', 'VCF'],
  [/\.(txt|log|md)$/i, '#6b7280', 'TXT'],
  [/\.(eml|msg)$/i, '#0a84ff', 'MAIL']
]

export function FileBadge({ name, className }: { name: string; className?: string }) {
  const match = TYPE_COLORS.find(([pattern]) => pattern.test(name))
  const ext = match ? match[2] : (/\.([a-z0-9]{1,4})$/i.exec(name)?.[1] ?? 'FILE').toUpperCase()
  const color = match ? match[1] : '#8e8e93'
  return (
    <div className={clsx('relative flex h-9 w-8 shrink-0 items-end justify-center rounded-[7px] pb-1', className)} style={{ background: `${color}1f` }} aria-hidden>
      <span className="text-[8.5px] font-bold tracking-wide" style={{ color }}>
        {ext.slice(0, 4)}
      </span>
      <span className="absolute top-0 right-0 size-2.5 rounded-tr-[7px] rounded-bl-[4px]" style={{ background: `${color}55` }} />
    </div>
  )
}

export function AttachmentBar({ refValue, attachments }: { refValue: MessageRef; attachments: AttachmentInfo[] }) {
  const visible = attachments.filter((a) => !a.isInline)
  const saveAttachments = useApp((s) => s.saveAttachments)
  if (visible.length === 0) return null

  return (
    <section aria-label={tp('attachments', visible.length)} className="mx-8 mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-fg-muted">{tp('attachments', visible.length)}</span>
        {visible.length > 1 && (
          <Button variant="ghost" size="sm" icon={Download} className="ml-auto text-accent" onClick={() => void saveAttachments(refValue)}>
            {t('saveAll')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((attachment) => (
          <AttachmentCard key={attachment.index} refValue={refValue} attachment={attachment} all={attachments} />
        ))}
      </div>
    </section>
  )
}

function AttachmentCard({ refValue, attachment, all }: { refValue: MessageRef; attachment: AttachmentInfo; all: AttachmentInfo[] }) {
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  const { showAttachment, openAttachment, quickLookAttachment, saveAttachment } = useApp.getState()
  const [menuOpen, setMenuOpen] = useState(false)
  const card = useRef<HTMLDivElement>(null)

  const show = (): void => showAttachment(refValue, attachment, all)
  const items: MenuEntry[] = attachment.isMessage
    ? [
        { label: t('openAttachedMessage'), icon: Mail, onSelect: show },
        { label: t('saveAs'), icon: Download, onSelect: () => void saveAttachment(refValue, attachment.index) }
      ]
    : [
        { label: t('preview'), icon: ScanEye, onSelect: show },
        { label: t('openWithApp'), icon: ExternalLink, onSelect: () => void openAttachment(refValue, attachment.index) },
        ...(isMac ? [{ label: t('quickLook'), icon: Eye, onSelect: () => void quickLookAttachment(refValue, attachment.index) }] : []),
        'separator',
        { label: t('saveAs'), icon: Download, onSelect: () => void saveAttachment(refValue, attachment.index) }
      ]

  return (
    <div
      ref={card}
      className="group relative flex h-[52px] max-w-[300px] min-w-[190px] items-stretch rounded-xl border border-line bg-surface-raised shadow-card transition-colors hover:border-line-strong"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuOpen(true)
      }}
    >
      <button
        type="button"
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === ' ') {
            // Space opens the preview, like Quick Look.
            event.preventDefault()
            show()
          }
        }}
        title={`${attachment.name}\n${attachment.isMessage ? t('openAttachedMessage') : t('preview')}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-2 pr-2 pl-2 text-left hover:bg-hover"
      >
        {attachment.isMessage ? (
          <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-[7px] bg-accent/12 text-accent">
            <Mail className="size-4" strokeWidth={2} />
          </div>
        ) : (
          <FileBadge name={attachment.name} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium">{attachment.name}</div>
          <div className="text-[11px] text-fg-muted">{attachment.isMessage ? t('attachedMessage') : formatSize(attachment.size)}</div>
        </div>
      </button>
      <div className="flex items-center gap-0.5 pr-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {!attachment.isMessage && (
          <CardAction icon={ExternalLink} label={t('openWithApp')} onClick={() => void openAttachment(refValue, attachment.index)} />
        )}
        <CardAction icon={Download} label={t('saveAs')} onClick={() => void saveAttachment(refValue, attachment.index)} />
      </div>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={card} items={items} placement="bottom-start" label={attachment.name} />
    </div>
  )
}

function CardAction({ icon: Icon, label, onClick }: { icon: typeof Download; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-lg text-fg-muted hover:bg-fill hover:text-fg"
    >
      <Icon className="size-4" strokeWidth={2} />
    </button>
  )
}
