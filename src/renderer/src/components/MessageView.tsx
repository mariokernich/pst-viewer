import clsx from 'clsx'
import { AtSign, Calendar, Copy, Flag, KeyRound, ListTodo, MapPin, Repeat, Search, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { MessageDetail, Recipient } from '@shared/types'
import { kindLabel, messages, t } from '@/i18n'
import { folderName } from '@/lib/folders'
import { formatDate, formatFullDate, formatRange, formatSize } from '@/lib/format'
import { refKey, useApp } from '@/store'
import { AttachmentBar } from './Attachments'
import { Avatar } from './Avatar'
import { HtmlBody, TextBody } from './MessageBody'
import { Highlight } from './Highlight'
import { Menu, type MenuEntry } from './ui/Overlay'

interface MessageViewProps {
  detail: MessageDetail
  terms: readonly string[]
  view: 'html' | 'text'
  scrollContainer: React.RefObject<HTMLElement | null>
}

/** Header, attachments and body of a message. Used by the reading pane and the attachment viewer. */
export function MessageView({ detail, terms, view, scrollContainer }: MessageViewProps) {
  const remoteAllowed = useApp((s) => s.remoteAllowed.has(refKey(detail.ref)))
  const allowRemote = useApp((s) => s.allowRemote)
  const [hoverUrl, setHoverUrl] = useState<string | null>(null)
  const onHoverLink = useCallback((url: string | null) => setHoverUrl(url), [])

  // Calendar items and drafts often carry an empty HTML skeleton.
  const htmlHasContent = detail.html !== null && (detail.text.trim() !== '' || /<img\b/i.test(detail.html))
  const showHtml = htmlHasContent && view === 'html'

  return (
    <article className="@container animate-fade-in">
      <MessageHeader detail={detail} terms={terms} />
      {detail.appointment && <AppointmentCard detail={detail} />}
      {detail.task && <TaskCard detail={detail} />}
      {detail.contact && detail.contact.length > 0 && <ContactCard detail={detail} />}
      {detail.security === 'encrypted' && !detail.html && !detail.text && (
        <div className="mx-8 mb-5 flex items-start gap-3 rounded-xl border border-line bg-surface-sunken p-3.5 text-[12.5px] text-fg-muted">
          <KeyRound className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {t('encryptedHint')}
        </div>
      )}
      <AttachmentBar refValue={detail.ref} attachments={detail.attachments} />
      {showHtml ? (
        <HtmlBody
          html={detail.html!}
          inlineImages={detail.inlineImages}
          allowRemote={remoteAllowed}
          onAllowRemote={() => void allowRemote(detail.ref)}
          terms={terms}
          scrollContainer={scrollContainer}
          onHoverLink={onHoverLink}
        />
      ) : detail.text.trim() ? (
        <TextBody text={detail.text} terms={terms} onHoverLink={onHoverLink} />
      ) : (
        (detail.kind === 'mail' || detail.kind === 'meeting') && <p className="mx-8 mb-10 text-[13px] text-fg-subtle italic">{t('bodyEmpty')}</p>
      )}
      {hoverUrl && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 max-w-[60vw] -translate-x-1/2 animate-fade-in truncate rounded-lg border border-line bg-surface-raised/95 px-2.5 py-1 text-[11.5px] text-fg-muted shadow-popover backdrop-blur-xl">
          {hoverUrl}
        </div>
      )}
    </article>
  )
}

