import type { Address, Email } from 'postal-mime'
import { PSTAppointment, PSTContact, PSTTask, type PSTFile, type PSTMessage } from './pst'
import type {
  AppointmentInfo,
  AttachmentInfo,
  ContactField,
  MessageDetail,
  MessageRef,
  Recipient,
  TaskInfo
} from '../shared/types'
import { squash } from '../shared/text'
import { contentFromEmail, loadContent, parseMime, raw, safe, type ContentAttachment, type MessageContent } from './content'
import { referencedContentIds } from './html'
import { actualSenderOf, kindOf, loadMessage, senderOf, type PstIndex } from './indexer'

const MAX_INLINE_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_INLINE_TOTAL_BYTES = 60 * 1024 * 1024
const PR_FLAG_STATUS = 0x1090
const PR_REPLY_RECIPIENT_NAMES = 0x0050

export class NotFoundError extends Error {}

/** A message stored in the PST, or a MIME message (.eml) attached to one. */
export type ResolvedMessage =
  | { kind: 'pst'; msg: PSTMessage; content: MessageContent }
  | { kind: 'mime'; raw: Buffer; email: Email; content: MessageContent }

const MAX_NESTING = 8

/** Loads a top-level message or a message attached to it (following ref.path). */
export async function resolveMessage(pst: PSTFile, ref: MessageRef): Promise<ResolvedMessage> {
  let loaded: PSTMessage | null
  try {
    loaded = loadMessage(pst, ref.id)
  } catch {
    throw new NotFoundError(`Item ${ref.id} not found`)
  }
  if (!loaded) throw new NotFoundError(`Item ${ref.id} is not a message`)
  let resolved: ResolvedMessage = { kind: 'pst', msg: loaded, content: await loadContent(loaded) }
  const path = ref.path ?? []
  if (path.length > MAX_NESTING) throw new NotFoundError('Nesting too deep')
  for (const attachmentIndex of path) {
    const attachment = resolved.content.attachments[attachmentIndex]
    if (!attachment?.isMessage) throw new NotFoundError(`Attachment ${attachmentIndex} is not a message`)
    resolved = await openAttachedMessage(attachment)
  }
  return resolved
}

/** Opens an attached message (embedded in the PST or attached as .eml). */
export async function openAttachedMessage(attachment: ContentAttachment): Promise<ResolvedMessage> {
  if (attachment.source === 'pstMessage') {
    const msg = attachment.embedded()
    if (!msg) throw new NotFoundError('The attached message cannot be read')
    return { kind: 'pst', msg, content: await loadContent(msg) }
  }
  const data = attachment.read()
  if (data.length === 0) throw new NotFoundError('The attached message is empty')
  const email = await parseMime(data)
  const contentType = email.headers.find((h) => h.key === 'content-type')?.value ?? ''
  const security = /multipart\/signed/i.test(contentType) ? 'signed' : /application\/(x-)?pkcs7-mime/i.test(contentType) ? 'encrypted' : null
  return { kind: 'mime', raw: data, email, content: { ...contentFromEmail(email), security } }
}

export async function getMessageDetail(index: PstIndex, ref: MessageRef): Promise<MessageDetail> {
  const resolved = await resolveMessage(index.pst, ref)
  if (resolved.kind === 'mime') return mimeDetail(ref, resolved.raw, resolved.email, resolved.content)
  const { msg, content } = resolved
  const messageClass = safe(() => msg.messageClass, '') || 'IPM.Note'
  const kind = kindOf(messageClass)
  const indexed = ref.path?.length ? undefined : index.itemById.get(ref.id)

  const date = (d: Date | null | undefined): number | null => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null)
  const sentDate = date(safe(() => msg.clientSubmitTime, null))
  const receivedDate = date(safe(() => msg.messageDeliveryTime, null))
  const importance = safe(() => msg.importance, 1)

  return {
    ref,
    folderId: indexed?.folderId ?? null,
    kind,
    messageClass,
    subject: safe(() => msg.subject, ''),
    from: senderOf(msg),
    sender: actualSenderOf(msg),
    replyTo: squash(safe(() => raw(msg).getStringItem(PR_REPLY_RECIPIENT_NAMES), '')),
    recipients: recipientsOf(msg),
    date: indexed?.date ?? receivedDate ?? sentDate ?? 0,
    sentDate,
    receivedDate,
    size: safe(() => msg.messageSize.toNumber(), 0),
    importance: importance === 2 ? 2 : importance === 0 ? 0 : 1,
    isRead: safe(() => msg.isRead, true),
    flagged: safe(() => raw(msg).getIntItem(PR_FLAG_STATUS), 0) === 2,
    categories: safe(() => msg.colorCategories, []).filter(Boolean),
    ...bodyAndAttachments(content),
    headers: safe(() => msg.transportMessageHeaders, ''),
    security: content.security,
    appointment: kind === 'appointment' || kind === 'meeting' ? appointmentOf(msg) : null,
    contact: kind === 'contact' ? contactOf(msg) : null,
    task: kind === 'task' ? taskOf(msg) : null
  }
}

