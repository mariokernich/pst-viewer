import { create } from 'zustand'
import { hasActiveFilters } from '@shared/filters'
import {
  DEFAULT_FILTERS,
  type AppInfo,
  type ArchiveFormat,
  type AttachmentInfo,
  type AttachmentPreview,
  type ExportFormat,
  type FolderNode,
  type IndexProgress,
  type MessageDetail,
  type MessageRef,
  type MessageSummary,
  type OpenProgress,
  type PstErrorCode,
  type RecentFile,
  type ResultGroup,
  type SaveResult,
  type SearchFilters,
  type SearchRequest,
  type SenderSuggestion,
  type SortSpec,
  type StoreInfo
} from '@shared/types'
import { ApiError, bridge, call } from '@/api'
import { errorMessage, locale, setLocale, t, tp } from '@/i18n'
import { buildExportText, buildPrintHtml, exportBaseName } from '@/lib/exportDocument'
import { folderName } from '@/lib/folders'

export type Screen = 'welcome' | 'loading' | 'mailbox'

export interface FolderInfo {
  node: FolderNode
  parentId: number | null
  depth: number
}

export interface ResultInfo {
  token: number
  /** Identifies the query; a refresh of the same query keeps the scroll position. */
  signature: string
  total: number
  groups: ResultGroup[]
  highlightTerms: string[]
  isSearch: boolean
  tookMs: number
}

export interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

export interface AttachmentPreviewState {
  ref: MessageRef
  /** Attachments that can be stepped through (files only). */
  items: AttachmentInfo[]
  position: number
  data: AttachmentPreview | null
  error: PstErrorCode | null
}

interface OpenError {
  code: PstErrorCode
  message: string
  path: string
}

interface State {
  info: AppInfo | null
  screen: Screen
  recent: RecentFile[]
  openError: OpenError | null
  loadingPath: string | null
  progress: OpenProgress | null
  /** Background full-text indexing, null when complete. */
  indexProgress: IndexProgress | null

  store: StoreInfo | null
  folders: FolderNode[]
  folderInfo: Map<number, FolderInfo>
  senders: SenderSuggestion[]

  /** Selected folder, null for "all items". */
  folderId: number | null
  query: string
  scope: 'all' | 'folder'
  filters: SearchFilters
  sort: SortSpec

  result: ResultInfo | null
  items: (MessageSummary | undefined)[]
  searching: boolean

  selectedIndex: number
  selectedId: number | null
  detail: MessageDetail | null
  detailState: 'idle' | 'loading' | 'error'
  bodyView: 'html' | 'text'

  /** Stack of attached messages opened in the overlay viewer. */
  embedded: { ref: MessageRef; detail: MessageDetail | null; error: boolean }[]
  /** Attachment preview (Quick Look style overlay). */
  preview: AttachmentPreviewState | null
  exporting: boolean

  sidebarVisible: boolean
  filtersOpen: boolean
  headersOpen: boolean
  helpOpen: boolean
  showEmptyFolders: boolean
  remoteAllowed: Set<string>
  recentSearches: string[]
  toast: Toast | null
  focusSearchTick: number
}

interface Actions {
  init(): Promise<void>
  refreshRecent(): Promise<void>
  removeRecent(path: string): Promise<void>
  clearRecent(): Promise<void>
  openDialog(kind?: 'file' | 'folder'): Promise<void>
  openFile(path: string): Promise<void>
  cancelOpen(): void
  dismissError(): void
  closeFile(): Promise<void>

  selectFolder(id: number | null): void
  setQuery(query: string, immediate?: boolean): void
  commitQuery(): void
  setScope(scope: 'all' | 'folder'): void
  setFilters(patch: Partial<SearchFilters>): void
  resetFilters(): void
  setSort(sort: SortSpec): void
  runSearch(options?: { silent?: boolean }): Promise<void>
  handleIndexProgress(progress: IndexProgress): void
  ensureRange(start: number, end: number): void

  selectIndex(index: number): Promise<void>
  moveSelection(delta: number): void
  reloadDetail(): void

  openEmbedded(ref: MessageRef): Promise<void>
  closeEmbedded(all?: boolean): void

