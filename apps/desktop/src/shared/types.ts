/**
 * Types shared between the main process, the PST worker (utility process),
 * the preload bridge and the renderer.
 *
 * Everything in here must be structured-clone friendly (plain objects only).
 */

export type ItemKind =
  | 'mail'
  | 'meeting'
  | 'appointment'
  | 'contact'
  | 'task'
  | 'note'
  | 'journal'
  | 'other'

export type SpecialFolder =
  | 'inbox'
  | 'drafts'
  | 'sent'
  | 'deleted'
  | 'archive'
  | 'junk'
  | 'outbox'
  | 'calendar'
  | 'contacts'
  | 'tasks'
  | 'notes'
  | 'journal'
  | 'syncIssues'
  | 'rss'

export interface FolderNode {
  id: number
  name: string
  special: SpecialFolder | null
  containerClass: string
  /** Items stored directly in this folder. */
  itemCount: number
  unreadCount: number
  /** Items in this folder and all of its descendants. */
  totalCount: number
  children: FolderNode[]
}

/** Format of the opened archive: PST variants, MBOX, single EML/MSG files or a folder of mail files. */
export type ArchiveFormat = 'ansi' | 'unicode' | 'unicode4k' | 'unknown' | 'mbox' | 'eml' | 'msg' | 'folder'

export interface StoreInfo {
  filePath: string
  fileName: string
  fileSize: number
  displayName: string
  format: ArchiveFormat
  itemCount: number
  folderCount: number
  dateRange: { min: number; max: number } | null
  indexMs: number
  /** Number of items that could not be read. */
  skippedItems: number
}

export interface SenderSuggestion {
  name: string
  email: string
  count: number
}

export interface OpenResult {
  store: StoreInfo
  folders: FolderNode[]
  senders: SenderSuggestion[]
  /** False while bodies and attachments are still indexed in the background. */
  contentIndexed: boolean
}

/** Progress of the background full-text indexing. */
export interface IndexProgress {
  done: number
  total: number
  /** Set when indexing is complete: the refined sender list. */
  senders?: SenderSuggestion[]
}

export interface OpenProgress {
  phase: 'opening' | 'scanning' | 'indexing' | 'finishing'
  done: number
  total: number
  folderName?: string
}

export interface MessageSummary {
  id: number
  folderId: number
  kind: ItemKind
  messageClass: string
  subject: string
  fromName: string
  fromEmail: string
  toLine: string
  /** Epoch milliseconds, 0 if unknown. */
  date: number
  size: number
  /** Visible (non-inline) attachments. */
  attachmentCount: number
  isRead: boolean
  importance: 0 | 1 | 2
  flagged: boolean
  security: SecurityKind | null
  /** Body preview, or a snippet around the first match while searching. */
  preview: string
}

export type SecurityKind = 'signed' | 'encrypted'

export type SortField = 'date' | 'from' | 'subject' | 'size'
export type SortDir = 'asc' | 'desc'

export interface SortSpec {
  field: SortField
  dir: SortDir
}

export type SearchField = 'subject' | 'from' | 'to' | 'body' | 'attachments'

export const ALL_SEARCH_FIELDS: readonly SearchField[] = ['subject', 'from', 'to', 'body', 'attachments']

export type DatePreset = 'any' | 'today' | 'week' | 'month' | 'year' | 'custom'

export type AttachmentType = 'pdf' | 'image' | 'office' | 'archive' | 'calendar' | 'message'

export type ReadState = 'any' | 'unread' | 'read'

export interface SearchFilters {
  /** Fields that free text terms are matched against. Empty means all. */
  fields: SearchField[]
  datePreset: DatePreset
  /** ISO date (YYYY-MM-DD), inclusive. Only used with datePreset 'custom'. */
  dateFrom: string | null
  /** ISO date (YYYY-MM-DD), inclusive. Only used with datePreset 'custom'. */
  dateTo: string | null
  from: string
  to: string
  hasAttachments: boolean
  attachmentType: AttachmentType | null
  readState: ReadState
  important: boolean
  flagged: boolean
  /** Minimum size in bytes, null for any size. */
  minSize: number | null
  /** Item kinds to include. Empty means all kinds. */
  kinds: ItemKind[]
}

export const DEFAULT_FILTERS: SearchFilters = {
  fields: [],
  datePreset: 'any',
  dateFrom: null,
  dateTo: null,
  from: '',
  to: '',
  hasAttachments: false,
  attachmentType: null,
  readState: 'any',
  important: false,
  flagged: false,
  minSize: null,
  kinds: []
}

export interface SearchRequest {
  text: string
  /** Folder to list or search in; null means all folders. */
  folderId: number | null
  includeSubfolders: boolean
  filters: SearchFilters
  sort: SortSpec
  /** Client clock, used for relative date presets and grouping. */
  now: number
  /** First day of the week for date grouping (0 = Sunday, 1 = Monday). */
  firstDayOfWeek: number
  pageSize: number
}

