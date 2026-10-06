import clsx from 'clsx'
import { Calendar, ChevronLeft, ChevronRight, Code, Download, Eye, ExternalLink, MapPin, Repeat, ShieldAlert, TriangleAlert, User, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AttachmentPreview as PreviewData } from '@shared/types'
import { errorMessage, t } from '@/i18n'
import { parseCalendar, parseContacts, type CalendarPerson, type ContactCard } from '@/lib/calendarCard'
import { formatDate, formatRange, formatSize } from '@/lib/format'
import { avatarGradient, displayAddress, initials } from '@/lib/people'
import { useApp } from '@/store'
import { FileBadge } from './Attachments'
import { HtmlBody } from './MessageBody'
import { Button, IconButton } from './ui/Button'
import { Spinner } from './ui/Controls'
import { Dialog } from './ui/Overlay'

const MAX_TEXT_BYTES = 2 * 1024 * 1024
const MAX_CSV_ROWS = 2000

/** Quick Look style viewer for attachments. */
export function AttachmentPreviewDialog() {
  const preview = useApp((s) => s.preview)
  const closePreview = useApp((s) => s.closePreview)
  const stepPreview = useApp((s) => s.stepPreview)
  const item = preview ? preview.items[preview.position] : undefined

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      stepPreview(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      stepPreview(1)
    }
  }

  return (
    <Dialog
      open={!!preview}
      onClose={closePreview}
      closeLabel={t('close')}
      className="h-[90vh] w-[min(1180px,95vw)]"
      title={
        item ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <FileBadge name={item.name} className="h-7 w-6 scale-90" />
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="shrink-0 text-[12px] font-normal text-fg-muted">{formatSize(item.size)}</span>
          </span>
        ) : (
          ''
        )
      }
      actions={preview && item ? <PreviewActions /> : null}
      onKeyDown={onKeyDown}
    >
      <div className="flex h-full flex-col bg-surface-sunken">
        {preview?.error ? (
          <Message icon={TriangleAlert} title={t('previewFailed')} text={errorMessage(preview.error)} />
        ) : !preview?.data ? (
          <div className="flex flex-1 items-center justify-center text-fg-muted">
            <Spinner className="size-5" />
          </div>
        ) : (
          <PreviewBody key={preview.data.url} data={preview.data} />
        )}
      </div>
    </Dialog>
  )
}

function PreviewActions() {
  const preview = useApp((s) => s.preview)!
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  const { stepPreview, openAttachment, quickLookAttachment, saveAttachment } = useApp.getState()
  const item = preview.items[preview.position]
  const data = preview.data
  return (
    <div className="flex items-center gap-1">
      {preview.items.length > 1 && (
        <div className="mr-2 flex items-center gap-0.5">
          <IconButton icon={ChevronLeft} size="sm" label={t('previousAttachment')} onClick={() => stepPreview(-1)} />
          <span className="min-w-[52px] text-center text-[12px] text-fg-muted tabular-nums">
            {t('attachmentPosition', { index: preview.position + 1, count: preview.items.length })}
          </span>
          <IconButton icon={ChevronRight} size="sm" label={t('nextAttachment')} onClick={() => stepPreview(1)} />
        </div>
      )}
      {isMac && data?.kind === 'none' && <IconButton icon={Eye} label={t('quickLook')} onClick={() => void quickLookAttachment(preview.ref, item.index)} />}
      {data?.canOpen !== false && (
        <Button size="sm" icon={ExternalLink} onClick={() => void openAttachment(preview.ref, item.index)} disabled={!data}>
          {t('openWithApp')}
        </Button>
      )}
      <Button size="sm" icon={Download} onClick={() => void saveAttachment(preview.ref, item.index)}>
        {t('saveAs')}
      </Button>
    </div>
  )
}

function PreviewBody({ data }: { data: PreviewData }) {
  switch (data.kind) {
    case 'pdf':
      return <iframe src={data.url} title={data.fileName} className="min-h-0 w-full flex-1 border-0 bg-surface-sunken" />
    case 'image':
      return <ImagePreview data={data} />
    case 'audio':
      return (
        <div className="flex flex-1 items-center justify-center p-10">
          <audio controls src={data.url} className="w-[min(560px,100%)]" />
        </div>
      )
    case 'video':
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-4">
          <video controls src={data.url} className="max-h-full max-w-full" />
        </div>
      )
    case 'text':
    case 'csv':
    case 'html':
    case 'calendar':
    case 'contact':
      return <TextualPreview data={data} />
    default:
      return <NoPreview data={data} />
  }
}

function ImagePreview({ data }: { data: PreviewData }) {
  const [actualSize, setActualSize] = useState(false)
  return (
    <div className={clsx('min-h-0 flex-1 overflow-auto', !actualSize && 'flex items-center justify-center p-6')}>
      <img
        src={data.url}
        alt={data.fileName}
        onClick={() => setActualSize((v) => !v)}
        className={clsx(
          'bg-[repeating-conic-gradient(#e5e5ea_0_25%,#fff_0_50%)] bg-[length:16px_16px] shadow-card',
          actualSize ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'
        )}
      />
    </div>
  )
}

