import type {
  AppInfo,
  AttachmentPreview,
  ExportDocument,
  IndexProgress,
  IpcResult,
  LocaleInfo,
  MenuCommand,
  MessageDetail,
  MessageRef,
  MessageSummary,
  OpenProgress,
  OpenResult,
  RecentFile,
  SaveResult,
  SearchRequest,
  SearchResponse,
  ThemeSource
} from './types'

type Call<T> = Promise<IpcResult<T>>
type Unsubscribe = () => void

/**
 * The API the preload script exposes to the renderer as `window.pstViewer`.
 * It is deliberately small and has no way to modify a PST file.
 */
export interface PstViewerApi {
  getAppInfo(): Call<AppInfo>
  setTheme(source: ThemeSource): Call<void>
  setRemoteImagesAllowed(allowed: boolean): Call<void>
  showOpenDialog(kind?: 'file' | 'folder'): Call<string | null>
  getPathForFile(file: File): string

  openPst(path: string): Call<OpenResult>
  cancelOpen(): Call<void>
  closePst(): Call<void>
  search(request: SearchRequest): Call<SearchResponse>
  getPage(token: number, offset: number, limit: number): Call<MessageSummary[] | null>
  getMessage(ref: MessageRef): Call<MessageDetail>
  saveAttachment(ref: MessageRef, index: number): Call<SaveResult>
  saveAttachments(ref: MessageRef): Call<SaveResult>
  /** Creates a read-only temporary copy and returns how to display it. */
  previewAttachment(ref: MessageRef, index: number): Call<AttachmentPreview>
  /** Opens a read-only temporary copy with the default app. */
  openAttachment(ref: MessageRef, index: number): Call<void>
  /** macOS Quick Look for a read-only temporary copy. */
  quickLook(ref: MessageRef, index: number): Call<void>
  exportEml(ref: MessageRef, suggestedName: string): Call<SaveResult>
  exportDocument(document: ExportDocument): Call<SaveResult>
  printDocument(document: ExportDocument): Call<boolean>

  listRecentFiles(): Call<RecentFile[]>
  removeRecentFile(path: string): Call<RecentFile[]>
  clearRecentFiles(): Call<void>

  openExternal(url: string): Call<void>
  showItemInFolder(path: string): Call<void>

  onProgress(callback: (progress: OpenProgress) => void): Unsubscribe
  onIndexProgress(callback: (progress: IndexProgress) => void): Unsubscribe
  onMenuCommand(callback: (command: MenuCommand) => void): Unsubscribe
  onOpenPath(callback: (path: string) => void): Unsubscribe
  onAccentColor(callback: (color: string | null) => void): Unsubscribe
  onThemeChange(callback: (source: ThemeSource) => void): Unsubscribe
  onRecentChanged(callback: () => void): Unsubscribe
  onLocaleChange(callback: (locale: LocaleInfo) => void): Unsubscribe
}
