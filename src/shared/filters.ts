import { DEFAULT_FILTERS, type AttachmentType, type DatePreset, type ItemKind, type ReadState, type SearchField, type SearchFilters, type SortSpec } from './types'

/** Number of filters that differ from the defaults (for badges). */
export function countActiveFilters(f: SearchFilters): number {
  return (
    (f.fields.length > 0 ? 1 : 0) +
    (f.datePreset !== 'any' ? 1 : 0) +
    (f.from.trim() !== '' ? 1 : 0) +
    (f.to.trim() !== '' ? 1 : 0) +
    (f.hasAttachments ? 1 : 0) +
    (f.attachmentType !== null ? 1 : 0) +
    (f.readState !== 'any' ? 1 : 0) +
    (f.important ? 1 : 0) +
    (f.flagged ? 1 : 0) +
    (f.minSize !== null ? 1 : 0) +
    (f.kinds.length > 0 ? 1 : 0)
  )
}

/** True if any filter restricts the result (search fields alone do not). */
export function hasActiveFilters(f: SearchFilters): boolean {
  return countActiveFilters(f) - (f.fields.length > 0 ? 1 : 0) > 0
}

const SEARCH_FIELDS = new Set<SearchField>(['subject', 'from', 'to', 'body', 'attachments'])
const DATE_PRESETS = new Set<DatePreset>(['any', 'today', 'week', 'month', 'year', 'custom'])
const ATTACHMENT_TYPES = new Set<AttachmentType>(['pdf', 'image', 'office', 'archive', 'calendar', 'message'])
const READ_STATES = new Set<ReadState>(['any', 'unread', 'read'])
const ITEM_KINDS = new Set<ItemKind>(['mail', 'meeting', 'appointment', 'contact', 'task', 'note', 'journal', 'other'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Coerces untrusted input (e.g. from IPC) into valid search filters. */
export function sanitizeFilters(input: unknown): SearchFilters {
  const f = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof SearchFilters, unknown>>
  const text = (value: unknown): string => (typeof value === 'string' ? value.slice(0, 500) : '')
  const date = (value: unknown): string | null => (typeof value === 'string' && ISO_DATE.test(value) ? value : null)
  const list = <T>(value: unknown, allowed: Set<T>): T[] => (Array.isArray(value) ? [...new Set(value.filter((v): v is T => allowed.has(v as T)))] : [])
  return {
    fields: list(f.fields, SEARCH_FIELDS),
    datePreset: DATE_PRESETS.has(f.datePreset as DatePreset) ? (f.datePreset as DatePreset) : DEFAULT_FILTERS.datePreset,
    dateFrom: date(f.dateFrom),
    dateTo: date(f.dateTo),
    from: text(f.from),
    to: text(f.to),
    hasAttachments: f.hasAttachments === true,
    attachmentType: ATTACHMENT_TYPES.has(f.attachmentType as AttachmentType) ? (f.attachmentType as AttachmentType) : null,
    readState: READ_STATES.has(f.readState as ReadState) ? (f.readState as ReadState) : DEFAULT_FILTERS.readState,
    important: f.important === true,
    flagged: f.flagged === true,
    minSize: typeof f.minSize === 'number' && Number.isFinite(f.minSize) && f.minSize > 0 ? f.minSize : null,
    kinds: list(f.kinds, ITEM_KINDS)
  }
}

/** Coerces untrusted input into a valid sort specification. */
export function sanitizeSort(input: unknown): SortSpec {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof SortSpec, unknown>>
  const field = s.field === 'from' || s.field === 'subject' || s.field === 'size' ? s.field : 'date'
  return { field, dir: s.dir === 'asc' ? 'asc' : 'desc' }
}
