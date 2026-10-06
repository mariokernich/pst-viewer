import CFB from 'cfb'
import MailComposer from 'nodemailer/lib/mail-composer'

/** Test fixtures: EML, MBOX and MSG files built in memory. */

export async function buildEml(options: {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  date?: Date
  headers?: Record<string, string>
  attachments?: { filename: string; content: Buffer; contentType: string; cid?: string }[]
}): Promise<Buffer> {
  const composer = new MailComposer({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    date: options.date ?? new Date('2025-03-01T10:00:00Z'),
    headers: options.headers,
    attachments: options.attachments,
    xMailer: false
  })
  return composer.compile().build()
}

/** Joins messages into an MBOX file (mboxrd quoting, envelope lines). */
export function buildMbox(messages: Buffer[], crlf = false): Buffer {
  const nl = crlf ? '\r\n' : '\n'
  const parts = messages.map((message) => {
    const body = message
      .toString('latin1')
      .replace(/\r\n/g, '\n')
      .replace(/^(>*From )/gm, '>$1')
      .replace(/\n/g, nl)
    return `From sender@example.com Sat Mar 01 10:00:00 2025${nl}${body}${nl}${nl}`
  })
  return Buffer.from(parts.join(''), 'latin1')
}

/** Wraps a message like Apple Mail's .emlx files: length line, message, property list with flags. */
export function buildEmlx(message: Buffer, flags: number): Buffer {
  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>date-received</key>',
    '\t<integer>1740823200</integer>',
    '\t<key>flags</key>',
    `\t<integer>${flags}</integer>`,
    '</dict>',
    '</plist>',
    ''
  ].join('\n')
  return Buffer.concat([Buffer.from(`${String(message.length).padEnd(10)}\n`), message, Buffer.from(plist)])
}

// -----------------------------------------------------------------------------
// MSG (Outlook item, [MS-OXMSG]) - just enough for msgreader to read it.

const PT_LONG = 0x0003
const PT_SYSTIME = 0x0040
const PT_UNICODE = 0x001f
const PT_BINARY = 0x0102

interface Prop {
  id: number
  type: number
  value: string | number | Buffer | Date
}

function tagHex(p: Prop): string {
  return ((p.id << 16) | p.type).toString(16).toUpperCase().padStart(8, '0')
}

function streamData(p: Prop): Buffer {
  if (p.type === PT_UNICODE) return Buffer.from(`${p.value}\0`, 'utf16le')
  return p.value as Buffer
}

/** Writes properties: fixed values into the property stream, others as substreams. */
function addProps(cfb: CFB.CFB$Container, storage: string, props: Prop[], header: Buffer): void {
  const entries: Buffer[] = [header]
  for (const p of props) {
    const entry = Buffer.alloc(16)
    entry.writeUInt32LE(((p.id << 16) | p.type) >>> 0, 0)
    entry.writeUInt32LE(0x6, 4)
    if (p.type === PT_LONG) entry.writeInt32LE(p.value as number, 8)
    else if (p.type === PT_SYSTIME) {
      const filetime = BigInt((p.value as Date).getTime() + 11_644_473_600_000) * 10_000n
      entry.writeBigUInt64LE(filetime, 8)
    } else {
      const data = streamData(p)
      entry.writeUInt32LE(data.length, 8)
      CFB.utils.cfb_add(cfb, `${storage}__substg1.0_${tagHex(p)}`, data)
    }
    entries.push(entry)
  }
  CFB.utils.cfb_add(cfb, `${storage}__properties_version1.0`, Buffer.concat(entries))
}

export function buildMsg(options: {
  subject: string
  senderName: string
  senderEmail: string
  to: { name: string; email: string }[]
  body: string
  html?: string
  date: Date
  attachments?: { filename: string; content: Buffer; mimeType: string }[]
}): Buffer {
  const cfb = CFB.utils.cfb_new()
  // Named property mapping (empty).
  for (const name of ['00020102', '00030102', '00040102']) CFB.utils.cfb_add(cfb, `/__nameid_version1.0/__substg1.0_${name}`, Buffer.alloc(0))

  const attachments = options.attachments ?? []
  const header = Buffer.alloc(32)
  header.writeUInt32LE(options.to.length, 8)
  header.writeUInt32LE(attachments.length, 12)
  header.writeUInt32LE(options.to.length, 16)
  header.writeUInt32LE(attachments.length, 20)
  const props: Prop[] = [
    { id: 0x001a, type: PT_UNICODE, value: 'IPM.Note' },
    { id: 0x0037, type: PT_UNICODE, value: options.subject },
    { id: 0x0c1a, type: PT_UNICODE, value: options.senderName },
    { id: 0x0c1f, type: PT_UNICODE, value: options.senderEmail },
    { id: 0x5d01, type: PT_UNICODE, value: options.senderEmail },
    { id: 0x1000, type: PT_UNICODE, value: options.body },
    { id: 0x0039, type: PT_SYSTIME, value: options.date },
    { id: 0x0e06, type: PT_SYSTIME, value: options.date },
    { id: 0x0e07, type: PT_LONG, value: 1 }
  ]
  if (options.html) props.push({ id: 0x1013, type: PT_BINARY, value: Buffer.from(options.html, 'utf8') }, { id: 0x3fde, type: PT_LONG, value: 65001 })
  addProps(cfb, '/', props, header)

  options.to.forEach((recipient, i) => {
    const storage = `/__recip_version1.0_#${i.toString(16).toUpperCase().padStart(8, '0')}/`
    addProps(
      cfb,
      storage,
      [
        { id: 0x0c15, type: PT_LONG, value: 1 },
        { id: 0x3001, type: PT_UNICODE, value: recipient.name },
        { id: 0x3003, type: PT_UNICODE, value: recipient.email },
        { id: 0x39fe, type: PT_UNICODE, value: recipient.email }
      ],
      Buffer.alloc(8)
    )
  })

  attachments.forEach((attachment, i) => {
    const storage = `/__attach_version1.0_#${i.toString(16).toUpperCase().padStart(8, '0')}/`
    addProps(
      cfb,
      storage,
      [
        { id: 0x3705, type: PT_LONG, value: 1 },
        { id: 0x3707, type: PT_UNICODE, value: attachment.filename },
        { id: 0x3704, type: PT_UNICODE, value: attachment.filename },
        { id: 0x370e, type: PT_UNICODE, value: attachment.mimeType },
        { id: 0x3701, type: PT_BINARY, value: attachment.content }
      ],
      Buffer.alloc(8)
    )
  })

  return Buffer.from(CFB.write(cfb, { type: 'buffer' }) as Uint8Array)
}
