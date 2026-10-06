import type { FolderNode, ItemKind, MessageRef, SecurityKind, SenderSuggestion, StoreInfo } from '../shared/types'
import type { ResolvedMessage } from './details'

/** An item as kept in memory for listing and searching. */
export interface IndexedItem {
  id: number
  folderId: number
  /** Additional folders the item appears in (e.g. Gmail labels). */
  extraFolderIds?: number[]
  kind: ItemKind
  messageClass: string
  subject: string
  fromName: string
  fromEmail: string
  toLine: string
  date: number
  size: number
  attachmentCount: number
  isRead: boolean
  importance: 0 | 1 | 2
  flagged: boolean
  security: SecurityKind | null
  preview: string
  /** Bit mask of attachment categories (see attachmentTypes.ts). */
  attachmentKinds: number
  /** False while only list data is known (body not indexed yet). */
  indexed: boolean
  // Folded search fields (see shared/text.ts).
  sSubject: string
  sFrom: string
  sTo: string
  sBody: string
  sAttach: string
}

export interface ContentIndexOptions {
  onProgress?: (done: number, total: number) => void
  isCanceled?: () => boolean
  /** Folder whose items are indexed first (usually the one on screen). */
  priorityFolderId?: number | null
}

/**
 * A mail archive opened by the worker: a PST file, an MBOX file or a set of
 * EML/MSG files. The list is available right after opening; bodies are
 * indexed afterwards by indexContent().
 */
export interface Archive {
  readonly items: IndexedItem[]
  readonly itemById: Map<number, IndexedItem>
  readonly folderById: Map<number, FolderNode>
  /** Folder id to the ids of the folder and all of its descendants. */
  readonly subtreeIds: Map<number, Set<number>>
  readonly folders: FolderNode[]
  readonly senders: SenderSuggestion[]
  readonly store: StoreInfo
  readonly contentIndexed: boolean
  indexContent(options?: ContentIndexOptions): Promise<void>
  /** Loads a message, following ref.path into attached messages. */
  resolve(ref: MessageRef): Promise<ResolvedMessage>
  close(): void
}

export function collectSenders(items: IndexedItem[]): SenderSuggestion[] {
  const senders = new Map<string, SenderSuggestion>()
  for (const item of items) {
    if (!item.fromEmail && !item.fromName) continue
    const key = (item.fromEmail || item.fromName).toLowerCase()
    const entry = senders.get(key)
    if (entry) entry.count++
    else senders.set(key, { name: item.fromName, email: item.fromEmail, count: 1 })
  }
  return [...senders.values()].sort((a, b) => b.count - a.count).slice(0, 5000)
}

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))
