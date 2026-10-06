import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import {
  ArrowDownUp,
  Calendar,
  CalendarClock,
  Contact,
  Flag,
  KeyRound,
  ListTodo,
  type LucideIcon,
  Paperclip,
  SearchX,
  ShieldCheck,
  StickyNote,
  TriangleAlert,
  Inbox as InboxIcon
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { FolderNode, MessageSummary, SortField } from '@shared/types'
import { dateGroupLabel, kindLabel, t, tp } from '@/i18n'
import { folderName } from '@/lib/folders'
import { formatListDate } from '@/lib/format'
import { isSearching, resultSummary, useApp, type ResultInfo } from '@/store'
import { Highlight } from './Highlight'
import { Button, IconButton } from './ui/Button'
import { Segmented, Spinner } from './ui/Controls'
import { Menu, type MenuEntry } from './ui/Overlay'
import { FilterChips } from './FilterChips'

const ROW_HEIGHT = 86
const HEADER_HEIGHT = 34

interface RowModel {
  count: number
  /** Item index for a row, or -(groupIndex + 1) for a group header. */
  rowItem: Int32Array
  /** Row index of an item. */
  itemRow: Int32Array
}

function buildRows(result: ResultInfo | null): RowModel {
  if (!result) return { count: 0, rowItem: new Int32Array(0), itemRow: new Int32Array(0) }
  const { total, groups } = result
  const showGroups = groups.length > 0
  const count = total + (showGroups ? groups.length : 0)
  const rowItem = new Int32Array(count)
  const itemRow = new Int32Array(total)
  if (!showGroups) {
    for (let i = 0; i < total; i++) {
      rowItem[i] = i
      itemRow[i] = i
    }
  } else {
    let row = 0
    groups.forEach((group, g) => {
      rowItem[row++] = -(g + 1)
      for (let i = group.start; i < group.start + group.count; i++) {
        rowItem[row] = i
        itemRow[i] = row
        row++
      }
    })
  }
  return { count, rowItem, itemRow }
}

export function MessageList({ width }: { width: number }) {
  const result = useApp((s) => s.result)
  const items = useApp((s) => s.items)
  const selectedIndex = useApp((s) => s.selectedIndex)
  const ensureRange = useApp((s) => s.ensureRange)
  const selectIndex = useApp((s) => s.selectIndex)
  const folderInfo = useApp((s) => s.folderInfo)

  const rows = useMemo(() => buildRows(result), [result])
  const scroller = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  const virtualizer = useVirtualizer({
    count: rows.count,
    getScrollElement: () => scroller.current,
    estimateSize: (row) => (rows.rowItem[row] < 0 ? HEADER_HEIGHT : ROW_HEIGHT),
    getItemKey: (row) => `${result?.token ?? 0}:${rows.rowItem[row]}`,
    overscan: 8
  })

  // New rows: re-measure. New query: start at the top.
  useEffect(() => {
    virtualizer.measure()
  }, [result?.token, virtualizer])
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [result?.signature])

  // Load the summaries of the visible rows.
  const virtualRows = virtualizer.getVirtualItems()
  const firstRow = virtualRows[0]?.index ?? 0
  const lastRow = virtualRows[virtualRows.length - 1]?.index ?? 0
  useEffect(() => {
    if (!result || rows.count === 0) return
    let start = -1
    let end = -1
    for (let row = firstRow; row <= lastRow; row++) {
      const item = rows.rowItem[row]
      if (item < 0) continue
      if (start < 0) start = item
      end = item
    }
    if (start >= 0) ensureRange(start, end)
  }, [firstRow, lastRow, rows, result, ensureRange])

  // Keep the selection visible during keyboard navigation.
  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= rows.itemRow.length) return
    virtualizer.scrollToIndex(rows.itemRow[selectedIndex], { align: 'auto' })
  }, [selectedIndex, rows, virtualizer])

  // Floating group header for the first visible row.
  const stickyGroup = useMemo(() => {
    if (!result || result.groups.length === 0) return null
    const offset = virtualizer.scrollOffset ?? 0
    const top = virtualRows.find((r) => r.end > offset + 1)
    if (!top) return null
    const item = rows.rowItem[top.index]
    if (item < 0) return top.start < offset ? result.groups[-item - 1] : null
    return result.groups.find((g) => item >= g.start && item < g.start + g.count) ?? null
  }, [result, virtualRows, rows, virtualizer.scrollOffset])

  const showFolder = !!result?.isSearch
  const selectedRow = selectedIndex >= 0 ? rows.itemRow[selectedIndex] : -1

  return (
    <section style={{ width }} className="flex h-full shrink-0 flex-col bg-surface" aria-label={t('searchResults')}>
      <ListHeader />
      <FilterChips />
      <SearchProgress />
      {result && result.total === 0 ? (
        <EmptyList />
      ) : (
        <div
          ref={scroller}
          role="listbox"
          tabIndex={0}
          aria-label={resultSummary(result)}
          aria-activedescendant={selectedIndex >= 0 ? `msg-${selectedIndex}` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="relative min-h-0 flex-1 overflow-y-auto outline-none"
        >
          {stickyGroup && (
            <div className="pointer-events-none sticky top-0 z-10 h-0">
              <GroupHeader label={dateGroupLabel(stickyGroup.group)} count={stickyGroup.count} floating />
            </div>
          )}
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const item = rows.rowItem[virtualRow.index]
              const style = { transform: `translateY(${virtualRow.start}px)`, height: virtualRow.size }
              if (item < 0) {
                const group = result!.groups[-item - 1]
                return (
                  <div key={virtualRow.key} className="absolute top-0 left-0 w-full" style={style}>
                    <GroupHeader label={dateGroupLabel(group.group)} count={group.count} />
                  </div>
                )
              }
              const summary = items[item]
              return (
                <div key={virtualRow.key} className="absolute top-0 left-0 w-full px-2" style={style}>
                  {summary ? (
                    <MessageRow
                      index={item}
                      summary={summary}
                      selected={item === selectedIndex}
                      listFocused={focused}
                      beforeSelected={virtualRow.index + 1 === selectedRow}
                      terms={result!.highlightTerms}
                      folder={showFolder ? folderInfo.get(summary.folderId)?.node : undefined}
                      onSelect={selectIndex}
                    />
                  ) : (
                    <SkeletonRow />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function GroupHeader({ label, count, floating }: { label: string; count: number; floating?: boolean }) {
  return (
    <div
      className={clsx(
        'flex h-[34px] items-end gap-2 px-5 pb-1.5 text-[12px] font-semibold text-fg-muted',
        floating && 'border-b border-line bg-surface/85 backdrop-blur-md'
      )}
    >
      <span className="truncate">{label}</span>
      <span className="ml-auto font-normal text-fg-subtle tabular-nums">{count}</span>
    </div>
  )
}

const KIND_ICONS: Partial<Record<MessageSummary['kind'], LucideIcon>> = {
  meeting: CalendarClock,
  appointment: Calendar,
  contact: Contact,
  task: ListTodo,
  note: StickyNote
}

const MessageRow = memo(function MessageRow({
  index,
  summary,
  selected,
  listFocused,
  beforeSelected,
  terms,
  folder,
  onSelect
}: {
  index: number
  summary: MessageSummary
  selected: boolean
  listFocused: boolean
  beforeSelected: boolean
  terms: string[]
  folder?: FolderNode
  onSelect: (index: number) => void
}) {
  const sentFolder = useApp((s) => {
    const special = s.folderInfo.get(summary.folderId)?.node.special
    return special === 'sent' || special === 'drafts' || special === 'outbox'
  })
  const strong = selected && listFocused
  const person = sentFolder ? summary.toLine || summary.fromName : summary.fromName || summary.fromEmail
  const KindIcon = KIND_ICONS[summary.kind]
  const unread = !summary.isRead && (summary.kind === 'mail' || summary.kind === 'meeting')

  return (
    <div
      id={`msg-${index}`}
      role="option"
      aria-selected={selected}
      onMouseDown={() => onSelect(index)}
      className={clsx(
        'group relative flex h-full gap-2 rounded-xl py-2.5 pr-3 pl-1.5 transition-colors duration-75',
        strong ? 'bg-accent text-accent-fg' : selected ? 'bg-selected-muted' : 'hover:bg-hover'
      )}
    >
      <div className="flex w-3.5 shrink-0 justify-center pt-[5px]">
        {unread && <span className={clsx('size-2 rounded-full', strong ? 'bg-accent-fg' : 'bg-accent')} aria-label={t('unread')} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={clsx('min-w-0 flex-1 truncate text-[13.5px]', unread ? 'font-bold' : 'font-semibold')}>
            {sentFolder && summary.toLine ? <span className={strong ? 'opacity-80' : 'text-fg-muted'}>{t('to')}: </span> : null}
            {person ? <Highlight text={person} terms={terms} /> : <span className="italic opacity-70">{t('noSender')}</span>}
          </span>
          <span className={clsx('shrink-0 text-[11.5px] tabular-nums', strong ? 'text-accent-fg/85' : 'text-fg-muted')}>{formatListDate(summary.date)}</span>
        </div>
        <div className="mt-px flex items-center gap-1.5">
          {KindIcon && <KindIcon className="size-3.5 shrink-0 opacity-75" strokeWidth={2} aria-label={kindLabel(summary.kind, true)} />}
          <span className={clsx('min-w-0 flex-1 truncate text-[12.5px]', unread && 'font-semibold')}>
            {summary.subject ? <Highlight text={summary.subject} terms={terms} /> : <span className="italic opacity-70">{t('noSubject')}</span>}
          </span>
          {folder && (
            <span className={clsx('max-w-[110px] shrink-0 truncate rounded-md px-1.5 text-[10.5px] leading-[17px] font-medium', strong ? 'bg-white/20' : 'bg-fill text-fg-muted')}>
              {folderName(folder)}
            </span>
          )}
          <RowIcons summary={summary} strong={strong} />
        </div>
        <div className={clsx('mt-0.5 line-clamp-2 text-[12px] leading-[16px] break-words', strong ? 'text-accent-fg/80' : 'text-fg-muted')}>
          <Highlight text={summary.preview} terms={terms} />
        </div>
      </div>
      {!selected && !beforeSelected && <div className="absolute right-3 bottom-0 left-6 h-px bg-line opacity-70 group-hover:opacity-0" />}
    </div>
  )
})

function RowIcons({ summary, strong }: { summary: MessageSummary; strong: boolean }) {
  const tone = (color: string): string => (strong ? 'text-accent-fg' : color)
  return (
    <span className="flex shrink-0 items-center gap-1">
      {summary.importance === 2 && <TriangleAlert className={clsx('size-3.5', tone('text-danger'))} strokeWidth={2.2} aria-label={t('importanceHigh')} />}
      {summary.flagged && <Flag className={clsx('size-3.5', tone('text-danger'))} strokeWidth={2.2} fill="currentColor" aria-label={t('flagged')} />}
      {summary.security === 'signed' && <ShieldCheck className={clsx('size-3.5', tone('text-fg-muted'))} strokeWidth={2} aria-label={t('signed')} />}
      {summary.security === 'encrypted' && <KeyRound className={clsx('size-3.5', tone('text-fg-muted'))} strokeWidth={2} aria-label={t('encrypted')} />}
      {summary.attachmentCount > 0 && <Paperclip className={clsx('size-3.5', tone('text-fg-muted'))} strokeWidth={2} aria-label={tp('attachments', summary.attachmentCount)} />}
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="flex h-full gap-2 py-3 pr-3 pl-5" aria-hidden>
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-2/5" />
        <div className="skeleton h-3 w-3/4" />
        <div className="skeleton h-2.5 w-11/12" />
      </div>
    </div>
  )
}

function ListHeader() {
  const result = useApp((s) => s.result)
  const query = useApp((s) => s.query)
  const filters = useApp((s) => s.filters)
  const folderId = useApp((s) => s.folderId)
  const folderInfo = useApp((s) => s.folderInfo)
  const scope = useApp((s) => s.scope)
  const setScope = useApp((s) => s.setScope)
  const searching = isSearching({ query, filters })
  const folder = folderId !== null ? folderInfo.get(folderId)?.node : undefined
  const title = searching ? t('searchResults') : folder ? folderName(folder) : t('allItems')
  const unread = !searching && folder ? folder.unreadCount : 0

  return (
    <div className="shrink-0 px-4 pt-3 pb-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] leading-tight font-bold tracking-tight">{title}</h2>
          <div className="mt-0.5 truncate text-[12px] text-fg-muted tabular-nums" aria-live="polite">
            {resultSummary(result)}
            {unread > 0 && ` · ${t('unreadCount', { count: unread })}`}
          </div>
        </div>
        <SortButton />
      </div>
      {searching && <IndexingHint />}
      {searching && folder && (
        <Segmented
          label={t('scopeAll')}
          value={scope}
          onChange={setScope}
          size="sm"
          className="mt-2.5 w-full"
          options={[
            { value: 'all', label: t('scopeAll') },
            { value: 'folder', label: folderName(folder) }
          ]}
        />
      )}
    </div>
  )
}

function IndexingHint() {
  const progress = useApp((s) => s.indexProgress)
  if (!progress || progress.total === 0) return null
  const percent = Math.min(99, Math.floor((progress.done / progress.total) * 100))
  return (
    <div className="mt-2 flex animate-fade-in items-start gap-1.5 rounded-lg bg-fill px-2.5 py-1.5 text-[11.5px] leading-snug text-fg-muted">
      <Spinner className="mt-px size-3 shrink-0" />
      <span>{t('indexingHint', { percent })}</span>
    </div>
  )
}

function SortButton() {
  const sort = useApp((s) => s.sort)
  const setSort = useApp((s) => s.setSort)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const fields: SortField[] = ['date', 'from', 'subject', 'size']
  const items: MenuEntry[] = [
    { heading: t('sortBy') },
    ...fields.map((field) => ({ label: t(`sort_${field}`), checked: sort.field === field, onSelect: () => setSort({ field, dir: field === 'date' || field === 'size' ? 'desc' : 'asc' }) })),
    'separator',
    { label: sort.field === 'date' ? t('sortNewest') : t('sortDesc'), checked: sort.dir === 'desc', onSelect: () => setSort({ ...sort, dir: 'desc' }) },
    { label: sort.field === 'date' ? t('sortOldest') : t('sortAsc'), checked: sort.dir === 'asc', onSelect: () => setSort({ ...sort, dir: 'asc' }) }
  ]
  return (
    <>
      <IconButton ref={anchor} icon={ArrowDownUp} label={`${t('sortBy')}: ${t(`sort_${sort.field}`)}`} active={open} onClick={() => setOpen((o) => !o)} />
      <Menu open={open} onClose={() => setOpen(false)} anchor={anchor} items={items} label={t('sortBy')} />
    </>
  )
}

function SearchProgress() {
  const searching = useApp((s) => s.searching)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!searching) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(timer)
  }, [searching])
  return (
    <div className="relative h-0">
      {visible && (
        <div className="absolute top-0 right-4 z-20 flex items-center gap-1.5 rounded-full bg-surface-raised px-2 py-1 text-fg-muted shadow-card">
          <Spinner className="size-3.5" />
        </div>
      )}
    </div>
  )
}

function EmptyList() {
  const query = useApp((s) => s.query)
  const filters = useApp((s) => s.filters)
  const scope = useApp((s) => s.scope)
  const folderId = useApp((s) => s.folderId)
  const searching = isSearching({ query, filters })
  const Icon = searching ? SearchX : InboxIcon
  return (
    <div className="flex flex-1 animate-fade-in flex-col items-center justify-center px-8 pb-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-fill text-fg-subtle">
        <Icon className="size-7" strokeWidth={1.5} />
      </div>
      <div className="mt-4 text-[15px] font-semibold">{searching ? t('noResults') : t('emptyFolder')}</div>
      <p className="mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-fg-muted">{searching ? t('noResultsHint') : t('emptyFolderHint')}</p>
      {searching && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {scope === 'folder' && folderId !== null && (
            <Button size="sm" onClick={() => useApp.getState().setScope('all')}>
              {t('searchEverywhere')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => useApp.getState().resetFilters()}>
            {t('resetFilters')}
          </Button>
        </div>
      )}
    </div>
  )
}
