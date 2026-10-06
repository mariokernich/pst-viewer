import clsx from 'clsx'
import { AtSign, CircleX, CornerDownLeft, Flag, FolderOpen, History, type LucideIcon, Mail, Paperclip, Search, SlidersHorizontal, TextSearch } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { countActiveFilters } from '@shared/filters'
import type { SearchField } from '@shared/types'
import { fold } from '@shared/text'
import { locale, t } from '@/i18n'
import { folderName } from '@/lib/folders'
import { useApp } from '@/store'
import { IconButton } from './ui/Button'
import { Kbd } from './ui/Controls'
import { Popover } from './ui/Overlay'
import { FilterPanel } from './FilterPanel'

interface Suggestion {
  key: string
  section: string
  icon: LucideIcon
  label: string
  detail?: string
  run: () => void
}

const FIELD_PREFIX: Record<'de' | 'en', Record<Exclude<SearchField, 'attachments'>, string>> = {
  de: { subject: 'betreff', from: 'von', to: 'an', body: 'inhalt' },
  en: { subject: 'subject', from: 'from', to: 'to', body: 'body' }
}

/** Search field with live suggestions and the filter popover. */
export function SearchBox() {
  const query = useApp((s) => s.query)
  const setQuery = useApp((s) => s.setQuery)
  const filters = useApp((s) => s.filters)
  const filtersOpen = useApp((s) => s.filtersOpen)
  const focusTick = useApp((s) => s.focusSearchTick)
  const folderId = useApp((s) => s.folderId)
  const folderInfo = useApp((s) => s.folderInfo)
  const isMac = useApp((s) => s.info?.platform === 'darwin')

  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const filterButton = useRef<HTMLButtonElement>(null)
  const [focused, setFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (focusTick > 0) {
      input.current?.focus()
      input.current?.select()
    }
  }, [focusTick])

  const closeSuggestions = useCallback(() => setShowSuggestions(false), [])
  const suggestions = useSuggestions(query, closeSuggestions)
  useEffect(() => setActive(0), [query])

  const activeFilters = countActiveFilters(filters)
  const folder = folderId !== null ? folderInfo.get(folderId)?.node : undefined
  const placeholder = folder ? t('searchPlaceholderIn', { folder: folderName(folder) }) : t('searchPlaceholder')

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const open = showSuggestions && suggestions.length > 0
    if (event.key === 'ArrowDown' && open) {
      event.preventDefault()
      setActive((a) => (a + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && suggestions[active]) suggestions[active].run()
      else {
        useApp.getState().commitQuery()
        setQuery(query, true)
      }
      setShowSuggestions(false)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (showSuggestions) setShowSuggestions(false)
      else if (query) setQuery('', true)
      else input.current?.blur()
    } else if (event.key === 'ArrowDown' && !open) {
      // Jump from the search field into the result list.
      event.preventDefault()
      input.current?.blur()
      useApp.getState().moveSelection(1)
    }
  }

  return (
    <div ref={box} className="relative flex min-w-0 flex-1 items-center gap-1.5">
      <div
        className={clsx(
          'flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-[11px] px-2.5 transition-all duration-150',
          focused ? 'bg-surface-raised shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent),0_0_0_1px_var(--accent)]' : 'bg-fill hover:bg-fill-strong'
        )}
        onMouseDown={(event) => {
          if (event.target !== input.current) {
            event.preventDefault()
            input.current?.focus()
          }
        }}
      >
        <Search className="size-4 shrink-0 text-fg-muted" strokeWidth={2} />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-activedescendant={showSuggestions && suggestions[active] ? `suggestion-${suggestions[active].key}` : undefined}
          aria-label={t('searchPlaceholder')}
          value={query}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => {
            setFocused(true)
            setShowSuggestions(true)
          }}
          onBlur={() => {
            setFocused(false)
            useApp.getState().commitQuery()
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label={t('clearSearch')}
            title={t('clearSearch')}
            onClick={() => {
              setQuery('', true)
              input.current?.focus()
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg-muted"
          >
            <CircleX className="size-4" strokeWidth={2} />
          </button>
        ) : (
          !focused && (
            <span className="flex shrink-0 gap-0.5" aria-hidden>
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>F</Kbd>
            </span>
          )
        )}
      </div>
      <IconButton
        ref={filterButton}
        icon={SlidersHorizontal}
        label={t('filters')}
        active={filtersOpen || activeFilters > 0}
        badge={activeFilters}
        onClick={() => useApp.getState().setUi({ filtersOpen: !filtersOpen })}
      />

      <Popover
        open={focused && showSuggestions && suggestions.length > 0 && !filtersOpen}
        onClose={() => setShowSuggestions(false)}
        anchor={box}
        ignore={[box]}
        className="w-[min(520px,calc(100vw-24px))] p-1.5"
        label={t('searchPlaceholder')}
      >
        <SuggestionList id="search-suggestions" suggestions={suggestions} active={active} onHover={setActive} />
      </Popover>

      <Popover
        open={filtersOpen}
        onClose={() => useApp.getState().setUi({ filtersOpen: false })}
        anchor={filterButton}
        placement="bottom-end"
        className="w-[440px]"
        label={t('filters')}
      >
        <FilterPanel />
      </Popover>
    </div>
  )
}