export type DateGroup =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'thisWeek' }
  | { kind: 'lastWeek' }
  | { kind: 'thisMonth' }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'unknown' }

export interface ResultGroup {
  group: DateGroup
  /** Index of the first item of this group within the result. */
  start: number
  count: number
}

export interface SearchResponse {
  token: number
  total: number
  groups: ResultGroup[]
  items: MessageSummary[]
  /** Folded terms (see shared/text.ts) to highlight. */
  highlightTerms: string[]
  /** Whether the query contains anything beyond plain folder browsing. */
  isSearch: boolean
  tookMs: number
}

/** Identifies a message: a top-level item, or a message embedded as attachment. */
export interface MessageRef {
  id: number
  /** Attachment indices leading to an embedded message. */
  path?: number[]
}

export interface Recipient {
  name: string
  email: string
  type: 'to' | 'cc' | 'bcc'
}

export interface AttachmentInfo {
  index: number
  name: string
  size: number
  mimeType: string
  isInline: boolean
  isMessage: boolean
}

/** File name and type of an attachment as written to disk. */
export interface AttachmentFileInfo {
  fileName: string
  mimeType: string
  size: number
  isMessage: boolean
}

export type PreviewKind = 'pdf' | 'image' | 'text' | 'csv' | 'html' | 'calendar' | 'contact' | 'audio' | 'video' | 'none'

/** An attachment made available for viewing, see main/attachments.ts. */
export interface AttachmentPreview {
  /** URL of the read-only copy, served by the app's preview protocol. */
  url: string
  fileName: string
  mimeType: string
  size: number
  kind: PreviewKind
  /** False for file types that could run code; those can only be saved. */
  canOpen: boolean
}

export type ExportFormat = 'pdf' | 'eml' | 'txt'

export interface AppointmentInfo {
  start: number | null
  end: number | null
  location: string
  isRecurring: boolean
  recurrence: string
  attendees: string
  isAllDay: boolean
}

export interface ContactField {
  key: string
  value: string
}

export interface TaskInfo {
  status: number
  percentComplete: number
  startDate: number | null
  dueDate: number | null
  owner: string
}

export interface MessageDetail {
  ref: MessageRef
  folderId: number | null
  kind: ItemKind
  messageClass: string
  subject: string
  from: { name: string; email: string }
  /** Set when the message was sent on behalf of someone else. */
  sender: { name: string; email: string } | null
  replyTo: string
  recipients: Recipient[]
  date: number
  sentDate: number | null
  receivedDate: number | null
  size: number
  importance: 0 | 1 | 2
  isRead: boolean
  flagged: boolean
  categories: string[]
  bodyFormat: 'html' | 'text' | 'none'
  html: string | null
  text: string
  attachments: AttachmentInfo[]
  /** Content-ID (lower case, without angle brackets) to data URL. */
  inlineImages: Record<string, string>
  headers: string
  security: SecurityKind | null
  appointment: AppointmentInfo | null
  contact: ContactField[] | null
  task: TaskInfo | null
}

export interface SaveResult {
  status: 'saved' | 'canceled' | 'error'
  path?: string
  count?: number
  error?: string
}

export interface RecentFile {
  path: string
  name: string
  size: number
  lastOpened: number
  itemCount: number | null
  exists: boolean
  /** A folder of mail files rather than a single file. */
  isFolder: boolean
}

export type ThemeSource = 'system' | 'light' | 'dark'

export type LanguageSetting = 'system' | 'de' | 'en'

export interface LocaleInfo {
  /** UI language. */
  locale: 'de' | 'en'
  /** BCP 47 tag used for dates and numbers, e.g. "en-DE". */
  formatLocale: string
}

export interface AppInfo extends LocaleInfo {
  platform: 'darwin' | 'win32' | 'linux' | (string & {})
  version: string
  accentColor: string | null
  themeSource: ThemeSource
  /** A file the app was asked to open before the UI was ready. */
  pendingPath: string | null
}

export type MenuCommand =
  | 'open'
  | 'openFolder'
  | 'close'
  | 'find'
  | 'toggleFilters'
  | 'toggleSidebar'
  | 'showHeaders'
  | 'searchHelp'
  | 'exportPdf'
  | 'exportEml'
  | 'exportText'
  | 'print'

/** A document built by the renderer for export or printing. */
export interface ExportDocument {
  format: 'pdf' | 'txt'
  /** HTML for PDF, plain text for TXT. */
  content: string
  /** File name without extension. */
  suggestedName: string
  /** Footer text of PDF pages. */
  footer: string
  /** Remote images may be loaded (the user allowed them for this message). */
  allowRemote: boolean
}

/** Result envelope used for all IPC calls, errors carry a stable code. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: PstErrorCode; message: string } }

/** Error codes the worker reports for known failure modes. */
export type PstErrorCode = 'NOT_FOUND' | 'NOT_PST' | 'READ_FAILED' | 'NOT_OPEN' | 'CANCELED' | 'BLOCKED' | 'OPEN_FAILED' | 'UNKNOWN'
