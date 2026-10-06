/**
 * Search query language.
 *
 * Free text is split into terms that must all match (AND). Supported syntax:
 *
 *   rechnung 2024          all terms must match
 *   "exact phrase"         phrase match
 *   -newsletter            exclude a term
 *   angebot OR offer       either term (also: ODER)
 *   from:anna  von:anna    sender name or address
 *   to:bob  an:bob  cc:x   recipients
 *   subject:x  betreff:x   subject only
 *   body:x  inhalt:x       message body only
 *   attachment:pdf  anhang:vertrag   attachment file names
 *   folder:archiv  ordner:archiv     folder name
 *   has:attachment  hat:anhang
 *   is:unread / ist:ungelesen, is:read, is:important, is:flagged, is:signed
 *   after:2024-01-01  nach:1.1.2024  before:2024  vor:2024-06  bis:2024-06
 *   date:2024-05  datum:12.05.2024   year:2023  jahr:2023
 *   larger:5mb  größer:500kb  smaller:1mb  kleiner:1mb
 *   type:termin  typ:mail  (mail, meeting, appointment, contact, task, note)
 *
 * Field names are accepted in English and German.
 */
import type { ItemKind, SearchField } from './types'
import { fold, foldForIndex } from './text'

export interface QueryClause {
  /** Field to match, or null for all enabled fields. */
  field: SearchField | null
  /** Folded alternatives; at least one has to match. */
  terms: string[]
  negate: boolean
}

export interface ParsedQuery {
  clauses: QueryClause[]
  folderNames: string[]
  hasAttachments?: boolean
  readState?: 'read' | 'unread'
  important?: boolean
  flagged?: boolean
  security?: 'signed' | 'encrypted'
  /** Inclusive lower bound (epoch ms). */
  dateFrom?: number
  /** Exclusive upper bound (epoch ms). */
  dateTo?: number
  minSize?: number
  maxSize?: number
  kinds?: ItemKind[]
}

type FieldKey =
  | SearchField
  | 'folder'
  | 'has'
  | 'is'
  | 'before'
  | 'until'
  | 'after'
  | 'date'
  | 'larger'
  | 'smaller'
  | 'type'

const FIELD_ALIASES: Record<string, FieldKey> = {
  from: 'from',
  von: 'from',
  absender: 'from',
  sender: 'from',
  to: 'to',
  an: 'to',
  cc: 'to',
  bcc: 'to',
  empfänger: 'to',
  empfaenger: 'to',
  recipient: 'to',
  subject: 'subject',
  betreff: 'subject',
  body: 'body',
  text: 'body',
  inhalt: 'body',
  nachricht: 'body',
  attachment: 'attachments',
  attachments: 'attachments',
  anhang: 'attachments',
  anhänge: 'attachments',
  datei: 'attachments',
  file: 'attachments',
  filename: 'attachments',
  folder: 'folder',
  ordner: 'folder',
  in: 'folder',
  has: 'has',
  hat: 'has',
  is: 'is',
  ist: 'is',
  before: 'before',
  vor: 'before',
  bis: 'until',
  until: 'until',
  after: 'after',
  nach: 'after',
  ab: 'after',
  since: 'after',
  seit: 'after',
  date: 'date',
  datum: 'date',
  year: 'date',
  jahr: 'date',
  on: 'date',
  am: 'date',
  larger: 'larger',
  größer: 'larger',
  groesser: 'larger',
  size: 'larger',
  größe: 'larger',
  groesse: 'larger',
  min: 'larger',
  smaller: 'smaller',
  kleiner: 'smaller',
  max: 'smaller',
  type: 'type',
  typ: 'type',
  art: 'type',
  kind: 'type'
}

const KIND_ALIASES: Record<string, ItemKind[]> = {
  mail: ['mail', 'meeting'],
  email: ['mail', 'meeting'],
  'e-mail': ['mail', 'meeting'],
  nachricht: ['mail', 'meeting'],
  message: ['mail', 'meeting'],
  meeting: ['meeting'],
  besprechung: ['meeting'],
  einladung: ['meeting'],
  invitation: ['meeting'],
  appointment: ['appointment'],
  termin: ['appointment'],
  calendar: ['appointment'],
  kalender: ['appointment'],
  event: ['appointment'],
  contact: ['contact'],
  kontakt: ['contact'],
  task: ['task'],
  aufgabe: ['task'],
  todo: ['task'],
  note: ['note'],
  notiz: ['note'],
  journal: ['journal']
}

const FOLDED_FIELD_ALIASES: Record<string, FieldKey> = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([alias, key]) => [fold(alias), key])
)

