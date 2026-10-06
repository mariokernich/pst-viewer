import { addressParser, decodeWords } from 'postal-mime'
import { squash } from '../shared/text'

/**
 * Lightweight RFC 5322 header parsing, used to list MBOX and EML messages
 * quickly before their full content is indexed.
 */

export type HeaderMap = Map<string, string[]>

/** Byte offset where the header block ends (start of the body), or -1. */
export function headerEnd(data: Buffer): number {
  const crlf = data.indexOf('\r\n\r\n')
  const lf = data.indexOf('\n\n')
  if (crlf < 0) return lf < 0 ? -1 : lf + 2
  if (lf < 0) return crlf + 4
  return crlf < lf ? crlf + 4 : lf + 2
}

/** Parses an (unfolded) header block. Keys are lower case. */
export function parseHeaderBlock(text: string): HeaderMap {
  const headers: HeaderMap = new Map()
  let key = ''
  let value = ''
  const flush = (): void => {
    if (!key) return
    const list = headers.get(key)
    if (list) list.push(value.trim())
    else headers.set(key, [value.trim()])
  }
  for (const line of text.split(/\r?\n/)) {
    if (/^[ \t]/.test(line)) {
      value += ` ${line.trim()}`
      continue
    }
    flush()
    const m = /^([!-9;-~]+):(.*)$/.exec(line)
    if (m) {
      key = m[1].toLowerCase()
      value = m[2]
    } else {
      key = ''
    }
  }
  flush()
  return headers
}

/** Reads the header block at the start of a message. */
export function readHeaders(data: Buffer): HeaderMap {
  const end = headerEnd(data)
  // Headers are 7-bit by standard; latin1 keeps stray 8-bit bytes intact.
  return parseHeaderBlock(data.subarray(0, end < 0 ? data.length : end).toString('latin1'))
}

export function header(headers: HeaderMap, key: string): string {
  return headers.get(key)?.[0] ?? ''
}

/** Decodes RFC 2047 encoded words; raw 8-bit UTF-8 headers are recovered too. */
export function decodeHeader(value: string): string {
  let text = value
  // Undo the latin1 decoding for unencoded UTF-8 bytes.
  if (/[\u0080-ÿ]/.test(text)) {
    const bytes = Buffer.from(text, 'latin1')
    const utf8 = bytes.toString('utf8')
    if (!utf8.includes('�')) text = utf8
  }
  try {
    return squash(decodeWords(text))
  } catch {
    return squash(text)
  }
}

export interface Mailbox {
  name: string
  email: string
}

export function parseAddresses(value: string): Mailbox[] {
  if (!value.trim()) return []
  try {
    return addressParser(decodeHeader(value), { flatten: true }).map((a) => ({
      name: squash(a.name || ''),
      email: ('address' in a && a.address) || ''
    }))
  } catch {
    return []
  }
}

export interface HeaderMeta {
  subject: string
  from: Mailbox
  to: Mailbox[]
  cc: Mailbox[]
  bcc: Mailbox[]
  date: number
  isRead: boolean
  flagged: boolean
  importance: 0 | 1 | 2
  hasAttachments: boolean
  messageId: string
  /** Gmail labels (Google Takeout), decoded. */
  labels: string[]
}

/** Extracts list information from message headers. */
export function headerMeta(headers: HeaderMap): HeaderMeta {
  const from = parseAddresses(header(headers, 'from'))[0] ?? parseAddresses(header(headers, 'sender'))[0] ?? { name: '', email: '' }
  const date = Date.parse(header(headers, 'date'))
  const contentType = header(headers, 'content-type').toLowerCase()

  // Read and flag state as stored by Thunderbird, Apple Mail and others.
  let isRead = true
  let flagged = false
  const mozilla = header(headers, 'x-mozilla-status')
  if (/^[0-9a-f]{4}$/i.test(mozilla)) {
    const bits = parseInt(mozilla, 16)
    isRead = (bits & 0x0001) !== 0
    flagged = (bits & 0x0004) !== 0
  } else if (headers.has('status')) {
    isRead = header(headers, 'status').includes('R')
  }
  if (/F/.test(header(headers, 'x-status'))) flagged = true

  const priority = `${header(headers, 'importance')} ${header(headers, 'x-priority')} ${header(headers, 'priority')}`.toLowerCase()
  const importance = /high|urgent|^\s*[12]\b|\s[12]\b/.test(priority) ? 2 : /low|non-urgent|\b[45]\b/.test(priority) ? 0 : 1

  const labels = splitLabels(decodeHeader(header(headers, 'x-gmail-labels')))
  return {
    subject: decodeHeader(header(headers, 'subject')),
    from,
    to: parseAddresses(headers.get('to')?.join(', ') ?? ''),
    cc: parseAddresses(headers.get('cc')?.join(', ') ?? ''),
    bcc: parseAddresses(headers.get('bcc')?.join(', ') ?? ''),
    date: Number.isNaN(date) ? 0 : date,
    isRead,
    flagged,
    importance,
    hasAttachments: contentType.startsWith('multipart/mixed'),
    messageId: header(headers, 'message-id'),
    labels
  }
}

/** Splits a Gmail label list; labels containing commas are quoted. */
export function splitLabels(value: string): string[] {
  const labels: string[] = []
  let current = ''
  let quoted = false
  for (const c of value) {
    if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) {
      if (current.trim()) labels.push(current.trim())
      current = ''
    } else current += c
  }
  if (current.trim()) labels.push(current.trim())
  return labels
}
