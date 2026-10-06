import PostalMime, { type Email } from 'postal-mime'
import type { MsgFile } from './msg'
import type { PSTAttachment, PSTMessage } from './pst'
import type { SecurityKind } from '../shared/types'
import { loadEmbeddedMessage } from './embedded'
import { htmlToText, normalizeContentId, tidyText } from './html'
import { convertRtf } from './rtf'

/** pst-extractor keeps its generic property getters protected. */
interface RawPropertyAccess {
  getIntItem(id: number, defaultValue?: number): number
  getBooleanItem(id: number, defaultValue?: boolean): boolean
  getStringItem(id: number): string
}

export function raw(obj: unknown): RawPropertyAccess {
  return obj as RawPropertyAccess
}

const PR_ATTACHMENT_HIDDEN = 0x7ffe
const PR_ATTACH_FLAGS = 0x3714
const ATT_MHTML_REF = 0x4
const ATTACH_EMBEDDED_MSG = 5

/**
 * Where an attachment's content comes from: a plain file, a message embedded
 * in the PST or in a .msg file (Outlook "item" attachment) or a MIME message (.eml).
 */
export type AttachmentSource = 'file' | 'pstMessage' | 'msgMessage' | 'mimeMessage'

export interface ContentAttachment {
  name: string
  size: number
  mimeType: string
  contentId: string
  hidden: boolean
  source: AttachmentSource
  isMessage: boolean
  /** Raw bytes of a file or MIME message. */
  read(): Buffer
  /** The embedded message for source 'pstMessage'. */
  embedded(): PSTMessage | null
  /** The embedded item for source 'msgMessage'. */
  embeddedMsg?(): MsgFile | null
}

export interface MessageContent {
  html: string | null
  /** Plain text body, or text derived from the HTML body. */
  text: string
  /** True if the plain text was not stored but derived from HTML. */
  textDerived: boolean
  attachments: ContentAttachment[]
  security: SecurityKind | null
}

