import type { PstViewerApi } from '@shared/api'
import type { IpcResult, PstErrorCode } from '@shared/types'

export class ApiError extends Error {
  constructor(
    readonly code: PstErrorCode,
    message: string
  ) {
    super(message)
  }
}

export const bridge: PstViewerApi = window.pstViewer

/** Unwraps an IPC result, throwing an ApiError on failure. */
export async function call<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (result.ok) return result.value
  throw new ApiError(result.error.code, result.error.message)
}

declare global {
  interface Window {
    pstViewer: PstViewerApi
  }
}