function bodyAndAttachments(content: MessageContent): Pick<MessageDetail, 'bodyFormat' | 'html' | 'text' | 'attachments' | 'inlineImages'> {
  const cids = referencedContentIds(content.html)
  const attachments: AttachmentInfo[] = content.attachments.map((a, i) => ({
    index: i,
    name: a.name,
    size: a.size,
    mimeType: a.mimeType,
    isInline: a.hidden || (a.contentId !== '' && cids.has(a.contentId)),
    isMessage: a.isMessage
  }))
  return {
    bodyFormat: content.html ? 'html' : content.text ? 'text' : 'none',
    html: content.html,
    text: content.text,
    attachments,
    inlineImages: inlineImages(content.attachments, cids)
  }
}

/** Details of a MIME message attached as .eml. */
function mimeDetail(ref: MessageRef, rawMessage: Buffer, email: Email, content: MessageContent): MessageDetail {
  const mailboxes = (list: Address[] | Address | undefined): { name: string; email: string }[] => {
    const items = Array.isArray(list) ? list : list ? [list] : []
    return items.flatMap((a) => (a.group ? a.group : [a])).map((m) => ({ name: squash(m.name || m.address || ''), email: m.address ?? '' }))
  }
  const from = mailboxes(email.from)[0] ?? { name: '', email: '' }
  const sender = mailboxes(email.sender)[0]
  const recipients: Recipient[] = [
    ...mailboxes(email.to).map((r) => ({ ...r, type: 'to' as const })),
    ...mailboxes(email.cc).map((r) => ({ ...r, type: 'cc' as const })),
    ...mailboxes(email.bcc).map((r) => ({ ...r, type: 'bcc' as const }))
  ]
  const parsedDate = email.date ? Date.parse(email.date) : NaN
  const date = Number.isNaN(parsedDate) ? 0 : parsedDate
  const header = (key: string): string => email.headers.find((h) => h.key === key)?.value ?? ''
  const priority = `${header('importance')} ${header('x-priority')}`.toLowerCase()
  const importance = /high|^\s*[12]\b/.test(priority) ? 2 : /low|^\s*[45]\b/.test(priority) ? 0 : 1
  const headerEnd = rawMessage.indexOf('\r\n\r\n') >= 0 ? rawMessage.indexOf('\r\n\r\n') : rawMessage.indexOf('\n\n')

  return {
    ref,
    folderId: null,
    kind: 'mail',
    messageClass: 'IPM.Note',
    subject: email.subject ?? '',
    from,
    sender: sender && sender.email && sender.email.toLowerCase() !== from.email.toLowerCase() ? sender : null,
    replyTo: mailboxes(email.replyTo)
      .map((r) => r.email || r.name)
      .join('; '),
    recipients,
    date,
    sentDate: date || null,
    receivedDate: null,
    size: rawMessage.length,
    importance,
    isRead: true,
    flagged: false,
    categories: [],
    ...bodyAndAttachments(content),
    headers: headerEnd > 0 ? rawMessage.subarray(0, headerEnd).toString('utf8') : '',
    security: content.security,
    appointment: null,
    contact: null,
    task: null
  }
}

function recipientsOf(msg: PSTMessage): Recipient[] {
  const result: Recipient[] = []
  const count = safe(() => msg.numberOfRecipients, 0)
  for (let i = 0; i < count; i++) {
    const r = safe(() => msg.getRecipient(i), null)
    if (!r) continue
    const type = safe(() => r.recipientType, 1)
    const email = [safe(() => r.smtpAddress, ''), safe(() => r.emailAddress, '')].find((e) => e.includes('@')) ?? ''
    const name = squash(safe(() => r.displayName, '')) || email
    if (!name && !email) continue
    result.push({ name, email, type: type === 2 ? 'cc' : type === 3 ? 'bcc' : 'to' })
  }
  return result
}