  saveAttachment(ref: MessageRef, index: number): Promise<void>
  saveAttachments(ref: MessageRef): Promise<void>
  showAttachment(ref: MessageRef, attachment: AttachmentInfo, all: AttachmentInfo[]): void
  stepPreview(delta: number): void
  closePreview(): void
  openAttachment(ref: MessageRef, index: number): Promise<void>
  quickLookAttachment(ref: MessageRef, index: number): Promise<void>
  exportMessage(detail: MessageDetail, format: ExportFormat): Promise<void>
  printMessage(detail: MessageDetail): Promise<void>
  /** The message currently in front: the attached message viewer or the reading pane. */
  currentDetail(): MessageDetail | null
  allowRemote(ref: MessageRef): Promise<void>

  setUi(patch: Partial<Pick<State, 'sidebarVisible' | 'filtersOpen' | 'headersOpen' | 'helpOpen' | 'showEmptyFolders' | 'bodyView'>>): void
  focusSearch(): void
  showToast(toast: Omit<Toast, 'id'>): void
  hideToast(): void
}

const PAGE_SIZE = 100
const DETAIL_CACHE_SIZE = 40
const SEARCH_DEBOUNCE_MS = 160
const INDEX_REFRESH_MS = 2500

let searchSeq = 0
let detailSeq = 0
let lastIndexRefresh = 0
let autoSelectSingle = false
let searchTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let toastId = 0
const requestedPages = new Set<number>()
const detailCache = new Map<string, MessageDetail>()

export function refKey(ref: MessageRef): string {
  return ref.path?.length ? `${ref.id}/${ref.path.join('/')}` : String(ref.id)
}

function readUiPref(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === '1'
  } catch {
    return fallback
  }
}

function writeUiPref(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore
  }
}

function buildFolderInfo(folders: FolderNode[]): Map<number, FolderInfo> {
  const map = new Map<number, FolderInfo>()
  const walk = (nodes: FolderNode[], parentId: number | null, depth: number): void => {
    for (const node of nodes) {
      map.set(node.id, { node, parentId, depth })
      walk(node.children, node.id, depth + 1)
    }
  }
  walk(folders, null, 0)
  return map
}

function defaultFolder(folders: FolderNode[], format: ArchiveFormat): number | null {
  const inbox = folders.find((f) => f.special === 'inbox' && f.itemCount > 0)
  if (inbox) return inbox.id
  // Mail files spread over a directory tree are best shown all at once.
  if (format === 'folder') return null
  const firstWithItems = (nodes: FolderNode[]): FolderNode | null => {
    for (const n of nodes) {
      if (n.itemCount > 0) return n
      const child = firstWithItems(n.children)
      if (child) return child
    }
    return null
  }
  return firstWithItems(folders)?.id ?? null
}

function firstDayOfWeek(): number {
  try {
    const loc = new Intl.Locale(navigator.language) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } }
    const info = loc.getWeekInfo?.() ?? loc.weekInfo
    if (info) return info.firstDay % 7
  } catch {
    // ignore
  }
  return locale() === 'de' ? 1 : 0
}

export function isSearching(state: Pick<State, 'query' | 'filters'>): boolean {
  return state.query.trim() !== '' || hasActiveFilters(state.filters)
}

const initialMailboxState = {
  store: null,
  folders: [],
  folderInfo: new Map<number, FolderInfo>(),
  senders: [],
  folderId: null,
  query: '',
  scope: 'all' as const,
  filters: { ...DEFAULT_FILTERS },
  sort: { field: 'date' as const, dir: 'desc' as const },
  result: null,
  items: [],
  searching: false,
  indexProgress: null,
  selectedIndex: -1,
  selectedId: null,
  detail: null,
  detailState: 'idle' as const,
  bodyView: 'html' as const,
  embedded: [],
  preview: null,
  exporting: false,
  filtersOpen: false,
  headersOpen: false,
  remoteAllowed: new Set<string>(),
  recentSearches: []
}

