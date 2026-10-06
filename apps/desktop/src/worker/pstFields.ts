import Long from 'long'
import type { ItemKind } from '../shared/types'
import { squash } from '../shared/text'
import { raw, safe } from './content'
import { PSTMessage, PSTUtil, type PSTFile } from './pst'

const PR_SENDER_SMTP_ADDRESS = 0x5d01
const PR_SENT_REPRESENTING_SMTP_ADDRESS = 0x5d02

/** Loads a top-level message by its node id. */
export function loadMessage(pst: PSTFile, id: number): PSTMessage | null {
  const obj: unknown = PSTUtil.detectAndLoadPSTObject(pst, Long.fromNumber(id))
  return obj instanceof PSTMessage ? obj : null
}

export function kindOf(messageClass: string): ItemKind {
  const c = messageClass.toUpperCase()
  if (c.startsWith('IPM.SCHEDULE.MEETING')) return 'meeting'
  if (c.startsWith('IPM.APPOINTMENT')) return 'appointment'
  if (c.startsWith('IPM.CONTACT') || c.startsWith('IPM.DISTLIST') || c.startsWith('IPM.ABCHPERSON')) return 'contact'
  if (c.startsWith('IPM.TASK')) return 'task'
  if (c.startsWith('IPM.STICKYNOTE')) return 'note'
  if (c.startsWith('IPM.ACTIVITY')) return 'journal'
  if (c.startsWith('IPM.NOTE') || c.startsWith('REPORT.') || c.startsWith('IPM.POST') || c === 'IPM' || c.startsWith('IPM.SHARING') || c.startsWith('IPM.OUTLOOK.RECALL'))
    return 'mail'
  return 'other'
}

export interface Address {
  name: string
  email: string
}

/** Resolves the displayed sender, preferring SMTP addresses over Exchange DNs. */
export function senderOf(msg: PSTMessage): Address {
  const name = safe(() => msg.sentRepresentingName, '') || safe(() => msg.senderName, '')
  const candidates = [
    safe(() => msg.sentRepresentingEmailAddress, ''),
    safe(() => raw(msg).getStringItem(PR_SENT_REPRESENTING_SMTP_ADDRESS), ''),
    safe(() => msg.senderEmailAddress, ''),
    safe(() => raw(msg).getStringItem(PR_SENDER_SMTP_ADDRESS), '')
  ]
  let email = candidates.find((c) => c.includes('@')) ?? ''
  if (!email) email = fromHeader(safe(() => msg.transportMessageHeaders, ''))
  return { name: squash(name || email), email: email.trim() }
}

/** The actual sender if a message was sent on behalf of someone else. */
export function actualSenderOf(msg: PSTMessage): Address | null {
  const name = safe(() => msg.senderName, '')
  const email =
    [safe(() => msg.senderEmailAddress, ''), safe(() => raw(msg).getStringItem(PR_SENDER_SMTP_ADDRESS), '')].find((c) => c.includes('@')) ?? ''
  const representing = senderOf(msg)
  if (!name && !email) return null
  const sameEmail = email && representing.email && email.toLowerCase() === representing.email.toLowerCase()
  const sameName = name && representing.name && name.toLowerCase() === representing.name.toLowerCase()
  if (sameEmail || (!email && sameName)) return null
  return { name: squash(name || email), email }
}

function fromHeader(headers: string): string {
  const m = /^from:[^\r\n]*?<?([^\s<>"]+@[^\s<>"]+)>?/im.exec(headers)
  return m ? m[1] : ''
}

export function recipientsLine(msg: PSTMessage): { names: string; emails: string } {
  const names: string[] = []
  const emails: string[] = []
  const count = safe(() => msg.numberOfRecipients, 0)
  for (let i = 0; i < count; i++) {
    const r = safe(() => msg.getRecipient(i), null)
    if (!r) continue
    const name = safe(() => r.displayName, '')
    const email = [safe(() => r.smtpAddress, ''), safe(() => r.emailAddress, '')].find((e) => e.includes('@')) ?? ''
    if (safe(() => r.recipientType, 1) === 1 && name) names.push(name)
    if (email) emails.push(email)
  }
  return { names: names.join('; '), emails: emails.join(' ') }
}
