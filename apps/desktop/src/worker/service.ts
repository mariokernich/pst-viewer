import { open, writeFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import type {
  AttachmentFileInfo,
  IndexProgress,
  MessageRef,
  MessageSummary,
  OpenProgress,
  OpenResult,
  PstErrorCode,
  SaveResult,
  SearchRequest,
  SearchResponse
} from '../shared/types'
import { makeSnippet } from '../shared/text'
import { sanitizeFileName } from '../shared/files'
import type { ContentAttachment } from './content'
import { getMessageDetail, NotFoundError, openAttachedMessage } from './details'
import { buildEml } from './eml'
import { referencedContentIds } from './html'
import type { Archive, IndexedItem } from './archive'
import { PstError, PstIndex } from './indexer'
import { LocalArchive } from './localArchive'
import { runSearch, type SearchOutcome } from './search'
import type { WorkerMethod, WorkerRequests } from './protocol'

export class ServiceError extends Error {
  constructor(
    readonly code: PstErrorCode,
    message: string
  ) {
    super(message)
  }
}

const TEXT_CACHE_SIZE = 400

export type ServiceEvent = { type: 'progress'; progress: OpenProgress } | { type: 'indexProgress'; progress: IndexProgress }

/**
 * Transport independent request handling of the PST worker. Holds the index of
 * the currently open file and the most recent search result.
 */
export class PstService {
  private index: Archive | null = null
  private canceled = false
  private result: (SearchOutcome & { token: number }) | null = null
  private nextToken = 1
  private textCache = new Map<number, string>()
  private indexing: Promise<void> = Promise.resolve()

  constructor(private readonly emit: (event: ServiceEvent) => void = () => undefined) {}

  /** Resolves when the background content indexing of the open file is done. */
  whenIndexed(): Promise<void> {
    return this.indexing
  }

  cancel(): void {
    this.canceled = true
  }

  async handle<M extends WorkerMethod>(method: M, args: WorkerRequests[M]['args']): Promise<WorkerRequests[M]['result']> {
    const handlers: { [K in WorkerMethod]: (a: WorkerRequests[K]['args']) => Promise<WorkerRequests[K]['result']> } = {
      open: (a) => this.open(a.path),
      search: (a) => this.search(a),
      page: (a) => this.page(a.token, a.offset, a.limit),
      message: (a) => getMessageDetail(this.requireIndex(), a),
      saveAttachment: (a) => this.saveAttachment(a.ref, a.index, a.targetPath),
      saveAttachments: (a) => this.saveAttachments(a.ref, a.directory),
      attachmentInfo: (a) => this.attachmentInfo(a.ref, a.index),
      exportEml: (a) => this.exportEml(a.ref, a.targetPath)
    }
    try {
      return await (handlers[method] as (a: WorkerRequests[M]['args']) => Promise<WorkerRequests[M]['result']>)(args)
    } catch (err) {
      if (err instanceof ServiceError) throw err
      if (err instanceof PstError) throw new ServiceError(err.code, err.message)
      if (err instanceof NotFoundError) throw new ServiceError('NOT_FOUND', err.message)
      throw new ServiceError('UNKNOWN', (err as Error)?.message ?? String(err))
    }
  }

  close(): void {
    this.index?.close()
    this.index = null
    this.indexing = Promise.resolve()
    this.result = null
    this.textCache.clear()
  }

  private requireIndex(): Archive {
    if (!this.index) throw new ServiceError('NOT_OPEN', 'No file is open')
    return this.index
  }

  private async open(path: string): Promise<OpenResult> {
    this.close()
    this.canceled = false
    const options = {
      onProgress: (progress: OpenProgress) => this.emit({ type: 'progress', progress }),
      isCanceled: () => this.canceled
    }
    const index: Archive = (await isPstFile(path)) ? await PstIndex.open(path, options) : await LocalArchive.open(path, options)
    this.index = index
    if (!index.contentIndexed) {
      const inbox = index.folders.find((f) => f.special === 'inbox')
      this.indexing = index
        .indexContent({
          priorityFolderId: inbox?.id ?? null,
          isCanceled: () => this.index !== index,
          onProgress: (done, total) => {
            if (this.index === index && done < total) this.emit({ type: 'indexProgress', progress: { done, total } })
          }
        })
        .then(() => {
          if (this.index === index && index.contentIndexed) {
            this.emit({ type: 'indexProgress', progress: { done: index.items.length, total: index.items.length, senders: index.senders } })
          }
        })
        .catch(() => undefined)
    }
    return { store: index.store, folders: index.folders, senders: index.senders, contentIndexed: index.contentIndexed }
  }

  private async search(req: SearchRequest): Promise<SearchResponse> {
    const index = this.requireIndex()
    const started = performance.now()
    const outcome = runSearch(index, req)
    const token = this.nextToken++
    this.result = { ...outcome, token }
    const pageSize = Math.max(1, Math.min(req.pageSize, 1000))
    const items = await this.summaries(0, pageSize)
    return {
      token,
      total: outcome.order.length,
      groups: outcome.groups,
      items,
      highlightTerms: outcome.highlightTerms,
      isSearch: outcome.isSearch,
      tookMs: Math.round(performance.now() - started)
    }
  }

  private async page(token: number, offset: number, limit: number): Promise<MessageSummary[] | null> {
    if (!this.result || this.result.token !== token) return null
    return this.summaries(Math.max(0, offset), Math.max(0, Math.min(limit, 1000)))
  }

  private async summaries(offset: number, limit: number): Promise<MessageSummary[]> {
    const index = this.requireIndex()
    const result = this.result
    if (!result) return []
    const end = Math.min(result.order.length, offset + limit)
    const items: MessageSummary[] = []
    for (let i = offset; i < end; i++) {
      items.push(await this.summary(index.items[result.order[i]], result.bodyTerms))
    }
    return items
  }

  private async summary(item: IndexedItem, bodyTerms: string[]): Promise<MessageSummary> {
    let preview = item.preview
    // While searching the body, show the text around the first match instead of the preview.
    if (bodyTerms.length > 0 && bodyTerms.some((t) => item.sBody.includes(t))) {
      const snippet = makeSnippet(await this.bodyText(item.id), bodyTerms)
      if (snippet) preview = snippet
    }
    return {
      id: item.id,
      folderId: item.folderId,
      kind: item.kind,
      messageClass: item.messageClass,
      subject: item.subject,
      fromName: item.fromName,
      fromEmail: item.fromEmail,
      toLine: item.toLine,
      date: item.date,
      size: item.size,
      attachmentCount: item.attachmentCount,
      isRead: item.isRead,
      importance: item.importance,
      flagged: item.flagged,
      security: item.security,
      preview
    }
  }

  /** Body text (whitespace collapsed) used for search snippets, LRU cached. */
  private async bodyText(id: number): Promise<string> {
    const cached = this.textCache.get(id)
    if (cached !== undefined) {
      this.textCache.delete(id)
      this.textCache.set(id, cached)
      return cached
    }
    try {
      const { content } = await this.requireIndex().resolve({ id })
      const text = content.text.replace(/\s+/g, ' ').trim()
      this.textCache.set(id, text)
      if (this.textCache.size > TEXT_CACHE_SIZE) {
        const oldest = this.textCache.keys().next().value
        if (oldest !== undefined) this.textCache.delete(oldest)
      }
      return text
    } catch {
      return ''
    }
  }

  private async attachmentInfo(ref: MessageRef, index: number): Promise<AttachmentFileInfo> {
    const { content } = await this.requireIndex().resolve(ref)
    const att = content.attachments[index]
    if (!att) throw new ServiceError('NOT_FOUND', 'Attachment not found')
    return { fileName: fileNameOf(att), mimeType: att.mimeType, size: att.size, isMessage: att.isMessage }
  }

  /** Writes an attachment to disk; attached messages are written as .eml. */
  private async saveAttachment(ref: MessageRef, index: number, targetPath: string): Promise<SaveResult> {
    const { content } = await this.requireIndex().resolve(ref)
    const att = content.attachments[index]
    if (!att) throw new ServiceError('NOT_FOUND', 'Attachment not found')
    await writeFile(targetPath, await attachmentData(att))
    return { status: 'saved', path: targetPath, count: 1 }
  }

  private async saveAttachments(ref: MessageRef, directory: string): Promise<SaveResult> {
    const { content } = await this.requireIndex().resolve(ref)
    const cids = referencedContentIds(content.html)
    let count = 0
    const used = new Set<string>()
    for (const att of content.attachments) {
      // Same selection as shown in the attachment bar: no hidden or inline parts.
      if (att.hidden || (att.contentId !== '' && cids.has(att.contentId))) continue
      const data = await attachmentData(att)
      const name = fileNameOf(att)
      const { name: stem, ext } = parse(name)
      for (let n = 0; n < 1000; n++) {
        const candidate = n === 0 ? name : `${stem} (${n})${ext}`
        if (used.has(candidate.toLowerCase())) continue
        try {
          // 'wx' never overwrites existing files in the target folder.
          await writeFile(join(directory, candidate), data, { flag: 'wx' })
          used.add(candidate.toLowerCase())
          count++
          break
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        }
      }
    }
    return { status: 'saved', path: directory, count }
  }

  /** Exports a message as .eml (RFC 5322 / MIME). */
  private async exportEml(ref: MessageRef, targetPath: string): Promise<SaveResult> {
    const resolved = await this.requireIndex().resolve(ref)
    await writeFile(targetPath, await buildEml(resolved))
    return { status: 'saved', path: targetPath, count: 1 }
  }
}

async function attachmentData(att: ContentAttachment): Promise<Buffer> {
  // Outlook items attached to PST or .msg messages are converted to .eml.
  if (att.source === 'pstMessage' || att.source === 'msgMessage') return buildEml(await openAttachedMessage(att))
  return att.read()
}

function fileNameOf(att: ContentAttachment): string {
  const name = sanitizeFileName(att.name)
  return att.isMessage && !/\.eml$/i.test(name) ? `${name}.eml` : name
}

/** PST and OST files start with the signature "!BDN". */
async function isPstFile(path: string): Promise<boolean> {
  try {
    const handle = await open(path, 'r')
    try {
      const signature = Buffer.alloc(4)
      await handle.read(signature, 0, 4, 0)
      return signature.toString('latin1') === '!BDN'
    } finally {
      await handle.close()
    }
  } catch {
    // Directories and unreadable paths are handled by the local archive.
    return false
  }
}