export const useApp = create<State & Actions>()((set, get) => ({
  info: null,
  screen: 'welcome',
  recent: [],
  openError: null,
  loadingPath: null,
  progress: null,
  ...initialMailboxState,
  sidebarVisible: readUiPref('ui.sidebar', true),
  helpOpen: false,
  showEmptyFolders: readUiPref('ui.emptyFolders', false),
  toast: null,
  focusSearchTick: 0,

  async init() {
    const info = await call(bridge.getAppInfo())
    setLocale(info.locale, info.formatLocale)
    set({ info })
    await get().refreshRecent()
    if (info.pendingPath) void get().openFile(info.pendingPath)
  },

  async refreshRecent() {
    try {
      set({ recent: await call(bridge.listRecentFiles()) })
    } catch {
      set({ recent: [] })
    }
  },

  async removeRecent(path) {
    set({ recent: await call(bridge.removeRecentFile(path)) })
  },

  async clearRecent() {
    await call(bridge.clearRecentFiles())
    set({ recent: [] })
  },

  async openDialog(kind = 'file') {
    const path = await call(bridge.showOpenDialog(kind))
    if (path) await get().openFile(path)
  },

  async openFile(path) {
    if (get().screen === 'loading') return
    clearTimeout(searchTimer)
    detailCache.clear()
    requestedPages.clear()
    set({ ...initialMailboxState, filters: { ...DEFAULT_FILTERS }, remoteAllowed: new Set(), screen: 'loading', loadingPath: path, progress: null, openError: null })
    const unsubscribe = bridge.onProgress((progress) => set({ progress }))
    try {
      const opened = await call(bridge.openPst(path))
      const folderId = defaultFolder(opened.folders, opened.store.format)
      set({
        screen: 'mailbox',
        store: opened.store,
        folders: opened.folders,
        folderInfo: buildFolderInfo(opened.folders),
        senders: opened.senders,
        folderId,
        loadingPath: null,
        progress: null,
        indexProgress: opened.contentIndexed ? null : { done: 0, total: opened.store.itemCount }
      })
      // A single message (EML/MSG file) is shown right away once listed.
      autoSelectSingle = opened.store.itemCount === 1
      await get().runSearch()
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'UNKNOWN'
      set({
        screen: 'welcome',
        loadingPath: null,
        progress: null,
        openError: code === 'CANCELED' ? null : { code, message: (err as Error).message, path }
      })
      void get().refreshRecent()
    } finally {
      unsubscribe()
    }
  },

  cancelOpen() {
    void bridge.cancelOpen()
  },

  dismissError() {
    set({ openError: null })
  },

  async closeFile() {
    clearTimeout(searchTimer)
    await call(bridge.closePst()).catch(() => undefined)
    detailCache.clear()
    requestedPages.clear()
    set({ ...initialMailboxState, filters: { ...DEFAULT_FILTERS }, remoteAllowed: new Set(), screen: 'welcome' })
    void get().refreshRecent()
  },

  selectFolder(id) {
    // Choosing a folder while searching narrows the search to that folder.
    const searching = isSearching(get())
    set({ folderId: id, scope: searching && id !== null ? 'folder' : get().scope })
    void get().runSearch()
  },

  setQuery(query, immediate = false) {
    set({ query })
    clearTimeout(searchTimer)
    if (immediate) void get().runSearch()
    else searchTimer = setTimeout(() => void get().runSearch(), SEARCH_DEBOUNCE_MS)
  },

  commitQuery() {
    const q = get().query.trim()
    if (!q) return
    const recentSearches = [q, ...get().recentSearches.filter((s) => s !== q)].slice(0, 8)
    set({ recentSearches })
  },

  setScope(scope) {
    set({ scope })
    void get().runSearch()
  },

  setFilters(patch) {
    set({ filters: { ...get().filters, ...patch } })
    void get().runSearch()
  },

  resetFilters() {
    set({ filters: { ...DEFAULT_FILTERS } })
    void get().runSearch()
  },

  setSort(sort) {
    set({ sort })
    void get().runSearch()
  },

  async runSearch(options = {}) {
    if (!options.silent) clearTimeout(searchTimer)
    const state = get()
    if (state.screen !== 'mailbox') return
    const seq = ++searchSeq
    const searching = isSearching(state)
    const request: SearchRequest = {
      text: state.query,
      folderId: searching && state.scope === 'all' ? null : state.folderId,
      includeSubfolders: searching,
      filters: state.filters,
      sort: state.sort,
      now: Date.now(),
      firstDayOfWeek: firstDayOfWeek(),
      pageSize: PAGE_SIZE
    }
    const signature = JSON.stringify([request.text, request.folderId, request.includeSubfolders, request.filters, request.sort])
    if (!options.silent) set({ searching: true })
    try {
      const response = await call(bridge.search(request))
      if (seq !== searchSeq) return
      requestedPages.clear()
      requestedPages.add(0)
      // A refresh of the same query keeps the known rows until fresh pages arrive.
      const previous = options.silent && get().result?.signature === signature ? get().items : []
      const items: (MessageSummary | undefined)[] = new Array(response.total)
      for (let i = 0; i < Math.min(previous.length, response.total); i++) items[i] = previous[i]
      response.items.forEach((item, i) => (items[i] = item))
      const selectedId = get().selectedId
      let selectedIndex = selectedId === null ? -1 : response.items.findIndex((i) => i.id === selectedId)
      if (selectedIndex < 0 && selectedId !== null) {
        // Keep the highlight on a refreshed row until its page is reloaded.
        const previousIndex = get().selectedIndex
        if (previousIndex >= 0 && items[previousIndex]?.id === selectedId) selectedIndex = previousIndex
      }
      set({
        result: {
          token: response.token,
          signature,
          total: response.total,
          groups: response.groups,
          highlightTerms: response.highlightTerms,
          isSearch: response.isSearch,
          tookMs: response.tookMs
        },
        items,
        selectedIndex,
        searching: false
      })
      if (autoSelectSingle && response.total === 1) {
        autoSelectSingle = false
        void get().selectIndex(0)
      }
    } catch (err) {
      if (seq !== searchSeq) return
      set({ searching: false })
      if (err instanceof ApiError && err.code === 'NOT_OPEN') void get().closeFile()
    }
  },

  handleIndexProgress(progress) {
    if (get().screen !== 'mailbox') return
    if (progress.senders) {
      // Indexing finished: bodies, attachments and addresses are now searchable.
      set({ indexProgress: null, senders: progress.senders })
      lastIndexRefresh = Date.now()
      void get().runSearch({ silent: true })
      return
    }
    set({ indexProgress: progress })
    // Refresh the visible list now and then so previews fill in.
    if (Date.now() - lastIndexRefresh > INDEX_REFRESH_MS) {
      lastIndexRefresh = Date.now()
      void get().runSearch({ silent: true })
    }
  },

  ensureRange(start, end) {
    const result = get().result
    if (!result) return
    const first = Math.max(0, Math.floor(start / PAGE_SIZE))
    const last = Math.min(Math.floor((result.total - 1) / PAGE_SIZE), Math.floor(end / PAGE_SIZE))
    for (let page = first; page <= last; page++) {
      if (requestedPages.has(page)) continue
      requestedPages.add(page)
      const token = result.token
      void call(bridge.getPage(token, page * PAGE_SIZE, PAGE_SIZE))
        .then((summaries) => {
          if (!summaries || get().result?.token !== token) return
          const items = get().items.slice()
          const pageStart = page * PAGE_SIZE
          summaries.forEach((s, i) => (items[pageStart + i] = s))
          // Re-locate the selected message within the freshly loaded page.
          const selectedId = get().selectedId
          let selectedIndex = get().selectedIndex
          const found = selectedId === null ? -1 : summaries.findIndex((s) => s.id === selectedId)
          if (found >= 0) selectedIndex = pageStart + found
          else if (selectedIndex >= pageStart && selectedIndex < pageStart + summaries.length) selectedIndex = -1
          set({ items, selectedIndex })
        })
        .catch(() => requestedPages.delete(page))
    }
  },

  async selectIndex(index) {
    const { result } = get()
    if (!result || index < 0 || index >= result.total) return
    let summary = get().items[index]
    if (!summary) {
      const page = Math.floor(index / PAGE_SIZE)
      const summaries = await call(bridge.getPage(result.token, page * PAGE_SIZE, PAGE_SIZE)).catch(() => null)
      if (!summaries || get().result?.token !== result.token) return
      const items = get().items.slice()
      summaries.forEach((s, i) => (items[page * PAGE_SIZE + i] = s))
      requestedPages.add(page)
      set({ items })
      summary = items[index]
      if (!summary) return
    }
    if (summary.id === get().selectedId && get().detail) {
      set({ selectedIndex: index })
      return
    }
    set({ selectedIndex: index, selectedId: summary.id, headersOpen: false, bodyView: 'html' })
    const ref: MessageRef = { id: summary.id }
    const key = refKey(ref)
    // Invalidate requests that are still in flight for a previous selection.
    const seq = ++detailSeq
    const cached = detailCache.get(key)
    if (cached) {
      set({ detail: cached, detailState: 'idle' })
      syncRemoteImages()
      return
    }
    // Keep showing the previous message briefly to avoid flicker on fast navigation.
    const loadingTimer = setTimeout(() => {
      if (seq === detailSeq) set({ detailState: 'loading' })
    }, 120)
    try {
      const detail = await call(bridge.getMessage(ref))
      detailCache.set(key, detail)
      if (detailCache.size > DETAIL_CACHE_SIZE) detailCache.delete(detailCache.keys().next().value!)
      if (seq === detailSeq) {
        set({ detail, detailState: 'idle' })
        syncRemoteImages()
      }
    } catch {
      if (seq === detailSeq) set({ detail: null, detailState: 'error' })
    } finally {
      clearTimeout(loadingTimer)
    }
  },

  moveSelection(delta) {
    const { result, selectedIndex } = get()
    if (!result || result.total === 0) return
    const next = selectedIndex < 0 ? (delta > 0 ? 0 : result.total - 1) : Math.min(result.total - 1, Math.max(0, selectedIndex + delta))
    if (next !== selectedIndex) void get().selectIndex(next)
  },

  reloadDetail() {
    const { selectedIndex, selectedId } = get()
    if (selectedId === null) return
    detailCache.delete(String(selectedId))
    set({ selectedId: null })
    void get().selectIndex(selectedIndex)
  },

  async openEmbedded(ref) {
    set({ embedded: [...get().embedded, { ref, detail: null, error: false }] })
    syncRemoteImages()
    const update = (patch: { detail?: MessageDetail; error?: boolean }): void => {
      set({ embedded: get().embedded.map((e) => (refKey(e.ref) === refKey(ref) ? { ...e, ...patch } : e)) })
    }
    try {
      update({ detail: await call(bridge.getMessage(ref)) })
    } catch {
      update({ error: true })
    }
  },

  closeEmbedded(all = false) {
    set({ embedded: all ? [] : get().embedded.slice(0, -1) })
    syncRemoteImages()
  },

  async saveAttachment(ref, index) {
    try {
      const result = await call(bridge.saveAttachment(ref, index))
      reportSave(result, get().showToast)
    } catch {
      get().showToast({ message: t('saveFailed'), tone: 'error' })
    }
  },

  async saveAttachments(ref) {
    try {
      const result = await call(bridge.saveAttachments(ref))
      reportSave(result, get().showToast)
    } catch {
      get().showToast({ message: t('saveFailed'), tone: 'error' })
    }
  },

  showAttachment(ref, attachment, all) {
    if (attachment.isMessage) {
      void get().openEmbedded({ id: ref.id, path: [...(ref.path ?? []), attachment.index] })
      return
    }
    const items = all.filter((a) => !a.isInline && !a.isMessage)
    const position = Math.max(0, items.findIndex((a) => a.index === attachment.index))
    loadPreview({ ref, items, position, data: null, error: null })
  },

  stepPreview(delta) {
    const preview = get().preview
    if (!preview || preview.items.length < 2) return
    const position = (preview.position + delta + preview.items.length) % preview.items.length
    loadPreview({ ...preview, position, data: null, error: null })
  },

  closePreview() {
    previewSeq++
    set({ preview: null })
  },

  async openAttachment(ref, index) {
    try {
      await call(bridge.openAttachment(ref, index))
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'UNKNOWN'
      get().showToast({ message: errorMessage(code), tone: 'error' })
    }
  },

  async quickLookAttachment(ref, index) {
    await call(bridge.quickLook(ref, index)).catch(() => undefined)
  },

  async exportMessage(detail, format) {
    if (get().exporting) return
    set({ exporting: true })
    try {
      const suggestedName = exportBaseName(detail)
      let result: SaveResult
      if (format === 'eml') {
        result = await call(bridge.exportEml(detail.ref, suggestedName))
      } else {
        const folder = detail.folderId !== null ? get().folderInfo.get(detail.folderId)?.node : undefined
        const allowRemote = get().remoteAllowed.has(refKey(detail.ref))
        const content = format === 'pdf' ? buildPrintHtml(detail, { allowRemote, folderName: folder && folderName(folder) }) : buildExportText(detail, folder && folderName(folder))
        result = await call(bridge.exportDocument({ format, content, suggestedName, footer: detail.subject, allowRemote }))
      }
      reportSave(result, get().showToast, t('exported'))
    } catch {
      get().showToast({ message: t('exportFailed'), tone: 'error' })
    } finally {
      set({ exporting: false })
    }
  },

  async printMessage(detail) {
    try {
      const folder = detail.folderId !== null ? get().folderInfo.get(detail.folderId)?.node : undefined
      const allowRemote = get().remoteAllowed.has(refKey(detail.ref))
      const content = buildPrintHtml(detail, { allowRemote, folderName: folder && folderName(folder) })
      await call(bridge.printDocument({ format: 'pdf', content, suggestedName: exportBaseName(detail), footer: detail.subject, allowRemote }))
    } catch {
      get().showToast({ message: t('printFailed'), tone: 'error' })
    }
  },

  currentDetail() {
    const { embedded, detail } = get()
    const top = embedded[embedded.length - 1]
    return top ? top.detail : detail
  },

  async allowRemote(ref) {
    // Unblock the network first so the images load as soon as the view re-renders.
    await call(bridge.setRemoteImagesAllowed(true))
    const remoteAllowed = new Set(get().remoteAllowed)
    remoteAllowed.add(refKey(ref))
    set({ remoteAllowed })
  },

  setUi(patch) {
    if (patch.sidebarVisible !== undefined) writeUiPref('ui.sidebar', patch.sidebarVisible)
    if (patch.showEmptyFolders !== undefined) writeUiPref('ui.emptyFolders', patch.showEmptyFolders)
    set(patch)
  },

  focusSearch() {
    set({ focusSearchTick: get().focusSearchTick + 1 })
  },

  showToast(toast) {
    clearTimeout(toastTimer)
    const id = ++toastId
    set({ toast: { ...toast, id } })
    toastTimer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 5000)
  },

  hideToast() {
    clearTimeout(toastTimer)
    set({ toast: null })
  }
}))

