import type { DateGroup, ResultGroup, SearchField, SearchFilters, SearchRequest } from '../shared/types'
import { foldForIndex } from '../shared/text'
import { hasActiveFilters } from '../shared/filters'
import { highlightTerms, isEmptyQuery, parseQuery, type ParsedQuery, type QueryClause } from '../shared/query'
import type { IndexedItem, PstIndex } from './indexer'
import { ATTACHMENT_TYPE_BITS } from './attachmentTypes'

export interface SearchOutcome {
  /** Indices into PstIndex#items, in display order. */
  order: Int32Array
  groups: ResultGroup[]
  highlightTerms: string[]
  /** Terms that may have matched in the body (used for snippets). */
  bodyTerms: string[]
  isSearch: boolean
}

export function runSearch(index: PstIndex, req: SearchRequest): SearchOutcome {
  const now = new Date(req.now)
  const parsed = parseQuery(req.text, now)
  const predicate = buildPredicate(index, req, parsed, now)

  const matches: number[] = []
  const items = index.items
  for (let i = 0; i < items.length; i++) {
    if (predicate(items[i])) matches.push(i)
  }

  sortMatches(items, matches, req)
  const order = Int32Array.from(matches)
  const groups = req.sort.field === 'date' ? groupByDate(items, order, now, req.firstDayOfWeek) : []
  const terms = highlightTerms(parsed)
  const enabledFields = effectiveFields(req.filters)
  const bodyTerms = parsed.clauses
    .filter((c) => !c.negate && (c.field === 'body' || (c.field === null && enabledFields.includes('body'))))
    .flatMap((c) => c.terms)

  return {
    order,
    groups,
    highlightTerms: terms,
    bodyTerms,
    isSearch: !isEmptyQuery(parsed) || hasActiveFilters(req.filters) || req.folderId === null
  }
}

function effectiveFields(filters: SearchFilters): SearchField[] {
  return filters.fields.length > 0 ? filters.fields : ['subject', 'from', 'to', 'body', 'attachments']
}

function buildPredicate(index: PstIndex, req: SearchRequest, q: ParsedQuery, now: Date): (item: IndexedItem) => boolean {
  const f = req.filters
  const checks: ((item: IndexedItem) => boolean)[] = []

  // Folder scope
  let allowedFolders: Set<number> | null = null
  if (req.folderId !== null) {
    allowedFolders = req.includeSubfolders ? (index.subtreeIds.get(req.folderId) ?? new Set([req.folderId])) : new Set([req.folderId])
  }
  if (q.folderNames.length > 0) {
    const named = new Set<number>()
    for (const node of index.folderById.values()) {
      const name = foldForIndex(node.name)
      if (q.folderNames.some((n) => name.includes(n))) {
        for (const id of index.subtreeIds.get(node.id) ?? [node.id]) named.add(id)
      }
    }
    allowedFolders = allowedFolders ? new Set([...allowedFolders].filter((id) => named.has(id))) : named
  }
  if (allowedFolders) {
    const allowed = allowedFolders
    checks.push((item) => allowed.has(item.folderId))
  }

  // Date range
  let from = q.dateFrom ?? -Infinity
  let to = q.dateTo ?? Infinity
  const preset = presetRange(f, now)
  if (preset) {
    from = Math.max(from, preset.from)
    to = Math.min(to, preset.to)
  }
  if (Number.isFinite(from) || Number.isFinite(to)) {
    checks.push((item) => item.date >= from && item.date < to)
  }

  // Kinds
  let kinds = f.kinds.length > 0 ? new Set(f.kinds) : null
  if (q.kinds) kinds = kinds ? new Set(q.kinds.filter((k) => kinds!.has(k))) : new Set(q.kinds)
  if (kinds) {
    const allowedKinds = kinds
    checks.push((item) => allowedKinds.has(item.kind))
  }

  // Flags
  const hasAttachments = f.hasAttachments || q.hasAttachments === true
  if (hasAttachments) checks.push((item) => item.attachmentCount > 0)
  if (q.hasAttachments === false) checks.push((item) => item.attachmentCount === 0)
  if (f.attachmentType) {
    const bit = ATTACHMENT_TYPE_BITS[f.attachmentType]
    checks.push((item) => (item.attachmentKinds & bit) !== 0)
  }
  const readState = q.readState ?? (f.readState !== 'any' ? f.readState : undefined)
  if (readState === 'unread') checks.push((item) => !item.isRead)
  if (readState === 'read') checks.push((item) => item.isRead)
  if (f.important || q.important === true) checks.push((item) => item.importance === 2)
  if (q.important === false) checks.push((item) => item.importance !== 2)
  if (f.flagged || q.flagged === true) checks.push((item) => item.flagged)
  if (q.flagged === false) checks.push((item) => !item.flagged)
  if (q.security) {
    const security = q.security
    checks.push((item) => item.security === security)
  }

  // Size
  const minSize = Math.max(f.minSize ?? 0, q.minSize ?? 0)
  if (minSize > 0) checks.push((item) => item.size >= minSize)
  if (q.maxSize !== undefined) {
    const maxSize = q.maxSize
    checks.push((item) => item.size <= maxSize)
  }

  // Sender / recipient filters from the filter panel
  const fromFilter = foldForIndex(f.from)
  if (fromFilter) checks.push((item) => item.sFrom.includes(fromFilter))
  const toFilter = foldForIndex(f.to)
  if (toFilter) checks.push((item) => item.sTo.includes(toFilter))

  // Text clauses - checked last as they are the most expensive.
  const fields = effectiveFields(f)
  for (const clause of q.clauses) checks.push(clauseMatcher(clause, fields))

  if (checks.length === 0) return () => true
  return (item) => {
    for (let i = 0; i < checks.length; i++) if (!checks[i](item)) return false
    return true
  }
}

