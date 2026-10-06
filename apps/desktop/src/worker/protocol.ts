import type {
  AttachmentFileInfo,
  IndexProgress,
  MessageDetail,
  MessageRef,
  MessageSummary,
  OpenProgress,
  OpenResult,
  PstErrorCode,
  SearchRequest,
  SearchResponse
} from '../shared/types'

/** Requests the main process sends to the PST worker. */
export interface WorkerRequests {
  open: { args: { path: string }; result: OpenResult }
  search: { args: SearchRequest; result: SearchResponse }
  page: { args: { token: number; offset: number; limit: number }; result: MessageSummary[] | null }
  message: { args: MessageRef; result: MessageDetail }
  attachmentInfo: { args: { ref: MessageRef; index: number }; result: AttachmentFileInfo }
  /** An attachment's bytes; attached messages as .eml. */
  attachmentData: { args: { ref: MessageRef; index: number }; result: Uint8Array }
  /** The visible attachments of a message as files (no hidden or inline parts). */
  attachmentFiles: { args: MessageRef; result: AttachmentData[] }
  /** The message as .eml (RFC 5322 / MIME). */
  emlData: { args: MessageRef; result: Uint8Array }
}

/**
 * The worker never writes files: the main process writes what the user saves,
 * so the process that reads the archives needs no write access at all.
 */
export interface AttachmentData {
  fileName: string
  data: Uint8Array
}

export type WorkerMethod = keyof WorkerRequests

export interface WorkerRequestMessage<M extends WorkerMethod = WorkerMethod> {
  type: 'request'
  id: number
  method: M
  args: WorkerRequests[M]['args']
}

export interface WorkerCancelMessage {
  type: 'cancel'
}

export type MainToWorkerMessage = WorkerRequestMessage | WorkerCancelMessage

export type WorkerToMainMessage =
  | { type: 'response'; id: number; ok: true; result: unknown }
  | { type: 'response'; id: number; ok: false; error: { code: PstErrorCode; message: string } }
  | { type: 'progress'; progress: OpenProgress }
  | { type: 'indexProgress'; progress: IndexProgress }
  | { type: 'ready' }
