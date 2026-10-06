import { Flag, Paperclip, TriangleAlert } from 'lucide-react'
import { countActiveFilters } from '@shared/filters'
import { DEFAULT_FILTERS, type SearchFilters } from '@shared/types'
import { kindLabel, t } from '@/i18n'
import { formatShortDate, formatSize } from '@/lib/format'
import { useApp } from '@/store'
import { Chip } from './ui/Controls'

interface ActiveFilter {
  key: string
  label: string
  icon?: typeof Flag
  reset: Partial<SearchFilters>
}

function describe(f: SearchFilters): ActiveFilter[] {
  const result: ActiveFilter[] = []
  if (f.datePreset !== 'any') {
    const value =
      f.datePreset === 'custom'
        ? [f.dateFrom ? formatShortDate(new Date(f.dateFrom).getTime()) : '…', f.dateTo ? formatShortDate(new Date(f.dateTo).getTime()) : '…'].join(' – ')
        : t(`date_${f.datePreset}`)
    result.push({ key: 'date', label: t('chipDate', { value }), reset: { datePreset: 'any', dateFrom: null, dateTo: null } })
  }
  if (f.from.trim()) result.push({ key: 'from', label: t('chipFrom', { value: f.from }), reset: { from: '' } })
  if (f.to.trim()) result.push({ key: 'to', label: t('chipTo', { value: f.to }), reset: { to: '' } })
  if (f.readState !== 'any') result.push({ key: 'read', label: t(`read_${f.readState}`), reset: { readState: 'any' } })
  if (f.hasAttachments) result.push({ key: 'att', label: t('flagHasAttachments'), icon: Paperclip, reset: { hasAttachments: false } })
  if (f.attachmentType) result.push({ key: 'attType', label: t('chipAttachmentType', { value: t(`att_${f.attachmentType}`) }), reset: { attachmentType: null } })
  if (f.important) result.push({ key: 'imp', label: t('flagImportant'), icon: TriangleAlert, reset: { important: false } })
  if (f.flagged) result.push({ key: 'flag', label: t('flagFlagged'), icon: Flag, reset: { flagged: false } })
  if (f.minSize !== null) result.push({ key: 'size', label: t('chipSize', { value: formatSize(f.minSize) }), reset: { minSize: null } })
  if (f.kinds.length > 0) result.push({ key: 'kinds', label: t('chipKinds', { value: f.kinds.map((k) => kindLabel(k)).join(', ') }), reset: { kinds: [] } })
  if (f.fields.length > 0) result.push({ key: 'fields', label: t('chipFields', { value: f.fields.map((x) => t(`field_${x}`)).join(', ') }), reset: { fields: [] } })
  return result
}

/** Removable chips summarising the active filters. */
export function FilterChips() {
  const filters = useApp((s) => s.filters)
  const setFilters = useApp((s) => s.setFilters)
  const active = describe(filters)
  if (active.length === 0) return null
  return (
    <div className="flex animate-fade-in flex-wrap items-center gap-1.5 px-3 pb-2.5">
      {active.map((f) => (
        <Chip key={f.key} icon={f.icon} onRemove={() => setFilters(f.reset)} removeLabel={t('resetFilters')} onClick={() => useApp.getState().setUi({ filtersOpen: true })}>
          {f.label}
        </Chip>
      ))}
      {countActiveFilters(filters) > 1 && (
        <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS })} className="h-7 rounded-full px-2 text-[12px] font-medium text-accent hover:underline">
          {t('resetAll')}
        </button>
      )}
    </div>
  )
}