function fieldValue(item: IndexedItem, field: SearchField): string {
  switch (field) {
    case 'subject':
      return item.sSubject
    case 'from':
      return item.sFrom
    case 'to':
      return item.sTo
    case 'body':
      return item.sBody
    case 'attachments':
      return item.sAttach
  }
}

function clauseMatcher(clause: QueryClause, enabled: SearchField[]): (item: IndexedItem) => boolean {
  const fields = clause.field ? [clause.field] : enabled
  const { terms, negate } = clause
  const found = (item: IndexedItem): boolean => {
    for (const field of fields) {
      const value = fieldValue(item, field)
      for (const term of terms) if (value.includes(term)) return true
    }
    return false
  }
  return negate ? (item) => !found(item) : found
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function presetRange(f: SearchFilters, now: Date): { from: number; to: number } | null {
  const today = startOfDay(now)
  switch (f.datePreset) {
    case 'any':
      return null
    case 'today':
      return { from: today, to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() }
    case 'week':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime(), to: Infinity }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime(), to: Infinity }
    case 'year':
      return { from: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime(), to: Infinity }
    case 'custom': {
      const from = f.dateFrom ? parseIsoDate(f.dateFrom) : null
      const to = f.dateTo ? parseIsoDate(f.dateTo) : null
      if (from === null && to === null) return null
      return { from: from ?? -Infinity, to: to !== null ? addDays(to, 1) : Infinity }
    }
  }
}

function addDays(time: number, days: number): number {
  const d = new Date(time)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

function parseIsoDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

const SUBJECT_PREFIX = /^((re|aw|wg|fw|fwd|antw|wtr|tr|sv|vs|rif|r|ref)\s*(\[\d+\])?\s*:\s*)+/i

function sortKeySubject(item: IndexedItem): string {
  return item.sSubject.replace(SUBJECT_PREFIX, '')
}

function sortMatches(items: IndexedItem[], matches: number[], req: SearchRequest): void {
  const dir = req.sort.dir === 'asc' ? 1 : -1
  const byDate = (a: number, b: number): number => items[a].date - items[b].date || a - b
  switch (req.sort.field) {
    case 'date':
      matches.sort((a, b) => dir * byDate(a, b))
      break
    case 'size':
      matches.sort((a, b) => dir * (items[a].size - items[b].size) || -byDate(a, b))
      break
    case 'from': {
      const keys = new Map<number, string>()
      for (const i of matches) keys.set(i, foldForIndex(items[i].fromName || items[i].fromEmail))
      matches.sort((a, b) => dir * compareStrings(keys.get(a)!, keys.get(b)!) || -byDate(a, b))
      break
    }
    case 'subject': {
      const keys = new Map<number, string>()
      for (const i of matches) keys.set(i, sortKeySubject(items[i]))
      matches.sort((a, b) => dir * compareStrings(keys.get(a)!, keys.get(b)!) || -byDate(a, b))
      break
    }
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function groupKey(group: DateGroup): string {
  return group.kind === 'month' ? `m-${group.year}-${group.month}` : group.kind
}

function groupByDate(items: IndexedItem[], order: Int32Array, now: Date, firstDayOfWeek: number): ResultGroup[] {
  const today = startOfDay(now)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
  const daysSinceWeekStart = (now.getDay() - firstDayOfWeek + 7) % 7
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceWeekStart).getTime()
  const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceWeekStart - 7).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const classify = (t: number): DateGroup => {
    if (!t) return { kind: 'unknown' }
    if (t >= today && t < tomorrow) return { kind: 'today' }
    if (t >= yesterday && t < today) return { kind: 'yesterday' }
    if (t >= weekStart && t < yesterday) return { kind: 'thisWeek' }
    if (t >= lastWeekStart && t < weekStart && t < yesterday) return { kind: 'lastWeek' }
    if (t >= monthStart && t < tomorrow) return { kind: 'thisMonth' }
    const d = new Date(t)
    return { kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 }
  }

  const groups: ResultGroup[] = []
  let currentKey = ''
  for (let i = 0; i < order.length; i++) {
    const group = classify(items[order[i]].date)
    const key = groupKey(group)
    if (key !== currentKey) {
      groups.push({ group, start: i, count: 0 })
      currentKey = key
    }
    groups[groups.length - 1].count++
  }
  return groups
}