function sniffImageType(data: Buffer, fallback: string): string {
  if (data.length >= 4) {
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png'
    if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'image/gif'
    if (data[0] === 0x42 && data[1] === 0x4d) return 'image/bmp'
    if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  }
  return fallback
}

/** Resolves cid: references of the HTML body to data URLs. */
function inlineImages(attachments: ContentAttachment[], cids: Set<string>): Record<string, string> {
  const result: Record<string, string> = {}
  if (cids.size === 0) return result
  let budget = MAX_INLINE_TOTAL_BYTES
  for (const cid of cids) {
    const att =
      attachments.find((a) => a.contentId === cid) ??
      // Some mailers reference images by file name instead of Content-ID.
      attachments.find((a) => a.name.toLowerCase() === cid || cid.startsWith(`${a.name.toLowerCase()}@`))
    if (!att || att.isMessage || att.size > MAX_INLINE_IMAGE_BYTES || att.size > budget) continue
    const data = safe(() => att.read(), Buffer.alloc(0))
    if (data.length === 0 || data.length > budget) continue
    const mime = sniffImageType(data, att.mimeType.startsWith('image/') ? att.mimeType : '')
    if (!mime.startsWith('image/') || mime === 'image/svg+xml') continue
    budget -= data.length
    result[cid] = `data:${mime};base64,${data.toString('base64')}`
  }
  return result
}

/** Calls a getter of a pst-extractor subclass on a plain PSTMessage. */
function getter<T>(proto: object, name: string, target: PSTMessage, fallback: T): T {
  const descriptor = Object.getOwnPropertyDescriptor(proto, name)
  if (!descriptor?.get) return fallback
  return safe(() => descriptor.get!.call(target) as T, fallback)
}

function appointmentOf(msg: PSTMessage): AppointmentInfo {
  const p = PSTAppointment.prototype
  const time = (d: Date | null): number | null => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null)
  return {
    start: time(getter<Date | null>(p, 'startTime', msg, null)),
    end: time(getter<Date | null>(p, 'endTime', msg, null)),
    location: getter(p, 'location', msg, ''),
    isRecurring: getter(p, 'isRecurring', msg, false),
    recurrence: getter(p, 'recurrencePattern', msg, ''),
    attendees: squash(getter(p, 'allAttendees', msg, '')),
    isAllDay: getter(p, 'subType', msg, false)
  }
}

function contactOf(msg: PSTMessage): ContactField[] {
  const p = PSTContact.prototype
  const fields: [string, string][] = [
    ['company', 'companyName'],
    ['jobTitle', 'title'],
    ['department', 'departmentName'],
    ['email', 'email1EmailAddress'],
    ['email2', 'email2EmailAddress'],
    ['email3', 'email3EmailAddress'],
    ['businessPhone', 'businessTelephoneNumber'],
    ['mobilePhone', 'mobileTelephoneNumber'],
    ['homePhone', 'homeTelephoneNumber'],
    ['businessFax', 'businessFaxNumber'],
    ['businessAddress', 'workAddress'],
    ['homeAddress', 'homeAddress'],
    ['otherAddress', 'otherAddress'],
    ['website', 'businessHomePage'],
    ['personalWebsite', 'personalHomePage'],
    ['im', 'instantMessagingAddress']
  ]
  const result: ContactField[] = []
  for (const [key, prop] of fields) {
    const value = getter<string>(p, prop, msg, '')
    if (value && value.trim()) result.push({ key, value: value.trim() })
  }
  for (const [key, prop] of [
    ['birthday', 'birthday'],
    ['anniversary', 'anniversary']
  ] as const) {
    const value = getter<Date | null>(p, prop, msg, null)
    if (value instanceof Date && !Number.isNaN(value.getTime())) result.push({ key, value: value.toISOString() })
  }
  return result
}

function taskOf(msg: PSTMessage): TaskInfo {
  const p = PSTTask.prototype
  const time = (d: Date | null): number | null => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null)
  return {
    status: getter(p, 'taskStatus', msg, 0),
    percentComplete: getter(p, 'percentComplete', msg, 0),
    startDate: time(safe(() => msg.taskStartDate, null)),
    dueDate: time(safe(() => msg.taskDueDate, null)),
    owner: getter(p, 'taskOwner', msg, '')
  }
}
