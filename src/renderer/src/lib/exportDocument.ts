import type { MessageDetail, Recipient } from '@shared/types'
import { kindLabel, locale, messages, t } from '@/i18n'
import { escapeAttribute, mailCsp, sanitizeMail } from './emailHtml'
import { formatDate, formatFullDate, formatRange, formatSize } from './format'
import { displayAddress } from './people'

/**
 * Builds the documents for exporting and printing a single message: a
 * self-contained, sanitised HTML page (rendered to PDF by the main process)
 * and a plain text version.
 */

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function people(list: Recipient[]): string {
  return list.map((r) => displayAddress(r.name, r.email)).join(', ')
}

interface HeaderRow {
  label: string
  value: string
}

function headerRows(detail: MessageDetail, folderName?: string): HeaderRow[] {
  const rows: HeaderRow[] = []
  const add = (label: string, value: string | null | undefined): void => {
    if (value && value.trim()) rows.push({ label, value: value.trim() })
  }
  if (detail.kind === 'contact') {
    for (const field of detail.contact ?? []) {
      const value = field.key === 'birthday' || field.key === 'anniversary' ? formatDate(new Date(field.value).getTime()) : field.value
      add(t(`contact_${field.key}` as 'contact_company'), value)
    }
    return rows
  }
  if (detail.appointment?.start) add(t('when'), formatRange(detail.appointment.start, detail.appointment.end, detail.appointment.isAllDay))
  if (detail.appointment) add(t('where'), detail.appointment.location)
  if (detail.appointment?.isRecurring) add(t('recurring'), detail.appointment.recurrence || '—')
  if (detail.appointment) add(t('attendees'), detail.appointment.attendees)
  if (detail.kind !== 'appointment') {
    add(t('from'), displayAddress(detail.from.name, detail.from.email))
    if (detail.sender) add('', t('onBehalfOf', { sender: detail.sender.name || detail.sender.email, from: detail.from.name || detail.from.email }))
    add(t('to'), people(detail.recipients.filter((r) => r.type === 'to')))
    add(t('cc'), people(detail.recipients.filter((r) => r.type === 'cc')))
    add(t('bcc'), people(detail.recipients.filter((r) => r.type === 'bcc')))
    add(t('replyTo'), detail.replyTo)
    add(t('dateLabel'), formatFullDate(detail.date))
  }
  if (detail.task) {
    add(t('taskStatus'), messages().taskStatusValues[detail.task.status] ?? '')
    add(t('taskDue'), formatDate(detail.task.dueDate))
  }
  if (detail.kind !== 'mail') add(t('typeLabel'), kindLabel(detail.kind, true))
  add(t('folder'), folderName)
  const files = detail.attachments.filter((a) => !a.isInline)
  add(t('attachmentsLabel'), files.map((a) => (a.isMessage ? a.name : `${a.name} (${formatSize(a.size)})`)).join(', '))
  return rows
}

const PRINT_CSS = `
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 10.5pt/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1d1d1f; background: #fff; overflow-wrap: break-word; }
img { max-width: 100%; }
img:not([height]) { height: auto; }
pre { white-space: pre-wrap; }
table { max-width: 100%; }
blockquote[type="cite"] { margin: 0 0 0 0.8ex; border-left: 2px solid #c7c7cc; padding-left: 1ex; color: #48484a; }
`

/** A complete, sanitised HTML document of a message for PDF export and printing. */
export function buildPrintHtml(detail: MessageDetail, options: { allowRemote: boolean; folderName?: string }): string {
  const rows = headerRows(detail, options.folderName)
  const head = `
<header style="margin:0 0 14pt;padding:0;font:10pt/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
  <h1 style="margin:0 0 9pt;padding:0;font-size:16pt;line-height:1.25;font-weight:700;color:#1d1d1f;letter-spacing:-0.01em">${escapeHtml(detail.subject || t('noSubject'))}</h1>
  <table style="border-collapse:collapse;border:0;margin:0;width:100%;font-size:9.5pt;line-height:1.45">${rows
    .map(
      (r) =>
        `<tr><th style="text-align:left;vertical-align:top;padding:1.5pt 12pt 1.5pt 0;width:1%;white-space:nowrap;font-weight:500;color:#6e6e73;border:0">${escapeHtml(r.label)}</th><td style="padding:1.5pt 0;border:0;color:#1d1d1f">${escapeHtml(r.value)}</td></tr>`
    )
    .join('')}</table>
  <div style="height:0;border-top:0.75pt solid #d2d2d7;margin:12pt 0 0"></div>
</header>`

  let body: string
  let styles = ''
  if (detail.html && (detail.text.trim() || /<img\b/i.test(detail.html))) {
    const mail = sanitizeMail(detail.html, detail.inlineImages, options.allowRemote)
    styles = mail.styles.map((css) => `<style>${css}</style>`).join('')
    body = `<div class="pst-mail-body" ${mail.bodyAttributes}>${mail.body}</div>`
  } else if (detail.text.trim()) {
    body = `<div style="white-space:pre-wrap;font:10.5pt/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${escapeHtml(detail.text)}</div>`
  } else {
    body = ''
  }

  return `<!doctype html><html lang="${locale()}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(mailCsp(options.allowRemote))}"><title>${escapeHtml(detail.subject || '')}</title><style>${PRINT_CSS}</style>${styles}</head><body>${head}${body}</body></html>`
}

/** Plain text version of a message with its header fields. */
export function buildExportText(detail: MessageDetail, folderName?: string): string {
  const rows = headerRows(detail, folderName)
  const width = Math.max(...rows.map((r) => r.label.length), t('subjectLabel').length)
  const line = (label: string, value: string): string => `${label ? `${label}:`.padEnd(width + 2) : ' '.repeat(width + 2)}${value}`
  const header = [line(t('subjectLabel'), detail.subject || t('noSubject')), ...rows.map((r) => line(r.label, r.value))].join('\n')
  return `${header}\n\n${'-'.repeat(60)}\n\n${detail.text.trim()}\n`
}

/** Suggested file name (without extension), e.g. "2026-01-26 Quarterly report". */
export function exportBaseName(detail: MessageDetail): string {
  const date = detail.date ? new Date(detail.date) : null
  const iso = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ` : ''
  const subject = (detail.subject || t('noSubject').replace(/[()]/g, ''))
    .replace(/\s*:\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${iso}${subject}`.slice(0, 120)
}