export function safe<T>(fn: () => T, fallback: T): T {
  try {
    const value = fn()
    return value ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Loads body and attachments of a message. S/MIME signed messages are
 * unwrapped so that their actual content and attachments become visible.
 */
export async function loadContent(msg: PSTMessage): Promise<MessageContent> {
  const messageClass = safe(() => msg.messageClass, '')
  const attachments = listPstAttachments(msg)
  let security: SecurityKind | null = null

  if (/^IPM\.Note\.SMIME/i.test(messageClass)) {
    const signedPart = attachments.find((a) => /multipart\/signed|application\/(x-)?pkcs7-mime/i.test(a.mimeType) || /\.p7m$/i.test(a.name))
    if (/MultipartSigned/i.test(messageClass) || (signedPart && /multipart\/signed/i.test(signedPart.mimeType))) {
      security = 'signed'
      if (signedPart) {
        try {
          const data = signedPart.read()
          if (data.length > 0) return { ...contentFromEmail(await parseMime(data)), security }
        } catch {
          // fall back to the PST body
        }
      }
    } else {
      security = 'encrypted'
    }
  }

  let html: string | null = safe(() => msg.bodyHTML, '') || null
  let text = safe(() => msg.body, '')
  if (!html && !text) {
    const rtf = convertRtf(safe(() => msg.bodyRTF, ''))
    if (rtf) {
      html = rtf.html
      text = rtf.text
    }
  }
  let textDerived = false
  if (!text && html) {
    text = htmlToText(html)
    textDerived = true
  } else {
    text = tidyText(text)
  }
  return { html, text, textDerived, attachments, security }
}

function listPstAttachments(msg: PSTMessage): ContentAttachment[] {
  const count = safe(() => msg.numberOfAttachments, 0)
  const result: ContentAttachment[] = []
  for (let i = 0; i < count; i++) {
    const att = safe<PSTAttachment | null>(() => msg.getAttachment(i), null)
    if (!att) continue
    const method = safe(() => att.attachMethod, 0)
    let name = safe(() => att.longFilename, '') || safe(() => att.filename, '') || safe(() => att.displayName, '')
    const tag = safe(() => att.mimeTag, '').toLowerCase()
    const source: AttachmentSource =
      method === ATTACH_EMBEDDED_MSG ? 'pstMessage' : tag === 'message/rfc822' || /\.eml$/i.test(name) ? 'mimeMessage' : 'file'
    const isMessage = source !== 'file'
    const mimeType = tag || (isMessage ? 'message/rfc822' : 'application/octet-stream')
    const embedded = (): PSTMessage | null => (source === 'pstMessage' ? safe(() => loadEmbeddedMessage(att, msg), null) : null)
    if (source === 'pstMessage' && !name) name = safe(() => embedded()?.subject ?? '', '')
    name = withExtension(name || `attachment-${i + 1}`, mimeType, isMessage)
    const flags = safe(() => raw(att).getIntItem(PR_ATTACH_FLAGS), 0)
    result.push({
      name,
      // For embedded messages the data object size is meaningless; use the attachment size.
      size: source === 'pstMessage' ? safe(() => att.size, 0) : safe(() => att.filesize, 0) || safe(() => att.size, 0),
      mimeType,
      contentId: normalizeContentId(safe(() => att.contentId, '')),
      hidden: safe(() => raw(att).getBooleanItem(PR_ATTACHMENT_HIDDEN), false) || (flags & ATT_MHTML_REF) !== 0,
      source,
      isMessage,
      read: () => (source === 'pstMessage' ? Buffer.alloc(0) : readPstAttachment(att)),
      embedded
    })
  }
  return result
}

function readPstAttachment(att: PSTAttachment): Buffer {
  const stream = att.fileInputStream
  if (!stream) return Buffer.alloc(0)
  const length = stream.length.toNumber()
  const buffer = Buffer.alloc(length)
  if (length > 0) stream.readCompletely(buffer)
  return buffer
}

/** Parses a MIME message (.eml, message/rfc822). */
export function parseMime(data: Buffer): Promise<Email> {
  return PostalMime.parse(data, { rfc822Attachments: true, attachmentEncoding: 'arraybuffer' })
}

/** Body and attachments of a parsed MIME message. */
export function contentFromEmail(email: Email): Omit<MessageContent, 'security'> {
  const html = email.html ?? null
  let text = email.text ? tidyText(email.text) : ''
  const textDerived = !text && !!html
  if (!text && html) text = htmlToText(html)
  const attachments: ContentAttachment[] = email.attachments
    .filter((a) => !/^application\/(x-)?pkcs7-signature$/i.test(a.mimeType))
    .map((a, i) => {
      const content = typeof a.content === 'string' ? Buffer.from(a.content, 'base64') : Buffer.from(a.content as ArrayBuffer)
      const mimeType = a.mimeType.toLowerCase()
      const isMessage = mimeType === 'message/rfc822'
      return {
        name: withExtension(a.filename || (isMessage ? `message-${i + 1}.eml` : `attachment-${i + 1}`), mimeType, isMessage),
        size: content.length,
        mimeType,
        contentId: normalizeContentId(a.contentId ?? ''),
        hidden: false,
        source: isMessage ? 'mimeMessage' : 'file',
        isMessage,
        read: () => content,
        embedded: () => null
      }
    })
  return { html, text, textDerived, attachments }
}

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/tiff': '.tif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/html': '.html',
  'text/calendar': '.ics',
  'application/ics': '.ics',
  'text/vcard': '.vcf',
  'text/x-vcard': '.vcf',
  'application/zip': '.zip',
  'message/rfc822': '.eml'
}

function withExtension(name: string, mimeType: string, isMessage: boolean): string {
  const clean = name.replace(/[\u0000-\u001f]/g, '').trim()
  // Attached messages are shown by their subject.
  if (isMessage) return clean
  if (/\.[a-z0-9]{1,8}$/i.test(clean)) return clean
  const ext = EXTENSIONS[mimeType]
  return ext ? clean + ext : clean
}