interface RawToken {
  text: string
  quoted: boolean
  negate: boolean
  field: string | null
}

/** Splits the query into tokens, keeping quoted strings together. */
function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    while (i < n && /\s/.test(input[i])) i++
    if (i >= n) break

    let negate = false
    if (input[i] === '-' && i + 1 < n && !/\s/.test(input[i + 1])) {
      negate = true
      i++
    }

    let field: string | null = null
    // field:value or field:"quoted value"
    const fieldMatch = /^([\p{L}-]+):(?=\S)/u.exec(input.slice(i))
    if (fieldMatch) {
      field = fieldMatch[1]
      i += fieldMatch[0].length
    }

    if (input[i] === '"' || input[i] === '“' || input[i] === '„') {
      const close = input[i] === '"' ? /"/g : /[”“"]/g
      close.lastIndex = i + 1
      const m = close.exec(input)
      const end = m ? m.index : n
      tokens.push({ text: input.slice(i + 1, end), quoted: true, negate, field })
      i = end + 1
      continue
    }

    let j = i
    while (j < n && !/\s/.test(input[j])) j++
    tokens.push({ text: input.slice(i, j), quoted: false, negate, field })
    i = j
  }
  return tokens
}

export function parseQuery(input: string, now: Date = new Date()): ParsedQuery {
  const result: ParsedQuery = { clauses: [], folderNames: [] }
  const tokens = tokenize(input)
  let pendingOr = false

  for (const token of tokens) {
    if (!token.quoted && !token.field && !token.negate && (token.text === 'OR' || token.text === 'ODER' || token.text === '|')) {
      pendingOr = result.clauses.length > 0
      continue
    }

    const key = token.field ? FOLDED_FIELD_ALIASES[fold(token.field)] : undefined
    if (token.field && !key) {
      // Unknown prefix such as "Re:" or "10:30" - treat the token as text.
      const raw = `${token.field}:${token.quoted ? `"${token.text}"` : token.text}`
      pushTextClause(result, null, raw, token.negate, pendingOr)
      pendingOr = false
      continue
    }

    if (!key || key === 'subject' || key === 'from' || key === 'to' || key === 'body' || key === 'attachments') {
      pushTextClause(result, key ?? null, token.text, token.negate, pendingOr)
      pendingOr = false
      continue
    }

    pendingOr = false
    if (!applyOperator(result, key, token.text, token.negate, now)) {
      // Not understood (e.g. "is:banana") - fall back to plain text search.
      pushTextClause(result, null, `${token.field}:${token.text}`, token.negate, false)
    }
  }
  return result
}

function pushTextClause(
  result: ParsedQuery,
  field: SearchField | null,
  text: string,
  negate: boolean,
  orWithPrevious: boolean
): void {
  const term = foldForIndex(text)
  if (!term) return
  const last = result.clauses[result.clauses.length - 1]
  if (orWithPrevious && last && !last.negate && !negate && last.field === field) {
    last.terms.push(term)
    return
  }
  result.clauses.push({ field, terms: [term], negate })
}

function applyOperator(result: ParsedQuery, key: FieldKey, rawValue: string, negate: boolean, now: Date): boolean {
  const value = fold(rawValue.trim())
  switch (key) {
    case 'folder':
      if (!value) return false
      result.folderNames.push(foldForIndex(rawValue))
      return true
    case 'has':
      if (/^(attachments?|anh(a|ä)nge?|anhaenge|files?|dateien?)$/.test(value)) {
        result.hasAttachments = !negate
        return true
      }
      if (/^(flags?|markierung|fahne)$/.test(value)) {
        result.flagged = !negate
        return true
      }
      return false
    case 'is':
      if (/^(unread|ungelesen|neu|new)$/.test(value)) {
        result.readState = negate ? 'read' : 'unread'
        return true
      }
      if (/^(read|gelesen)$/.test(value)) {
        result.readState = negate ? 'unread' : 'read'
        return true
      }
      if (/^(important|wichtig|high|hoch)$/.test(value)) {
        result.important = !negate
        return true
      }
      if (/^(flagged|markiert|starred)$/.test(value)) {
        result.flagged = !negate
        return true
      }
      if (/^(signed|signiert)$/.test(value)) {
        result.security = 'signed'
        return true
      }
      if (/^(encrypted|verschlusselt|verschluesselt)$/.test(value)) {
        result.security = 'encrypted'
        return true
      }
      return false
    case 'before': {
      const range = parseDateRange(value, now)
      if (!range) return false
      result.dateTo = minDefined(result.dateTo, range.start)
      return true
    }
    case 'until': {
      // Unlike "before", "until" includes the named period.
      const range = parseDateRange(value, now)
      if (!range) return false
      result.dateTo = minDefined(result.dateTo, range.end)
      return true
    }
    case 'after': {
      const range = parseDateRange(value, now)
      if (!range) return false
      result.dateFrom = maxDefined(result.dateFrom, range.start)
      return true
    }
    case 'date': {
      const range = parseDateRange(value, now)
      if (!range) return false
      result.dateFrom = maxDefined(result.dateFrom, range.start)
      result.dateTo = minDefined(result.dateTo, range.end)
      return true
    }
    case 'larger': {
      const size = parseSize(value)
      if (size === null) return false
      result.minSize = size
      return true
    }
    case 'smaller': {
      const size = parseSize(value)
      if (size === null) return false
      result.maxSize = size
      return true
    }
    case 'type': {
      const kinds = KIND_ALIASES[value]
      if (!kinds) return false
      result.kinds = [...new Set([...(result.kinds ?? []), ...kinds])]
      return true
    }
    default:
      return false
  }
}

