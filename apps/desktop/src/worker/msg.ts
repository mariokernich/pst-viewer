import * as msgReaderModule from '@kenjiuno/msgreader'
import type { default as MsgReaderClass, FieldsData } from '@kenjiuno/msgreader'
import * as iconv from 'iconv-lite'
import { decompressRTF } from '@kenjiuno/decompressrtf'
import { squash } from '../shared/text'
import type { AppointmentInfo, Recipient } from '../shared/types'
import type { ContentAttachment, MessageContent } from './content'
import { htmlToText, normalizeContentId, tidyText } from './html'
import { convertRtf } from './rtf'

/**
 * Outlook item files (.msg) via msgreader: body, recipients, attachments and
 * attached items.
 */

/**
 * msgreader is a CommonJS module with a default export; depending on the
 * bundler the class arrives as the module itself or nested in `default`.
 */
function unwrapDefault<T>(module: unknown): T {
  let value = module as { default?: unknown } | undefined
  while (value && typeof value !== 'function' && 'default' in value) value = value.default as { default?: unknown }
  return value as T
}

const MsgReader = unwrapDefault<typeof MsgReaderClass>(msgReaderModule)

export interface MsgFile {
  reader: MsgReaderClass
  data: FieldsData
}

/** OLE compound file signature, used by .msg files. */
export function looksLikeMsg(start: Buffer): boolean {
  return start.length >= 8 && start.readUInt32BE(0) === 0xd0cf11e0 && start.readUInt32BE(4) === 0xa1b11ae1
}

export function readMsg(data: Buffer): MsgFile {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const reader = new MsgReader(view)
  const fields = reader.getFileData()
  if (fields.error) throw new Error(fields.error)
  return { reader, data: fields }
}

const CODEPAGES: Record<number, string> = { 65001: 'utf8', 1200: 'utf16le', 20127: 'ascii', 28591: 'latin1' }

function decodeBytes(bytes: Uint8Array, codepage: number | undefined): string {
  const buffer = Buffer.from(bytes)
  const name = codepage ? (CODEPAGES[codepage] ?? `cp${codepage}`) : 'utf8'
  return iconv.encodingExists(name) ? iconv.decode(buffer, name) : buffer.toString('utf8')
}

export function msgContent(file: MsgFile, fields: FieldsData = file.data): MessageContent {
  let html: string | null = fields.bodyHtml || (fields.html ? decodeBytes(fields.html, fields.internetCodepage ?? fields.messageCodepage) : '') || null
  let text = fields.body ?? ''
  if (!html && !text && fields.compressedRtf) {
    try {
      const rtf = convertRtf(Buffer.from(decompressRTF(Array.from(fields.compressedRtf))).toString('latin1'))
      if (rtf) {
        html = rtf.html
        text = rtf.text
      }
    } catch {
      // no usable body
    }
  }
  const textDerived = !text && !!html
  text = text ? tidyText(text) : html ? htmlToText(html) : ''

  const attachments: ContentAttachment[] = (fields.attachments ?? []).map((att, i) => {
    const isMessage = !!att.innerMsgContent
    const name = (att.fileName || att.fileNameShort || att.name || '').trim() || (isMessage ? att.innerMsgContentFields?.subject || `message-${i + 1}` : `attachment-${i + 1}`)
    return {
      name,
      size: att.contentLength ?? 0,
      mimeType: (att.attachMimeTag || (isMessage ? 'message/rfc822' : 'application/octet-stream')).toLowerCase(),
      contentId: normalizeContentId(att.pidContentId ?? ''),
      hidden: !!att.attachmentHidden,
      source: isMessage ? 'msgMessage' : 'file',
      isMessage,
      read: () => (isMessage ? Buffer.alloc(0) : Buffer.from(file.reader.getAttachment(att).content)),
      embedded: () => null,
      embeddedMsg: () => (isMessage && att.innerMsgContentFields ? { reader: file.reader, data: att.innerMsgContentFields } : null)
    }
  })
  return { html, text, textDerived, attachments, security: /^IPM\.Note\.SMIME/i.test(fields.messageClass ?? '') ? 'signed' : null }
}

export function msgDate(fields: FieldsData): number {
  for (const value of [fields.clientSubmitTime, fields.messageDeliveryTime, fields.creationTime, fields.lastModificationTime]) {
    const time = value ? Date.parse(value) : NaN
    if (!Number.isNaN(time)) return time
  }
  return 0
}

export function msgSender(fields: FieldsData): { name: string; email: string } {
  const email = [fields.senderSmtpAddress, fields.sentRepresentingSmtpAddress, fields.senderEmail, fields.creatorSMTPAddress].find((e) => e && e.includes('@')) ?? ''
  return { name: squash(fields.senderName || email), email }
}

export function msgRecipients(fields: FieldsData): Recipient[] {
  return (fields.recipients ?? [])
    .map((r) => {
      const email = [r.smtpAddress, r.email].find((e) => e && e.includes('@')) ?? ''
      return { name: squash(r.name || email), email, type: r.recipType ?? 'to' }
    })
    .filter((r) => r.name || r.email)
}

export function msgAppointment(fields: FieldsData): AppointmentInfo | null {
  if (!/^IPM\.(Appointment|Schedule\.Meeting)/i.test(fields.messageClass ?? '')) return null
  const time = (value?: string): number | null => {
    const t = value ? Date.parse(value) : NaN
    return Number.isNaN(t) ? null : t
  }
  return {
    start: time(fields.apptStartWhole),
    end: time(fields.apptEndWhole),
    location: fields.location ?? '',
    isRecurring: false,
    recurrence: '',
    attendees: '',
    isAllDay: false
  }
}