function SuggestionList({ id, suggestions, active, onHover }: { id: string; suggestions: Suggestion[]; active: number; onHover: (i: number) => void }) {
  let lastSection = ''
  return (
    <div id={id} role="listbox" aria-label={t('searchPlaceholder')}>
      {suggestions.map((s, i) => {
        const header = s.section !== lastSection ? s.section : null
        lastSection = s.section
        const Icon = s.icon
        return (
          <div key={s.key}>
            {header && <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-fg-muted first:pt-1">{header}</div>}
            <div
              id={`suggestion-${s.key}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => onHover(i)}
              onMouseDown={(event) => {
                event.preventDefault()
                s.run()
              }}
              className={clsx('flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px]', i === active ? 'bg-accent text-accent-fg' : 'text-fg')}
            >
              <Icon className={clsx('size-4 shrink-0', i === active ? 'text-accent-fg' : 'text-fg-muted')} strokeWidth={1.9} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.detail && <span className={clsx('max-w-[45%] shrink-0 truncate text-[12px]', i === active ? 'text-accent-fg/80' : 'text-fg-subtle')}>{s.detail}</span>}
              {i === active && <CornerDownLeft className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Builds context aware suggestions for the current input. */
function useSuggestions(query: string, close: () => void): Suggestion[] {
  const senders = useApp((s) => s.senders)
  const folderInfo = useApp((s) => s.folderInfo)
  const recentSearches = useApp((s) => s.recentSearches)

  return useMemo(() => {
    const state = useApp.getState
    const text = query.trim()
    const result: Suggestion[] = []

    if (!text) {
      for (const recent of recentSearches.slice(0, 5)) {
        result.push({
          key: `recent-${recent}`,
          section: t('suggestionsRecent'),
          icon: History,
          label: recent,
          run: () => {
            state().setQuery(recent, true)
            close()
          }
        })
      }
      const quick: [string, LucideIcon, () => void][] = [
        [t('read_unread'), Mail, () => state().setFilters({ readState: 'unread' })],
        [t('flagHasAttachments'), Paperclip, () => state().setFilters({ hasAttachments: true })],
        [t('flagImportant'), Flag, () => state().setFilters({ important: true })]
      ]
      for (const [label, icon, run] of quick) {
        result.push({
          key: `quick-${label}`,
          section: t('suggestionsQuick'),
          icon,
          label,
          run: () => {
            run()
            close()
          }
        })
      }
      return result
    }

    // Only suggest for plain words, not when the user already typed syntax.
    const plain = !/[:"]/.test(text)
    const quoted = /\s/.test(text) ? `"${text}"` : text

    result.push({
      key: 'all',
      section: t('suggestionsSearchIn'),
      icon: TextSearch,
      label: t('searchAll', { text }),
      run: () => {
        state().commitQuery()
        state().setQuery(query, true)
        close()
      }
    })
    if (plain) {
      for (const field of ['subject', 'from', 'body'] as const) {
        result.push({
          key: `field-${field}`,
          section: t('suggestionsSearchIn'),
          icon: field === 'from' ? AtSign : TextSearch,
          label: t('searchIn', { text, field: t(`field_${field}`) }),
          detail: `${FIELD_PREFIX[locale()][field]}:${quoted}`,
          run: () => {
            const q = `${FIELD_PREFIX[locale()][field]}:${quoted}`
            state().setQuery(q, true)
            state().commitQuery()
            close()
          }
        })
      }

      const needle = fold(text)
      const matchingSenders = senders.filter((s) => fold(s.name).includes(needle) || fold(s.email).includes(needle)).slice(0, 5)
      for (const sender of matchingSenders) {
        result.push({
          key: `sender-${sender.email || sender.name}`,
          section: t('suggestionsSenders'),
          icon: AtSign,
          label: sender.name || sender.email,
          detail: sender.name && sender.email ? sender.email : undefined,
          run: () => {
            state().setQuery('')
            state().setFilters({ from: sender.email || sender.name })
            close()
          }
        })
      }

      const matchingFolders = [...folderInfo.values()].filter((f) => f.node.totalCount > 0 && fold(folderName(f.node)).includes(needle)).slice(0, 3)
      for (const folder of matchingFolders) {
        result.push({
          key: `folder-${folder.node.id}`,
          section: t('suggestionsFolders'),
          icon: FolderOpen,
          label: t('suggestionFolder', { name: folderName(folder.node) }),
          run: () => {
            state().setQuery('')
            state().selectFolder(folder.node.id)
            close()
          }
        })
      }
    }
    return result
  }, [query, senders, folderInfo, recentSearches, close])
}