function minDefined(a: number | undefined, b: number): number {
  return a === undefined ? b : Math.min(a, b)
}

function maxDefined(a: number | undefined, b: number): number {
  return a === undefined ? b : Math.max(a, b)
}

export interface DateRange {
  start: number
  end: number
}

/**
 * Parses a (local time) date expression into a half-open range.
 * Accepts YYYY, YYYY-MM, YYYY-MM-DD, YYYY/MM/DD, DD.MM.YYYY, MM.YYYY,
 * DD.MM.YY, "today"/"heute" and "yesterday"/"gestern".
 */
export function parseDateRange(value: string, now: Date = new Date()): DateRange | null {
  const v = value.trim().toLowerCase()
  const day = (y: number, m: number, d: number): DateRange | null => {
    const start = new Date(y, m - 1, d)
    if (start.getFullYear() !== y || start.getMonth() !== m - 1 || start.getDate() !== d) return null
    return { start: start.getTime(), end: new Date(y, m - 1, d + 1).getTime() }
  }
  if (v === 'today' || v === 'heute') return day(now.getFullYear(), now.getMonth() + 1, now.getDate())
  if (v === 'yesterday' || v === 'gestern') {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    return day(y.getFullYear(), y.getMonth() + 1, y.getDate())
  }

  let m = /^(\d{4})$/.exec(v)
  if (m) {
    const y = Number(m[1])
    return { start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime() }
  }
  m = /^(\d{4})[-/.](\d{1,2})$/.exec(v) ?? null
  if (m) return month(Number(m[1]), Number(m[2]))
  m = /^(\d{1,2})[./](\d{4})$/.exec(v)
  if (m) return month(Number(m[2]), Number(m[1]))
  m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v)
  if (m) return day(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(v)
  if (m) {
    let y = Number(m[3])
    if (y < 100) y += y >= 70 ? 1900 : 2000
    return day(y, Number(m[2]), Number(m[1]))
  }
  return null
}

function month(y: number, m: number): DateRange | null {
  if (m < 1 || m > 12) return null
  return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() }
}

/** Parses sizes such as "500kb", "1.5 MB", "2m" or "1024" (bytes). */
export function parseSize(value: string): number | null {
  const m = /^>?=?\s*(\d+(?:[.,]\d+)?)\s*(b|k|kb|kib|m|mb|mib|g|gb|gib)?$/i.exec(value.trim())
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const unit = (m[2] ?? 'b').toLowerCase()
  const factor = unit.startsWith('g') ? 1024 ** 3 : unit.startsWith('m') ? 1024 ** 2 : unit.startsWith('k') ? 1024 : 1
  return Math.round(n * factor)
}

/** Positive terms of a parsed query, for highlighting. */
export function highlightTerms(query: ParsedQuery): string[] {
  const terms = new Set<string>()
  for (const clause of query.clauses) {
    if (clause.negate) continue
    for (const term of clause.terms) terms.add(term)
  }
  // Longer terms first so that overlapping highlights prefer the longest match.
  return [...terms].sort((a, b) => b.length - a.length)
}

/** True if the query restricts the result beyond folder browsing. */
export function isEmptyQuery(query: ParsedQuery): boolean {
  return (
    query.clauses.length === 0 &&
    query.folderNames.length === 0 &&
    query.hasAttachments === undefined &&
    query.readState === undefined &&
    query.important === undefined &&
    query.flagged === undefined &&
    query.security === undefined &&
    query.dateFrom === undefined &&
    query.dateTo === undefined &&
    query.minSize === undefined &&
    query.maxSize === undefined &&
    query.kinds === undefined
  )
}
