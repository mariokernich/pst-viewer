import clsx from 'clsx'
import { ChevronRight, Eye, EyeOff, FolderOpen, FolderSearch, Lock, Mails, MoreHorizontal, X } from 'lucide-react'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { FolderNode } from '@shared/types'
import { bridge } from '@/api'
import { t, tp } from '@/i18n'
import { folderIcon, folderName } from '@/lib/folders'
import { formatNumber, formatShortDate, formatSize } from '@/lib/format'
import { useApp } from '@/store'
import { IconButton } from './ui/Button'
import { Menu, type MenuEntry } from './ui/Overlay'

export function Sidebar({ width }: { width: number }) {
  const folders = useApp((s) => s.folders)
  const showEmpty = useApp((s) => s.showEmptyFolders)
  const selected = useApp((s) => s.folderId)

  const visible = useMemo(() => (showEmpty ? folders : pruneEmpty(folders, selected)), [folders, showEmpty, selected])
  const [expanded, setExpanded] = useState<Set<number>>(() => defaultExpanded(folders))

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const tree = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const items = [...(tree.current?.querySelectorAll<HTMLElement>('[data-tree-item]') ?? [])]
    const current = items.indexOf(document.activeElement as HTMLElement)
    if (current < 0) return
    const id = items[current].dataset.folderId
    const folderId = id ? Number(id) : null
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = items[Math.min(items.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)))]
      next.focus()
      const nextId = next.dataset.folderId
      useApp.getState().selectFolder(nextId ? Number(nextId) : null)
    } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && folderId !== null) {
      const hasChildren = items[current].dataset.hasChildren === 'true'
      if (!hasChildren) return
      event.preventDefault()
      const isOpen = expanded.has(folderId)
      if ((event.key === 'ArrowRight') !== isOpen) toggle(folderId)
    }
  }

  return (
    <aside style={{ width }} className="flex h-full shrink-0 flex-col bg-sidebar" aria-label={t('folders')}>
      <div className="drag h-[52px] shrink-0" />
      <StoreCard />
      <div ref={tree} role="tree" aria-label={t('folders')} onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-1 pb-4">
        <AllItemsRow />
        <div className="mt-3 mb-1 px-2 text-[11px] font-semibold text-fg-subtle">{t('folders')}</div>
        {visible.map((folder) => (
          <FolderRow key={folder.id} node={folder} depth={0} expanded={expanded} onToggle={toggle} />
        ))}
      </div>
    </aside>
  )
}

function AllItemsRow() {
  const selected = useApp((s) => s.folderId === null)
  const total = useApp((s) => s.store?.itemCount ?? 0)
  const selectFolder = useApp((s) => s.selectFolder)
  return (
    <div role="treeitem" aria-selected={selected} aria-level={1}>
      <button
        type="button"
        data-tree-item
        tabIndex={selected ? 0 : -1}
        onClick={() => selectFolder(null)}
        className={rowClass(selected)}
        style={{ paddingLeft: 8 }}
      >
        <span className="w-4" />
        <Mails className={clsx('size-[17px] shrink-0', selected ? 'text-accent' : 'text-accent/90')} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate">{t('allItems')}</span>
        <Count value={total} />
      </button>
    </div>
  )
}

