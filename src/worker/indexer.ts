import { basename } from 'node:path'
import { statSync } from 'node:fs'
import Long from 'long'
import { PSTFile, PSTMessage, PSTUtil, type PSTFolder } from './pst'
import type {
  FolderNode,
  ItemKind,
  OpenProgress,
  PstFormat,
  SecurityKind,
  SenderSuggestion,
  SpecialFolder,
  StoreInfo
} from '../shared/types'
import { foldForIndex, squash } from '../shared/text'
import { loadContent, raw, safe } from './content'
import { readContentsTable, type ContentsRow } from './contentsTable'
import { referencedContentIds } from './html'
import { collectFolderIds, computeTotals, detectSpecialFolder, sortFolders } from './folders'
import { classifyAttachment } from './attachmentTypes'

/** An item as kept in memory for listing and searching. */
export interface IndexedItem {
  id: number
  folderId: number
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
  /** False while only the contents table data is known (body not indexed yet). */
  indexed: boolean
  // Folded search fields (see shared/text.ts).
  sSubject: string
  sFrom: string
  sTo: string
  sBody: string
  sAttach: string
}

export class PstError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'NOT_PST' | 'READ_FAILED' | 'CANCELED',
    message: string
  ) {
    super(message)
  }
}

const PREVIEW_LENGTH = 240
/** Upper bound of indexed body text per item, protects against huge items. */
const MAX_BODY_INDEX_LENGTH = 512 * 1024
/** Keep the worker responsive: yield to pending requests at least this often. */
const YIELD_INTERVAL_MS = 30

const PR_FLAG_STATUS = 0x1090
const PR_SENDER_SMTP_ADDRESS = 0x5d01
const PR_SENT_REPRESENTING_SMTP_ADDRESS = 0x5d02
const PR_IPM_SUBTREE_ENTRYID = 0x35e0
const MSGFLAG_READ = 0x01
const MSGFLAG_HASATTACH = 0x10

interface ScannedFolder {
  node: FolderNode
  folder: PSTFolder
  special: SpecialFolder | null
}

export interface OpenOptions {
  onProgress?: (progress: OpenProgress) => void
  isCanceled?: () => boolean
}

export interface ContentIndexOptions {
  onProgress?: (done: number, total: number) => void
  isCanceled?: () => boolean
  /** Folder whose items are indexed first (usually the one on screen). */
  priorityFolderId?: number | null
}

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

export class PstIndex {
  readonly items: IndexedItem[] = []
  readonly itemById = new Map<number, IndexedItem>()
  readonly folderById = new Map<number, FolderNode>()
  /** Folder id to the ids of the folder and all of its descendants. */
  readonly subtreeIds = new Map<number, Set<number>>()
  readonly specialById = new Map<number, SpecialFolder | null>()
  folders: FolderNode[] = []
  senders: SenderSuggestion[] = []
  store!: StoreInfo
  /** True once every item's body, recipients and attachments are indexed. */
  contentIndexed = false
  private skipped = 0

  private constructor(readonly pst: PSTFile) {}

  /**
   * Opens a PST file and builds the item list from the folders' contents
   * tables (fast). Bodies are indexed afterwards with indexContent().
   */
  static async open(filePath: string, options: OpenOptions = {}): Promise<PstIndex> {
    const started = Date.now()
    let fileSize = 0
    try {
      const stat = statSync(filePath)
      if (!stat.isFile()) throw new Error('not a file')
      fileSize = stat.size
    } catch {
      throw new PstError('NOT_FOUND', `File not found: ${filePath}`)
    }

    options.onProgress?.({ phase: 'opening', done: 0, total: 0 })
    let pst: PSTFile
    try {
      // pst-extractor opens the file with the 'r' flag only - it is never modified.
      pst = new PSTFile(filePath)
    } catch (err) {
      throw new PstError('NOT_PST', `Not a valid Outlook data file: ${(err as Error).message}`)
    }

    const index = new PstIndex(pst)
    try {
      const scanned = index.scanFolders(options)
      await index.listItems(scanned, options)
      index.finish(filePath, fileSize, started)
    } catch (err) {
      index.close()
      if (err instanceof PstError) throw err
      throw new PstError('READ_FAILED', (err as Error).message)
    }
    return index
  }

  close(): void {
    safe(() => this.pst.close(), undefined)
  }

  // ---------------------------------------------------------------------------
  // Folder scan

