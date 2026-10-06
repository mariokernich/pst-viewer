import MailComposer, { type MailComposerAttachment } from 'nodemailer/lib/mail-composer'
import type { MimeNodeAddress, MimeNodeHeader } from 'nodemailer/lib/mime-node'
import type { PSTMessage } from './pst'
import { safe, type MessageContent } from './content'
import { referencedContentIds } from './html'
import { senderOf, type Address } from './pstFields'
import { openAttachedMessage, type ResolvedMessage } from './details'
import { msgDate, msgRecipients, msgSender } from './msg'

const MAX_DEPTH = 5

/** Headers that are rebuilt from the message itself and must not be copied. */
const REBUILT_HEADERS = new Set([
  'from',
  'to',
  'cc',
  'bcc',
  'subject',
  'date',
  'message-id',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
  'content-disposition',
  'content-id',
  'content-description',
  'x-ms-has-attach',
  'x-ms-tnef-correlator',
  // Signatures cover the original encoding and would no longer verify.
  'dkim-signature',
  'arc-seal',
  'arc-message-signature'
])

/**
 * Serialises a message as RFC 5322 / MIME (.eml) so that it can be opened in
 * any mail client. MIME messages are returned unchanged; PST and .msg items
 * are rebuilt including their attachments, inline images and original headers.
 */
export async function buildEml(message: ResolvedMessage, depth = 0): Promise<Buffer> {
  if (message.kind === 'mime') return message.raw
  if (message.kind === 'pst') {
    const { msg } = message
    const original = parseHeaders(safe(() => msg.transportMessageHeaders, ''))
    return compose(
      {
        from: senderOf(msg),
        ...recipientsByType(msg),
        subject: safe(() => msg.subject, ''),
        date: safe(() => msg.clientSubmitTime, null) ?? safe(() => msg.messageDeliveryTime, null),
        messageId: safe(() => msg.internetMessageId, ''),
        original
      },
      message.content,
      depth
    )
  }
  const { fields } = message
  const recipients = msgRecipients(fields)
  const mailbox = (r: { name: string; email: string }): MimeNodeAddress => ({ name: r.name !== r.email ? r.name : '', address: r.email })
  const date = msgDate(fields)
  return compose(
    {
      from: msgSender(fields),
      to: recipients.filter((r) => r.type === 'to' && r.email).map(mailbox),
      cc: recipients.filter((r) => r.type === 'cc' && r.email).map(mailbox),
      bcc: recipients.filter((r) => r.type === 'bcc' && r.email).map(mailbox),
      subject: fields.subject ?? '',
      date: date ? new Date(date) : null,
      messageId: '',
      original: parseHeaders(fields.headers ?? '')
    },
    message.content,
    depth
  )
}

interface Envelope {
  from: Address
  to: MimeNodeAddress[]
  cc: MimeNodeAddress[]
  bcc: MimeNodeAddress[]
  subject: string
  date: Date | null
  messageId: string
  /** Original internet headers, copied except the rebuilt ones. */
  original: { key: string; value: string }[]
}

async function compose(envelope: Envelope, content: MessageContent, depth: number): Promise<Buffer> {
  const attachments: MailComposerAttachment[] = []
  const cids = referencedContentIds(content.html)
  for (const att of content.attachments) {
    if (att.isMessage) {
      if (depth >= MAX_DEPTH) continue
      try {
        const data = att.source === 'mimeMessage' ? att.read() : await buildEml(await openAttachedMessage(att), depth + 1)
        const name = fileSafe(att.name) || 'message'
        attachments.push({
          filename: /\.eml$/i.test(name) ? name : `${name}.eml`,
          content: data,
          contentType: 'message/rfc822',
          // Keep forwarded messages as attachments instead of inline parts.
          contentDisposition: 'attachment'
        })
      } catch {
        // skip unreadable attached messages
      }
      continue
    }
    const inline = att.contentId !== '' && cids.has(att.contentId)
    attachments.push({
      filename: att.name,
      content: att.read(),
      contentType: att.mimeType,
      ...(inline ? { cid: att.contentId, contentDisposition: 'inline' } : {})
    })
  }

  const messageId = (envelope.messageId || envelope.original.find((h) => h.key.toLowerCase() === 'message-id')?.value || '').trim()
  const composer = new MailComposer({
    from: address(envelope.from),
    to: envelope.to,
    cc: envelope.cc,
    bcc: envelope.bcc,
    subject: envelope.subject,
    date: envelope.date ?? undefined,
    messageId: messageId || undefined,
    ...body(content),
    attachments,
    headers: envelope.original
      .filter((h) => !REBUILT_HEADERS.has(h.key.toLowerCase()))
      .map<MimeNodeHeader>((h) => ({ key: h.key, value: { prepared: true, value: h.value } })),
    disableFileAccess: true,
    disableUrlAccess: true,
    xMailer: false
  })
  return composer.compile().build()
}

function body(content: MessageContent): { html?: string; text?: string } {
  const result: { html?: string; text?: string } = {}
  if (content.html) result.html = content.html
  if (content.text && (!content.textDerived || !content.html)) result.text = content.text
  return result
}

function address(a: Address): MimeNodeAddress | undefined {
  if (!a.email && !a.name) return undefined
  return a.email ? { name: a.name !== a.email ? a.name : '', address: a.email } : { name: a.name, address: '' }
}

function recipientsByType(msg: PSTMessage): { to: MimeNodeAddress[]; cc: MimeNodeAddress[]; bcc: MimeNodeAddress[] } {
  const result = { to: [] as MimeNodeAddress[], cc: [] as MimeNodeAddress[], bcc: [] as MimeNodeAddress[] }
  const count = safe(() => msg.numberOfRecipients, 0)
  for (let i = 0; i < count; i++) {
    const r = safe(() => msg.getRecipient(i), null)
    if (!r) continue
    const email = [safe(() => r.smtpAddress, ''), safe(() => r.emailAddress, '')].find((e) => e.includes('@')) ?? ''
    const name = safe(() => r.displayName, '')
    if (!email) continue
    const type = safe(() => r.recipientType, 1)
    const list = type === 2 ? result.cc : type === 3 ? result.bcc : result.to
    list.push({ name: name && name !== email ? name : '', address: email })
  }
  return result
}

/** Parses a raw header block, keeping folded values unchanged. */
export function parseHeaders(raw: string): { key: string; value: string }[] {
  const headers: { key: string; value: string }[] = []
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (/^[ \t]/.test(line) && headers.length > 0) {
      headers[headers.length - 1].value += `\r\n${line}`
      continue
    }
    const m = /^([!-9;-~]+):[ \t]?(.*)$/.exec(line)
    if (m) headers.push({ key: m[1], value: m[2] })
  }
  return headers
}

function fileSafe(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim().slice(0, 150)
}