const FolderRow = memo(function FolderRow({
  node,
  depth,
  expanded,
  onToggle
}: {
  node: FolderNode
  depth: number
  expanded: Set<number>
  onToggle: (id: number) => void
}) {
  const selected = useApp((s) => s.folderId === node.id)
  const selectFolder = useApp((s) => s.selectFolder)
  const isOpen = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const Icon = folderIcon(node)
  const name = folderName(node)

  return (
    <div role="treeitem" aria-selected={selected} aria-expanded={hasChildren ? isOpen : undefined} aria-level={depth + 1}>
      <button
        type="button"
        data-tree-item
        data-folder-id={node.id}
        data-has-children={hasChildren}
        tabIndex={selected ? 0 : -1}
        onClick={() => selectFolder(node.id)}
        onDoubleClick={() => hasChildren && onToggle(node.id)}
        title={name !== node.name ? `${name} (${node.name})` : name}
        className={rowClass(selected)}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span
          className={clsx('flex size-4 shrink-0 items-center justify-center rounded text-fg-subtle', hasChildren && 'hover:bg-fill hover:text-fg')}
          onClick={(event) => {
            if (!hasChildren) return
            event.stopPropagation()
            onToggle(node.id)
          }}
          aria-hidden
        >
          {hasChildren && <ChevronRight className={clsx('size-3.5 transition-transform duration-150', isOpen && 'rotate-90')} strokeWidth={2.2} />}
        </span>
        <Icon className={clsx('size-[17px] shrink-0', node.totalCount === 0 ? 'text-fg-subtle' : 'text-accent')} strokeWidth={1.8} />
        <span className={clsx('min-w-0 flex-1 truncate', node.totalCount === 0 && 'text-fg-muted')}>{name}</span>
        <Count value={node.itemCount} />
      </button>
      {hasChildren && isOpen && (
        <div role="group">
          {node.children.map((child) => (
            <FolderRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
})

function rowClass(selected: boolean): string {
  return clsx(
    'flex h-[30px] w-full items-center gap-1.5 rounded-lg pr-2 text-left text-[13px] transition-colors duration-100',
    selected ? 'bg-fill-strong font-medium text-fg' : 'text-fg hover:bg-hover'
  )
}

function Count({ value }: { value: number }) {
  if (!value) return null
  return <span className="shrink-0 text-[11.5px] text-fg-muted tabular-nums">{formatNumber(value)}</span>
}

function StoreCard() {
  const store = useApp((s) => s.store)
  const showEmpty = useApp((s) => s.showEmptyFolders)
  const isMac = useApp((s) => s.info?.platform === 'darwin')
  const [menuOpen, setMenuOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  if (!store) return null

  const items: MenuEntry[] = [
    { heading: store.fileName },
    { label: t('openOtherFile'), icon: FolderOpen, onSelect: () => void useApp.getState().openDialog() },
    { label: isMac ? t('showInFinder') : t('showInFolder'), icon: FolderSearch, onSelect: () => void bridge.showItemInFolder(store.filePath) },
    'separator',
    {
      label: showEmpty ? t('hideEmptyFolders') : t('showEmptyFolders'),
      icon: showEmpty ? EyeOff : Eye,
      onSelect: () => useApp.getState().setUi({ showEmptyFolders: !showEmpty })
    },
    'separator',
    { label: t('closeFile'), icon: X, onSelect: () => void useApp.getState().closeFile() }
  ]

  const range = store.dateRange ? t('storeRange', { from: formatShortDate(store.dateRange.min), to: formatShortDate(store.dateRange.max) }) : null

  return (
    <div className="mx-2.5 mb-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface/55 px-3 py-2.5 shadow-card">
      <div className="min-w-0 flex-1" title={`${store.filePath}\n${formatSize(store.fileSize)}${range ? `\n${range}` : ''}`}>
        <div className="truncate text-[13px] font-semibold">{store.fileName}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-muted">
          <Lock className="size-3 shrink-0" strokeWidth={2.2} aria-label={t('readOnly')} />
          <span className="truncate">
            {tp('itemCount', store.itemCount)} · {formatSize(store.fileSize)}
          </span>
        </div>
        <IndexingStatus />
      </div>
      <IconButton ref={anchor} icon={MoreHorizontal} size="sm" label={t('fileInfo')} onClick={() => setMenuOpen((o) => !o)} active={menuOpen} />
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} anchor={anchor} items={items} placement="bottom-start" label={t('fileInfo')} />
    </div>
  )
}

function IndexingStatus() {
  const progress = useApp((s) => s.indexProgress)
  if (!progress || progress.total === 0) return null
  const percent = Math.min(99, Math.floor((progress.done / progress.total) * 100))
  return (
    <div className="mt-2 animate-fade-in" role="status" aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${Math.max(3, percent)}%` }} />
      </div>
      <div className="mt-1 truncate text-[10.5px] text-fg-muted tabular-nums">{t('indexing', { percent })}</div>
    </div>
  )
}

function pruneEmpty(nodes: FolderNode[], keep: number | null): FolderNode[] {
  const result: FolderNode[] = []
  for (const node of nodes) {
    const children = pruneEmpty(node.children, keep)
    if (node.totalCount > 0 || node.id === keep || children.length > 0) result.push(children === node.children ? node : { ...node, children })
  }
  return result
}

function defaultExpanded(folders: FolderNode[]): Set<number> {
  const ids = new Set<number>()
  for (const f of folders) {
    if (f.children.some((c) => c.totalCount > 0) && f.special !== 'contacts' && f.special !== 'syncIssues') ids.add(f.id)
  }
  return ids
}