  private scanFolders(options: OpenOptions): ScannedFolder[] {
    const root = this.pst.getRootFolder()
    const scanned: ScannedFolder[] = []
    const topLevel = subFolders(root)
    const ipmSubtreeId = this.readIpmSubtreeId()

    let ipm = topLevel.find((f) => nid(f) === ipmSubtreeId)
    if (!ipm) {
      // Fallback: the top-level folder with the most subfolders.
      ipm = [...topLevel].sort((a, b) => safe(() => b.subFolderCount, 0) - safe(() => a.subFolderCount, 0))[0]
    }

    const visible: FolderNode[] = []
    if (ipm) {
      for (const f of subFolders(ipm)) visible.push(this.scanFolder(f, 0, scanned))
    }
    // Some tools write folders next to the IPM subtree; keep those that hold items.
    for (const f of topLevel) {
      if (f === ipm || isSearchFolder(f)) continue
      if (safe(() => f.contentCount, 0) > 0 || safe(() => f.hasSubfolders, false)) {
        const before = scanned.length
        const node = this.scanFolder(f, 0, scanned)
        if (hasContent(node, scanned)) {
          visible.push(node)
        } else {
          scanned.splice(before)
          for (const id of collectFolderIds(node)) this.folderById.delete(id)
        }
      }
    }
    this.folders = visible
    options.onProgress?.({ phase: 'scanning', done: 0, total: totalContent(scanned) })
    return scanned
  }

  private scanFolder(folder: PSTFolder, depth: number, scanned: ScannedFolder[]): FolderNode {
    const name = safe(() => folder.displayName, '') || '—'
    const containerClass = safe(() => folder.containerClass, '')
    const special = detectSpecialFolder(name, containerClass, depth)
    const node: FolderNode = {
      id: nid(folder),
      name,
      special,
      containerClass,
      itemCount: 0,
      unreadCount: 0,
      totalCount: 0,
      children: []
    }
    this.folderById.set(node.id, node)
    this.specialById.set(node.id, special)
    if (!isSearchFolder(folder)) scanned.push({ node, folder, special })
    for (const child of subFolders(folder)) node.children.push(this.scanFolder(child, depth + 1, scanned))
    return node
  }