/** Loads a text based attachment through the preview protocol and decodes it. */
function useTextContent(url: string): { text: string | null; truncated: boolean; error: boolean } {
  const [state, setState] = useState<{ text: string | null; truncated: boolean; error: boolean }>({ text: null, truncated: false, error: false })
  useEffect(() => {
    let active = true
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!active) return
        const truncated = buffer.byteLength > MAX_TEXT_BYTES
        const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MAX_TEXT_BYTES))
        let text: string
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        } catch {
          // Legacy files are usually Windows-1252 encoded.
          text = new TextDecoder('windows-1252').decode(bytes)
        }
        setState({ text: text.replace(/^﻿/, ''), truncated, error: false })
      })
      .catch(() => active && setState({ text: null, truncated: false, error: true }))
    return () => {
      active = false
    }
  }, [url])
  return state
}

function TextualPreview({ data }: { data: PreviewData }) {
  const { text, truncated, error } = useTextContent(data.url)
  const scroller = useRef<HTMLDivElement>(null)
  const noop = useCallback(() => undefined, [])
  if (error) return <Message icon={TriangleAlert} title={t('previewFailed')} />
  if (text === null)
    return (
      <div className="flex flex-1 items-center justify-center text-fg-muted">
        <Spinner className="size-5" />
      </div>
    )
  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
      {truncated && <div className="sticky top-0 z-10 bg-warning/15 px-4 py-1.5 text-[12px] text-fg">{t('previewTruncated', { size: formatSize(MAX_TEXT_BYTES) })}</div>}
      {data.kind === 'csv' ? (
        <CsvTable text={text} />
      ) : data.kind === 'calendar' ? (
        <WithSource text={text}>
          <CalendarCards text={text} />
        </WithSource>
      ) : data.kind === 'contact' ? (
        <WithSource text={text}>
          <ContactCards text={text} />
        </WithSource>
      ) : data.kind === 'html' ? (
        <div className="pt-6">
          <HtmlBody html={text} inlineImages={{}} allowRemote={false} onAllowRemote={noop} terms={[]} scrollContainer={scroller} onHoverLink={noop} />
        </div>
      ) : (
        <pre className="selectable m-0 p-6 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-fg">{text}</pre>
      )}
    </div>
  )
}

/** A structured view with a toggle to show the raw file. */
function WithSource({ text, children }: { text: string; children: React.ReactNode }) {
  const [source, setSource] = useState(false)
  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      {children}
      <Button variant="ghost" size="sm" icon={Code} className="mt-4 text-fg-muted" onClick={() => setSource((v) => !v)}>
        {source ? t('hideSource') : t('showSource')}
      </Button>
      {source && <pre className="selectable mt-2 overflow-auto rounded-xl bg-surface p-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap shadow-card">{text}</pre>}
    </div>
  )
}

