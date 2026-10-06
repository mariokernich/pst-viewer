import type {
  AttachmentFileInfo,
  IndexProgress,
  MessageDetail,
  MessageRef,
  MessageSummary,
  OpenProgress,
  OpenResult,
  PstErrorCode,
  SaveResult,
  SearchRequest,
  SearchResponse
} from '../shared/types'

/** Requests the main process sends to the PST worker. */
export interface WorkerRequests {
  open: { args: { path: string }; result: OpenResult }
  search: { args: SearchRequest; result: SearchResponse }
  page: { args: { token: number; offset: number; limit: number }; result: MessageSummary[] | null }
  message: { args: MessageRef; result: MessageDetail }
  saveAttachment: { args: { ref: MessageRef; index: number; targetPath: string }; result: SaveResult }
  saveAttachments: { args: { ref: MessageRef; directory: string }; result: SaveResult }
  attachmentInfo: { args: { ref: MessageRef; index: number }; result: AttachmentFileInfo }
  exportEml: { args: { ref: MessageRef; targetPath: string }; result: SaveResult }
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