  private readIpmSubtreeId(): number | null {
    try {
      const store = this.pst.getMessageStore()
      const entryId = (store as unknown as { getBinaryItem(id: number): Buffer | null }).getBinaryItem(PR_IPM_SUBTREE_ENTRYID)
      if (entryId && entryId.length >= 24) return entryId.readUInt32LE(20)
    } catch {
      // ignore
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Phase 1: item list from the contents tables

  private async listItems(scanned: ScannedFolder[], options: OpenOptions): Promise<void> {
    const total = totalContent(scanned)
    let done = 0
    let lastReport = 0
    let lastYield = Date.now()

    const report = async (folderName: string): Promise<void> => {
      const now = Date.now()
      if (now - lastReport > 80) {
        lastReport = now
        options.onProgress?.({ phase: 'indexing', done: Math.min(done, total), total, folderName })
      }
      if (now - lastYield > YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
        if (options.isCanceled?.()) throw new PstError('CANCELED', 'Canceled')
      }
    }

    for (const { node, folder, special } of scanned) {
      const expected = safe(() => folder.contentCount, 0)
      if (expected === 0) continue

      const rows = readContentsTable(this.pst, folder, expected)
      if (rows) {
        for (const row of rows) {
          if (this.itemById.has(row.nid)) continue
          this.addItem(itemFromRow(row, node.id, special), node)
        }
        done += expected
        await report(node.name)
        continue
      }

      // The contents table is unusable: open every message instead.
      let processed = 0
      while (processed < expected) {
        const msg = nextChild(folder, expected)
        if (msg === undefined) break
        processed++
        done++
        if (msg) {
          try {
            const item = await this.indexMessage(msg, node.id, special)
            if (!this.itemById.has(item.id)) this.addItem(item, node)
          } catch {
            this.skipped++
          }
        } else {
          this.skipped++
        }
        await report(node.name)
      }
    }
    options.onProgress?.({ phase: 'finishing', done: total, total })
    this.senders = collectSenders(this.items)
  }

  private addItem(item: IndexedItem, node: FolderNode): void {
    this.items.push(item)
    this.itemById.set(item.id, item)
    node.itemCount++
    if (!item.isRead && (item.kind === 'mail' || item.kind === 'meeting')) node.unreadCount++
  }

  // ---------------------------------------------------------------------------
  // Phase 2: bodies, recipients and attachments

  /**
   * Opens every not yet indexed item and adds its body, recipients and
   * attachments to the search index. Runs in the background and yields
   * regularly so that requests from the UI are served in between.
   */
  async indexContent(options: ContentIndexOptions = {}): Promise<void> {
    const pending = this.items.filter((item) => !item.indexed)
    const priority = options.priorityFolderId ?? null
    if (priority !== null) {
      const first = this.subtreeIds.get(priority) ?? new Set([priority])
      pending.sort((a, b) => Number(first.has(b.folderId)) - Number(first.has(a.folderId)))
    }

    const total = pending.length
    let done = 0
    let lastYield = Date.now()
    let lastReport = 0
    options.onProgress?.(0, total)

    for (const item of pending) {
      if (options.isCanceled?.()) return
      try {
        const msg = loadMessage(this.pst, item.id)
        if (msg) {
          const full = await this.indexMessage(msg, item.folderId, this.specialById.get(item.folderId) ?? null)
          Object.assign(item, full)
        }
      } catch {
        // keep the contents table data
      }
      item.indexed = true
      done++

      const now = Date.now()
      if (now - lastReport > 250) {
        lastReport = now
        options.onProgress?.(done, total)
      }
      if (now - lastYield > YIELD_INTERVAL_MS) {
        await yieldToEventLoop()
        lastYield = Date.now()
      }
    }
    this.contentIndexed = true
    this.senders = collectSenders(this.items)
    options.onProgress?.(total, total)
  }

  private async indexMessage(msg: PSTMessage, folderId: number, special: SpecialFolder | null): Promise<IndexedItem> {
    const messageClass = safe(() => msg.messageClass, '') || 'IPM.Note'
    const kind = kindOf(messageClass)
    const content = await loadContent(msg)
    const cids = referencedContentIds(content.html)

    let attachmentCount = 0
    let attachmentKinds = 0
    const attachmentNames: string[] = []
    for (const att of content.attachments) {
      const inline = att.hidden || (att.contentId !== '' && cids.has(att.contentId))
      if (inline) continue
      attachmentCount++
      attachmentKinds |= classifyAttachment(att.name, att.mimeType, att.isMessage)
      attachmentNames.push(att.name)
    }

    const from = senderOf(msg)
    const subject = safe(() => msg.subject, '')
    const recipients = recipientsLine(msg)
    const toLine = squash(safe(() => msg.displayTo, '') || recipients.names)
    const text = content.text.length > MAX_BODY_INDEX_LENGTH ? content.text.slice(0, MAX_BODY_INDEX_LENGTH) : content.text
    const flagStatus = safe(() => raw(msg).getIntItem(PR_FLAG_STATUS), 0)
    const importance = safe(() => msg.importance, 1)

    return {
      id: nid(msg),
      folderId,
      kind,
      messageClass,
      subject,
      fromName: from.name,
      fromEmail: from.email,
      toLine,
      date: itemDate(msg, kind, special),
      size: safe(() => msg.messageSize.toNumber(), 0),
      attachmentCount,
      isRead: safe(() => msg.isRead, true),
      importance: importance === 2 ? 2 : importance === 0 ? 0 : 1,
      flagged: flagStatus === 2,
      security: content.security,
      preview: squash(text.slice(0, PREVIEW_LENGTH * 2)).slice(0, PREVIEW_LENGTH),
      attachmentKinds,
      indexed: true,
      sSubject: foldForIndex(subject),
      sFrom: foldForIndex(`${from.name} ${from.email}`),
      sTo: foldForIndex(`${toLine} ${safe(() => msg.displayCC, '')} ${safe(() => msg.displayBCC, '')} ${recipients.emails}`),
      sBody: foldForIndex(text),
      sAttach: foldForIndex(attachmentNames.join(' '))
    }
  }

  private finish(filePath: string, fileSize: number, started: number): void {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
    for (const f of this.folders) computeTotals(f)
    sortFolders(this.folders, collator)
    for (const node of this.folderById.values()) this.subtreeIds.set(node.id, collectFolderIds(node))
    this.contentIndexed = this.items.every((item) => item.indexed)

    let min = Infinity
    let max = -Infinity
    for (const item of this.items) {
      if (item.date > 0) {
        if (item.date < min) min = item.date
        if (item.date > max) max = item.date
      }
    }

    this.store = {
      filePath,
      fileName: basename(filePath),
      fileSize,
      displayName: safe(() => this.pst.getMessageStore().displayName, '') || basename(filePath),
      format: formatOf(safe(() => this.pst.pstFileType, 0)),
      itemCount: this.items.length,
      folderCount: this.folderById.size,
      dateRange: Number.isFinite(min) ? { min, max } : null,
      indexMs: Date.now() - started,
      skippedItems: this.skipped
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers

function nid(obj: { descriptorNodeId: { toNumber(): number } }): number {
  return obj.descriptorNodeId.toNumber()
}

function subFolders(folder: PSTFolder): PSTFolder[] {
  return safe(() => (folder.hasSubfolders ? folder.getSubFolders() : []), [])
}

function totalContent(scanned: ScannedFolder[]): number {
  return scanned.reduce((sum, s) => sum + safe(() => s.folder.contentCount, 0), 0)
}

function isSearchFolder(folder: PSTFolder): boolean {
  // NID type 0x03 marks search folders; their contents duplicate other folders.
  return (nid(folder) & 0x1f) === 0x03
}

function hasContent(node: FolderNode, scanned: ScannedFolder[]): boolean {
  const ids = collectFolderIds(node)
  return scanned.some((s) => ids.has(s.node.id) && safe(() => s.folder.contentCount, 0) > 0)
}

/** Loads a top-level message by its node id. */
export function loadMessage(pst: PSTFile, id: number): PSTMessage | null {
  const obj: unknown = PSTUtil.detectAndLoadPSTObject(pst, Long.fromNumber(id))
  return obj instanceof PSTMessage ? obj : null
}

/**
 * Returns the next item of a folder, null for an unreadable item that was
 * skipped, or undefined when the folder is exhausted.
 */
function nextChild(folder: PSTFolder, expected: number): PSTMessage | null | undefined {
  try {
    const child = folder.getNextChild()
    return child ?? undefined
  } catch {
    // Skip the broken row so that the cursor keeps moving forward.
    const cursor = (folder as unknown as { currentEmailIndex: number }).currentEmailIndex ?? expected
    if (cursor + 1 >= expected) return undefined
    safe(() => folder.moveChildCursorTo(cursor + 1), undefined)
    return null
  }
}

/** Builds a provisional item from a contents table row. */
function itemFromRow(row: ContentsRow, folderId: number, special: SpecialFolder | null): IndexedItem {
  const messageClass = row.messageClass || 'IPM.Note'
  const kind = kindOf(messageClass)
  const subject = row.subject ?? ''
  const fromName = squash(row.senderName ?? '')
  const toLine = squash(row.displayTo ?? '')
  const flags = row.messageFlags ?? 0
  const sentLike = special === 'sent' || special === 'drafts' || special === 'outbox'
  const date = (sentLike ? row.submitTime ?? row.modificationTime : row.deliveryTime ?? row.submitTime ?? row.modificationTime) ?? 0
  const importance = row.importance ?? 1
  return {
    id: row.nid,
    folderId,
    kind,
    messageClass,
    subject,
    fromName,
    fromEmail: '',
    toLine,
    date,
    size: row.size ?? 0,
    // Provisional: the flag also counts inline images; refined while indexing.
    attachmentCount: flags & MSGFLAG_HASATTACH ? 1 : 0,
    isRead: (flags & MSGFLAG_READ) !== 0,
    importance: importance === 2 ? 2 : importance === 0 ? 0 : 1,
    flagged: row.flagStatus === 2,
    security: /^IPM\.Note\.SMIME/i.test(messageClass) ? (/MultipartSigned/i.test(messageClass) ? 'signed' : 'encrypted') : null,
    preview: '',
    attachmentKinds: 0,
    indexed: false,
    sSubject: foldForIndex(subject),
    sFrom: foldForIndex(fromName),
    sTo: foldForIndex(toLine),
    sBody: '',
    sAttach: ''
  }
}

function collectSenders(items: IndexedItem[]): SenderSuggestion[] {
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

export function kindOf(messageClass: string): ItemKind {
  const c = messageClass.toUpperCase()
  if (c.startsWith('IPM.SCHEDULE.MEETING')) return 'meeting'
  if (c.startsWith('IPM.APPOINTMENT')) return 'appointment'
  if (c.startsWith('IPM.CONTACT') || c.startsWith('IPM.DISTLIST') || c.startsWith('IPM.ABCHPERSON')) return 'contact'
  if (c.startsWith('IPM.TASK')) return 'task'
  if (c.startsWith('IPM.STICKYNOTE')) return 'note'
  if (c.startsWith('IPM.ACTIVITY')) return 'journal'
  if (c.startsWith('IPM.NOTE') || c.startsWith('REPORT.') || c.startsWith('IPM.POST') || c === 'IPM' || c.startsWith('IPM.SHARING') || c.startsWith('IPM.OUTLOOK.RECALL'))
    return 'mail'
  return 'other'
}

function itemDate(msg: PSTMessage, kind: ItemKind, special: SpecialFolder | null): number {
  const t = (d: Date | null | undefined): number => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0)
  if (kind === 'appointment') {
    const start = safe(() => (msg as unknown as { startTime: Date | null }).startTime, null)
    if (start) return t(start)
  }
  if (special === 'sent' || special === 'drafts' || special === 'outbox') {
    return t(safe(() => msg.clientSubmitTime, null)) || t(safe(() => msg.modificationTime, null)) || t(safe(() => msg.creationTime, null))
  }
  return (
    t(safe(() => msg.messageDeliveryTime, null)) ||
    t(safe(() => msg.clientSubmitTime, null)) ||
    t(safe(() => msg.modificationTime, null)) ||
    t(safe(() => msg.creationTime, null))
  )
}

export interface Address {
  name: string
  email: string
}

/** Resolves the displayed sender, preferring SMTP addresses over Exchange DNs. */
export function senderOf(msg: PSTMessage): Address {
  const name = safe(() => msg.sentRepresentingName, '') || safe(() => msg.senderName, '')
  const candidates = [
    safe(() => msg.sentRepresentingEmailAddress, ''),
    safe(() => raw(msg).getStringItem(PR_SENT_REPRESENTING_SMTP_ADDRESS), ''),
    safe(() => msg.senderEmailAddress, ''),
    safe(() => raw(msg).getStringItem(PR_SENDER_SMTP_ADDRESS), '')
  ]
  let email = candidates.find((c) => c.includes('@')) ?? ''
  if (!email) email = fromHeader(safe(() => msg.transportMessageHeaders, ''))
  return { name: squash(name || email), email: email.trim() }
}

/** The actual sender if a message was sent on behalf of someone else. */
export function actualSenderOf(msg: PSTMessage): Address | null {
  const name = safe(() => msg.senderName, '')
  const email =
    [safe(() => msg.senderEmailAddress, ''), safe(() => raw(msg).getStringItem(PR_SENDER_SMTP_ADDRESS), '')].find((c) => c.includes('@')) ?? ''
  const representing = senderOf(msg)
  if (!name && !email) return null
  const sameEmail = email && representing.email && email.toLowerCase() === representing.email.toLowerCase()
  const sameName = name && representing.name && name.toLowerCase() === representing.name.toLowerCase()
  if (sameEmail || (!email && sameName)) return null
  return { name: squash(name || email), email }
}

function fromHeader(headers: string): string {
  const m = /^from:[^\r\n]*?<?([^\s<>"]+@[^\s<>"]+)>?/im.exec(headers)
  return m ? m[1] : ''
}

function recipientsLine(msg: PSTMessage): { names: string; emails: string } {
  const names: string[] = []
  const emails: string[] = []
  const count = safe(() => msg.numberOfRecipients, 0)
  for (let i = 0; i < count; i++) {
    const r = safe(() => msg.getRecipient(i), null)
    if (!r) continue
    const name = safe(() => r.displayName, '')
    const email = [safe(() => r.smtpAddress, ''), safe(() => r.emailAddress, '')].find((e) => e.includes('@')) ?? ''
    if (safe(() => r.recipientType, 1) === 1 && name) names.push(name)
    if (email) emails.push(email)
  }
  return { names: names.join('; '), emails: emails.join(' ') }
}

function formatOf(type: number): PstFormat {
  if (type === 14 || type === 15) return 'ansi'
  if (type === 23) return 'unicode'
  if (type === 36) return 'unicode4k'
  return 'unknown'
}