function MessageHeader({ detail, terms }: { detail: MessageDetail; terms: readonly string[] }) {
  const folder = useApp((s) => (detail.folderId !== null ? s.folderInfo.get(detail.folderId)?.node : undefined))
  const to = detail.recipients.filter((r) => r.type === 'to')
  const cc = detail.recipients.filter((r) => r.type === 'cc')
  const bcc = detail.recipients.filter((r) => r.type === 'bcc')
  const isAppointment = detail.kind === 'appointment'

  return (
    <header className="px-8 pt-6 pb-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {detail.kind !== 'mail' && <Badge>{kindLabel(detail.kind, true)}</Badge>}
        {folder && <Badge>{folderName(folder)}</Badge>}
        {detail.importance === 2 && (
          <Badge tone="danger" icon={TriangleAlert}>
            {t('importanceHigh')}
          </Badge>
        )}
        {detail.flagged && (
          <Badge tone="danger" icon={Flag}>
            {t('flagged')}
          </Badge>
        )}
        {detail.security === 'signed' && (
          <Badge tone="success" icon={ShieldCheck}>
            {t('signed')}
          </Badge>
        )}
        {detail.security === 'encrypted' && <Badge icon={KeyRound}>{t('encrypted')}</Badge>}
        {detail.categories.map((c) => (
          <Badge key={c} tone="accent">
            {c}
          </Badge>
        ))}
      </div>
      <h1 className="selectable mt-2 text-[22px] leading-[1.25] font-bold tracking-tight break-words">
        {detail.subject ? <Highlight text={detail.subject} terms={terms} /> : <span className="text-fg-subtle italic">{t('noSubject')}</span>}
      </h1>

      {!isAppointment && detail.kind !== 'contact' && (
        <div className="mt-4 flex flex-wrap items-start gap-3 @[620px]:flex-nowrap">
          <Avatar name={detail.from.name} email={detail.from.email} size={40} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Person person={{ name: detail.from.name, email: detail.from.email, type: 'to' }} terms={terms} strong />
              {detail.from.email && detail.from.email !== detail.from.name && (
                <span className="selectable truncate text-[12.5px] text-fg-muted">
                  <Highlight text={detail.from.email} terms={terms} />
                </span>
              )}
            </div>
            {detail.sender && (
              <div className="mt-0.5 text-[12px] text-fg-muted">
                {t('onBehalfOf', { sender: detail.sender.name || detail.sender.email, from: detail.from.name || detail.from.email })}
              </div>
            )}
            <RecipientLine label={t('to')} people={to} terms={terms} />
            <RecipientLine label={t('cc')} people={cc} terms={terms} />
            <RecipientLine label={t('bcc')} people={bcc} terms={terms} />
            {detail.replyTo && detail.replyTo !== detail.from.name && (
              <div className="mt-1 flex gap-2 text-[12.5px]">
                <span className="shrink-0 text-fg-muted">{t('replyTo')}</span>
                <span className="selectable min-w-0 truncate">{detail.replyTo}</span>
              </div>
            )}
          </div>
          <div className="w-full shrink-0 pl-[52px] text-[12px] leading-relaxed text-fg-muted @[620px]:w-auto @[620px]:pt-0.5 @[620px]:pl-0 @[620px]:text-right">
            <span className="selectable">{formatFullDate(detail.date)}</span>
            {detail.size > 0 && (
              <span className="text-fg-subtle">
                <span className="@[620px]:hidden"> · </span>
                <span className="@[620px]:block">{formatSize(detail.size)}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function Badge({ children, tone = 'neutral', icon: Icon }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'success' | 'accent'; icon?: typeof Flag }) {
  return (
    <span
      className={clsx(
        'inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium',
        tone === 'neutral' && 'bg-fill text-fg-muted',
        tone === 'danger' && 'bg-danger/12 text-danger',
        tone === 'success' && 'bg-success/14 text-success',
        tone === 'accent' && 'bg-accent/14 text-accent'
      )}
    >
      {Icon && <Icon className="size-3" strokeWidth={2.4} />}
      {children}
    </span>
  )
}

const COLLAPSED_RECIPIENTS = 4

function RecipientLine({ label, people, terms }: { label: string; people: Recipient[]; terms: readonly string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (people.length === 0) return null
  const shown = expanded ? people : people.slice(0, COLLAPSED_RECIPIENTS)
  const hidden = people.length - shown.length
  return (
    <div className="mt-1 flex gap-2 text-[12.5px]">
      <span className="min-w-7 shrink-0 text-fg-muted">{label}</span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {shown.map((p, i) => (
          <span key={`${p.email}-${i}`}>
            <Person person={p} terms={terms} />
            {i < shown.length - 1 && <span className="text-fg-subtle">, </span>}
          </span>
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="ml-1.5 font-medium text-accent hover:underline">
            {t('moreRecipients', { count: hidden })}
          </button>
        )}
        {expanded && people.length > COLLAPSED_RECIPIENTS && (
          <button type="button" onClick={() => setExpanded(false)} className="ml-1.5 font-medium text-accent hover:underline">
            {t('showLess')}
          </button>
        )}
      </div>
    </div>
  )
}

/** A clickable person with shortcuts to search for their messages. */
function Person({ person, terms, strong }: { person: Recipient; terms: readonly string[]; strong?: boolean }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const label = person.name || person.email
  const key = person.email || person.name
  const items: MenuEntry[] = [
    { heading: person.email && person.email !== label ? `${label} <${person.email}>` : label },
    {
      label: `${t('suggestionFrom', { name: label })}`,
      icon: Search,
      onSelect: () => {
        useApp.getState().setQuery('')
        useApp.getState().setScope('all')
        useApp.getState().setFilters({ from: key, to: '' })
      }
    },
    {
      label: t('chipTo', { value: label }),
      icon: AtSign,
      onSelect: () => {
        useApp.getState().setQuery('')
        useApp.getState().setScope('all')
        useApp.getState().setFilters({ to: key, from: '' })
      }
    },
    ...(person.email
      ? [
          'separator' as const,
          {
            label: t('copy'),
            icon: Copy,
            onSelect: () => {
              void navigator.clipboard.writeText(person.email).then(() => useApp.getState().showToast({ message: t('copied'), tone: 'success' }))
            }
          }
        ]
      : [])
  ]
  return (
    <>
      <button
        ref={anchor}
        type="button"
        title={person.email || undefined}
        onClick={() => setOpen((o) => !o)}
        className={clsx('rounded px-0.5 -mx-0.5 text-left hover:bg-hover', strong ? 'text-[14px] font-semibold' : 'text-fg')}
      >
        <Highlight text={label} terms={terms} />
      </button>
      <Menu open={open} onClose={() => setOpen(false)} anchor={anchor} items={items} placement="bottom-start" label={label} />
    </>
  )
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div className="mx-8 mb-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-sunken p-4 text-[13px]">{children}</div>
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2 text-fg-muted">
        <Icon className="size-4" strokeWidth={1.9} />
        <span className="text-[12px]">{label}</span>
      </div>
      <div className="selectable min-w-0 break-words">{children}</div>
    </>
  )
}

function AppointmentCard({ detail }: { detail: MessageDetail }) {
  const a = detail.appointment!
  if (!a.start && !a.location && !a.attendees) return null
  return (
    <InfoCard>
      {a.start && (
        <InfoRow icon={Calendar} label={t('when')}>
          {formatRange(a.start, a.end, a.isAllDay)}
          {a.isAllDay && <span className="ml-2 text-fg-muted">({t('allDay')})</span>}
        </InfoRow>
      )}
      {a.location && (
        <InfoRow icon={MapPin} label={t('where')}>
          {a.location}
        </InfoRow>
      )}
      {a.isRecurring && (
        <InfoRow icon={Repeat} label={t('recurring')}>
          {a.recurrence || '—'}
        </InfoRow>
      )}
      {a.attendees && (
        <InfoRow icon={Users} label={t('attendees')}>
          {a.attendees}
        </InfoRow>
      )}
    </InfoCard>
  )
}

function TaskCard({ detail }: { detail: MessageDetail }) {
  const task = detail.task!
  const statuses = messages().taskStatusValues
  return (
    <InfoCard>
      <InfoRow icon={ListTodo} label={t('taskStatus')}>
        {statuses[task.status] ?? '—'} · {t('percentComplete', { value: Math.round(task.percentComplete * 100) })}
      </InfoRow>
      {task.startDate && (
        <InfoRow icon={Calendar} label={t('taskStart')}>
          {formatDate(task.startDate)}
        </InfoRow>
      )}
      {task.dueDate && (
        <InfoRow icon={Calendar} label={t('taskDue')}>
          {formatDate(task.dueDate)}
        </InfoRow>
      )}
      {task.owner && (
        <InfoRow icon={Users} label={t('taskOwner')}>
          {task.owner}
        </InfoRow>
      )}
    </InfoCard>
  )
}

function ContactCard({ detail }: { detail: MessageDetail }) {
  return (
    <div className="mx-8 mb-5 grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 rounded-xl border border-line bg-surface-sunken p-4 text-[13px]">
      {detail.contact!.map((field) => (
        <div key={field.key} className="contents">
          <div className="text-[12px] text-fg-muted">{t(`contact_${field.key}` as 'contact_company')}</div>
          <div className="selectable min-w-0 break-words whitespace-pre-line">
            {field.key === 'birthday' || field.key === 'anniversary' ? formatDate(new Date(field.value).getTime()) : field.value}
          </div>
        </div>
      ))}
    </div>
  )
}
