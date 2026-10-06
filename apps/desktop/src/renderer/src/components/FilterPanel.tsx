import { CircleHelp, Flag, Paperclip, RotateCcw, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { countActiveFilters } from '@shared/filters'
import { ALL_SEARCH_FIELDS, type AttachmentType, type DatePreset, type ItemKind, type ReadState, type SearchField } from '@shared/types'
import { kindLabel, t } from '@/i18n'
import { useApp } from '@/store'
import { Button } from './ui/Button'
import { Chip, SectionLabel, Segmented } from './ui/Controls'

const KINDS: ItemKind[] = ['mail', 'meeting', 'appointment', 'contact', 'task', 'note']
const ATTACHMENT_TYPES: AttachmentType[] = ['pdf', 'image', 'office', 'archive', 'calendar', 'message']
const SIZES: { value: string; bytes: number | null; label: string }[] = [
  { value: 'any', bytes: null, label: '' },
  { value: '100k', bytes: 100 * 1024, label: '100 KB' },
  { value: '1m', bytes: 1024 * 1024, label: '1 MB' },
  { value: '10m', bytes: 10 * 1024 * 1024, label: '10 MB' }
]

export function FilterPanel() {
  const filters = useApp((s) => s.filters)
  const setFilters = useApp((s) => s.setFilters)
  const resetFilters = useApp((s) => s.resetFilters)
  const senders = useApp((s) => s.senders)
  const sendersListId = useId()
  const active = countActiveFilters(filters)

  const fields = filters.fields.length > 0 ? filters.fields : ALL_SEARCH_FIELDS
  const toggleField = (field: SearchField): void => {
    const next = fields.includes(field) ? fields.filter((f) => f !== field) : [...fields, field]
    setFilters({ fields: next.length === 0 || next.length === ALL_SEARCH_FIELDS.length ? [] : next })
  }

  const toggleKind = (kind: ItemKind): void => {
    const next = filters.kinds.includes(kind) ? filters.kinds.filter((k) => k !== kind) : [...filters.kinds, kind]
    setFilters({ kinds: next })
  }

  const sizeValue = SIZES.find((s) => s.bytes === filters.minSize)?.value ?? 'any'

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 p-4">
        <Section label={t('filterSearchIn')}>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SEARCH_FIELDS.map((field) => (
              <Chip key={field} selected={fields.includes(field)} onClick={() => toggleField(field)}>
                {t(`field_${field}`)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section label={t('filterDate')}>
          <Segmented<DatePreset>
            label={t('filterDate')}
            value={filters.datePreset}
            onChange={(datePreset) => setFilters({ datePreset })}
            size="sm"
            className="w-full"
            options={(['any', 'today', 'week', 'month', 'year', 'custom'] as const).map((value) => ({ value, label: t(`date_${value}`) }))}
          />
          {filters.datePreset === 'custom' && (
            <div className="mt-2 flex animate-fade-in items-center gap-2">
              <DateInput label={t('dateFrom')} value={filters.dateFrom} max={filters.dateTo} onChange={(dateFrom) => setFilters({ dateFrom })} />
              <span className="text-fg-subtle">–</span>
              <DateInput label={t('dateTo')} value={filters.dateTo} min={filters.dateFrom} onChange={(dateTo) => setFilters({ dateTo })} />
            </div>
          )}
        </Section>

        <Section label={t('filterPeople')}>
          <div className="grid grid-cols-2 gap-2">
            <DebouncedInput value={filters.from} placeholder={t('filterFromPlaceholder')} list={sendersListId} onChange={(from) => setFilters({ from })} label={t('field_from')} />
            <DebouncedInput value={filters.to} placeholder={t('filterToPlaceholder')} onChange={(to) => setFilters({ to })} label={t('field_to')} />
          </div>
          <datalist id={sendersListId}>
            {senders.slice(0, 300).map((s) => (
              <option key={s.email || s.name} value={s.email || s.name}>
                {s.name}
              </option>
            ))}
          </datalist>
        </Section>

        <Section label={t('filterStatus')}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Segmented<ReadState>
              label={t('filterStatus')}
              value={filters.readState}
              onChange={(readState) => setFilters({ readState })}
              size="sm"
              options={(['any', 'unread', 'read'] as const).map((value) => ({ value, label: t(`read_${value}`) }))}
            />
            <Chip icon={Paperclip} selected={filters.hasAttachments} onClick={() => setFilters({ hasAttachments: !filters.hasAttachments })}>
              {t('flagHasAttachments')}
            </Chip>
            <Chip icon={TriangleAlert} selected={filters.important} onClick={() => setFilters({ important: !filters.important })}>
              {t('flagImportant')}
            </Chip>
            <Chip icon={Flag} selected={filters.flagged} onClick={() => setFilters({ flagged: !filters.flagged })}>
              {t('flagFlagged')}
            </Chip>
          </div>
        </Section>

        <Section label={t('filterAttachmentType')}>
          <div className="flex flex-wrap gap-1.5">
            {ATTACHMENT_TYPES.map((type) => (
              <Chip key={type} selected={filters.attachmentType === type} onClick={() => setFilters({ attachmentType: filters.attachmentType === type ? null : type })}>
                {t(`att_${type}`)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section label={t('filterKinds')}>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((kind) => (
              <Chip key={kind} selected={filters.kinds.includes(kind)} onClick={() => toggleKind(kind)}>
                {kindLabel(kind)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section label={t('filterSize')}>
          <Segmented
            label={t('filterSize')}
            value={sizeValue}
            onChange={(value) => setFilters({ minSize: SIZES.find((s) => s.value === value)?.bytes ?? null })}
            size="sm"
            options={SIZES.map((s) => ({ value: s.value, label: s.bytes === null ? t('size_any') : `≥ ${s.label}` }))}
          />
        </Section>
      </div>

      <footer className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <Button variant="ghost" size="sm" icon={CircleHelp} onClick={() => useApp.getState().setUi({ helpOpen: true, filtersOpen: false })}>
          {t('searchSyntax')}
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} disabled={active === 0} onClick={resetFilters}>
          {t('resetFilters')}
        </Button>
      </footer>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionLabel className="mb-2">{label}</SectionLabel>
      {children}
    </section>
  )
}

function DateInput({ label, value, min, max, onChange }: { label: string; value: string | null; min?: string | null; max?: string | null; onChange: (value: string | null) => void }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={value ?? ''}
      min={min ?? undefined}
      max={max ?? undefined}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[12.5px] outline-none focus:border-accent"
    />
  )
}

function DebouncedInput({ value, onChange, placeholder, list, label }: { value: string; onChange: (value: string) => void; placeholder: string; list?: string; label: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  useEffect(() => {
    if (local === value) return
    const timer = setTimeout(() => onChange(local), 250)
    return () => clearTimeout(timer)
  }, [local, value, onChange])
  return (
    <input
      type="text"
      aria-label={label}
      value={local}
      list={list}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => setLocal(event.target.value)}
      className="h-8 min-w-0 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] outline-none placeholder:text-fg-subtle focus:border-accent"
    />
  )
}