function CalendarCards({ text }: { text: string }) {
  const calendar = useMemo(() => parseCalendar(text), [text])
  if (calendar.events.length === 0) return <p className="text-[13px] text-fg-muted">{t('noEvents')}</p>
  const method = calendar.method && ['REQUEST', 'CANCEL', 'REPLY', 'PUBLISH'].includes(calendar.method) ? t(`method_${calendar.method}` as 'method_REQUEST') : ''
  return (
    <div className="flex flex-col gap-4">
      {calendar.events.map((event, i) => (
        <article key={i} className="selectable rounded-2xl bg-surface p-5 shadow-card">
          {method && (
            <span className={clsx('mb-2 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold', calendar.method === 'CANCEL' ? 'bg-danger/12 text-danger' : 'bg-accent/12 text-accent')}>
              {method}
            </span>
          )}
          <h3 className={clsx('text-[18px] leading-snug font-bold', calendar.method === 'CANCEL' && 'line-through decoration-danger/60')}>{event.summary || '—'}</h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
            {event.start && (
              <Row icon={Calendar}>
                {formatRange(event.start.time, event.end?.time ?? null, event.start.allDay)}
                {event.start.zone && <span className="ml-1.5 text-fg-muted">({event.start.zone})</span>}
              </Row>
            )}
            {event.recurring && <Row icon={Repeat}>{t('recurring')}</Row>}
            {event.location && <Row icon={MapPin}>{event.location}</Row>}
            {event.organizer && (
              <Row icon={User}>
                <span className="text-fg-muted">{t('organizer')}: </span>
                {displayAddress(event.organizer.name, event.organizer.email)}
              </Row>
            )}
            {event.attendees.length > 0 && (
              <Row icon={Users}>
                {event.attendees.map((a, j) => (
                  <Attendee key={j} person={a} />
                ))}
              </Row>
            )}
          </dl>
          {event.description && <p className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed whitespace-pre-wrap text-fg">{event.description}</p>}
        </article>
      ))}
    </div>
  )
}

function Row({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-fg-muted">
        <Icon className="size-4" strokeWidth={1.9} />
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

function Attendee({ person }: { person: CalendarPerson }) {
  const status = person.status?.toUpperCase().replace('-', '_')
  const label = status && ['ACCEPTED', 'DECLINED', 'TENTATIVE', 'NEEDS_ACTION'].includes(status) ? t(`partstat_${status}` as 'partstat_ACCEPTED') : ''
  return (
    <div>
      {displayAddress(person.name, person.email)}
      {label && <span className="ml-1.5 text-[12px] text-fg-muted">· {label}</span>}
    </div>
  )
}

function ContactCards({ text }: { text: string }) {
  const contacts = useMemo(() => parseContacts(text), [text])
  if (contacts.length === 0) return <p className="text-[13px] text-fg-muted">{t('noContacts')}</p>
  return (
    <div className="flex flex-col gap-4">
      {contacts.map((contact, i) => (
        <ContactCardView key={i} contact={contact} />
      ))}
    </div>
  )
}

function ContactCardView({ contact }: { contact: ContactCard }) {
  return (
    <article className="selectable rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center gap-4">
        {contact.photo ? (
          <img src={contact.photo} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full text-[22px] font-semibold text-white" style={{ background: avatarGradient(contact.name) }}>
            {initials(contact.name)}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[18px] font-bold">{contact.name || '—'}</h3>
          {(contact.title || contact.organization) && <div className="text-[13px] text-fg-muted">{[contact.title, contact.organization].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
      {contact.fields.length > 0 && (
        <dl className="mt-4 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-[13px]">
          {contact.fields.map((field, i) => (
            <div key={i} className="contents">
              <dt className="text-fg-muted">
                {t(`vcard_${field.kind}`)}
                {field.label && <span className="text-fg-subtle"> ({field.label})</span>}
              </dt>
              <dd className="min-w-0 break-words whitespace-pre-line">{field.kind === 'birthday' ? formatBirthday(field.value) : field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

function formatBirthday(value: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value)
  return m ? formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()) : value
}

/** Splits CSV/TSV text into rows, honouring quoted fields. */
function parseCsv(text: string, limit: number): { rows: string[][]; more: boolean } {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'))
  const delimiter = ['\t', ';', ','].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (rows.length >= limit) return { rows, more: i < text.length - 1 }
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return { rows, more: false }
}

function CsvTable({ text }: { text: string }) {
  const { rows, more } = useMemo(() => parseCsv(text, MAX_CSV_ROWS), [text])
  if (rows.length === 0) return null
  const [head, ...body] = rows
  return (
    <div className="selectable p-4">
      <table className="border-collapse bg-surface text-[12px] shadow-card">
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} className="sticky top-0 border border-line bg-surface-raised px-2.5 py-1.5 text-left font-semibold whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="even:bg-fill/40">
              {row.map((cell, c) => (
                <td key={c} className="max-w-[420px] border border-line px-2.5 py-1 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {more && <p className="mt-2 text-[12px] text-fg-muted">{t('previewTruncated', { size: `${MAX_CSV_ROWS}` })}</p>}
    </div>
  )
}

function NoPreview({ data }: { data: PreviewData }) {
  const preview = useApp((s) => s.preview)
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  const { openAttachment, quickLookAttachment, saveAttachment } = useApp.getState()
  if (!preview) return null
  const item = preview.items[preview.position]
  return (
    <div className="flex flex-1 animate-fade-in flex-col items-center justify-center px-10 pb-10 text-center">
      <FileBadge name={data.fileName} className="h-[74px] w-16 scale-[1.6]" />
      <div className="mt-8 max-w-[520px] truncate text-[16px] font-semibold">{data.fileName}</div>
      <div className="mt-1 text-[12.5px] text-fg-muted">
        {formatSize(data.size)} · {data.mimeType}
      </div>
      {data.canOpen ? (
        <>
          <p className="mt-4 max-w-[420px] text-[13px] leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">{t('noPreview')}.</span> {t('noPreviewHint')}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon={ExternalLink} onClick={() => void openAttachment(preview.ref, item.index)}>
              {t('openWithApp')}
            </Button>
            {isMac && (
              <Button icon={Eye} onClick={() => void quickLookAttachment(preview.ref, item.index)}>
                {t('quickLook')}
              </Button>
            )}
            <Button icon={Download} onClick={() => void saveAttachment(preview.ref, item.index)}>
              {t('saveAs')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-5 flex max-w-[460px] items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-left text-[12.5px] leading-relaxed">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
            {t('blockedType')}
          </div>
          <Button className="mt-5" icon={Download} onClick={() => void saveAttachment(preview.ref, item.index)}>
            {t('saveAs')}
          </Button>
        </>
      )}
    </div>
  )
}

function Message({ icon: Icon, title, text }: { icon: typeof TriangleAlert; title: string; text?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
      <Icon className="size-8 text-fg-subtle" strokeWidth={1.6} />
      <div className="mt-3 text-[14px] font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-[420px] text-[12.5px] text-fg-muted">{text}</p>}
    </div>
  )
}