/**
 * Remote images may only be fetched while a message whose images the user
 * allowed is on screen; the main process blocks them otherwise.
 */
function syncRemoteImages(): void {
  const { detail, embedded, remoteAllowed } = useApp.getState()
  const top = embedded[embedded.length - 1]
  const shown = top ? top.ref : detail?.ref
  void bridge.setRemoteImagesAllowed(!!shown && remoteAllowed.has(refKey(shown)))
}

let previewSeq = 0

function loadPreview(state: AttachmentPreviewState): void {
  const seq = ++previewSeq
  useApp.setState({ preview: state })
  const attachment = state.items[state.position]
  if (!attachment) return
  call(bridge.previewAttachment(state.ref, attachment.index)).then(
    (data) => {
      if (seq === previewSeq) useApp.setState({ preview: { ...state, data } })
    },
    (err: unknown) => {
      if (seq === previewSeq) useApp.setState({ preview: { ...state, error: err instanceof ApiError ? err.code : 'UNKNOWN' } })
    }
  )
}

function reportSave(result: SaveResult, showToast: Actions['showToast'], message?: string): void {
  if (result.status === 'canceled') return
  if (result.status === 'error') {
    showToast({ message: t('saveFailed'), tone: 'error' })
    return
  }
  const path = result.path
  const isMac = useApp.getState().info?.platform === 'darwin'
  showToast({
    message: message ?? ((result.count ?? 1) > 1 ? t('savedMany', { count: result.count ?? 0 }) : t('saved')),
    tone: 'success',
    action: path ? { label: isMac ? t('showInFinder') : t('showInFolder'), run: () => void bridge.showItemInFolder(path) } : undefined
  })
}

export function resultSummary(result: ResultInfo | null): string {
  if (!result) return ''
  return result.isSearch ? tp('resultCount', result.total) : tp('itemCount', result.total)
}
