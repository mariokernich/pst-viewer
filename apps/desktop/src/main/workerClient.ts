import { utilityProcess, type UtilityProcess } from 'electron'
import workerPath from '../worker/main?modulePath'
import type { IndexProgress, OpenProgress, PstErrorCode } from '../shared/types'
import type { MainToWorkerMessage, WorkerMethod, WorkerRequests, WorkerToMainMessage } from '../worker/protocol'

export class WorkerError extends Error {
  constructor(
    readonly code: PstErrorCode,
    message: string
  ) {
    super(message)
  }
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: WorkerError) => void
}

/**
 * Runs the PST parser in a separate utility process so that heavy parsing
 * never blocks the main process or the UI. Each opened file gets a fresh
 * process, which also guarantees that no state leaks between files.
 */
export class PstWorkerClient {
  private child: UtilityProcess | null = null
  private ready: Promise<void> | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  constructor(
    private readonly events: {
      onProgress: (progress: OpenProgress) => void
      onIndexProgress: (progress: IndexProgress) => void
    }
  ) {}

  get isRunning(): boolean {
    return this.child !== null
  }

  /** Starts a fresh worker, terminating a running one. */
  restart(): Promise<void> {
    this.stop()
    const child = utilityProcess.fork(workerPath, [], {
      serviceName: 'PST Viewer Reader',
      stdio: process.env.ELECTRON_RENDERER_URL ? 'inherit' : 'ignore'
    })
    this.child = child
    this.ready = new Promise<void>((resolve, reject) => {
      const onReadyTimeout = setTimeout(() => reject(new WorkerError('UNKNOWN', 'Worker did not start')), 15_000)
      child.on('message', (message: WorkerToMainMessage) => {
        if (message.type === 'ready') {
          clearTimeout(onReadyTimeout)
          resolve()
          return
        }
        this.handleMessage(message)
      })
      child.once('exit', (code) => {
        clearTimeout(onReadyTimeout)
        if (this.child === child) {
          this.child = null
          this.ready = null
        }
        reject(new WorkerError('UNKNOWN', `Worker exited (${code})`))
        this.rejectAll(new WorkerError('READ_FAILED', `The reader process stopped unexpectedly (${code}).`))
      })
    })
    // Avoid unhandled rejections when nobody awaits a failed start.
    this.ready.catch(() => undefined)
    return this.ready
  }

  stop(): void {
    const child = this.child
    this.child = null
    this.ready = null
    this.rejectAll(new WorkerError('CANCELED', 'Canceled'))
    child?.kill()
  }

  cancel(): void {
    this.post({ type: 'cancel' })
  }

  async request<M extends WorkerMethod>(method: M, args: WorkerRequests[M]['args']): Promise<WorkerRequests[M]['result']> {
    if (!this.child || !this.ready) throw new WorkerError('NOT_OPEN', 'No file is open')
    await this.ready
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      this.post({ type: 'request', id, method, args })
    })
  }

  private post(message: MainToWorkerMessage): void {
    this.child?.postMessage(message)
  }

  private handleMessage(message: WorkerToMainMessage): void {
    if (message.type === 'progress') {
      this.events.onProgress(message.progress)
      return
    }
    if (message.type === 'indexProgress') {
      this.events.onIndexProgress(message.progress)
      return
    }
    if (message.type !== 'response') return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.ok) pending.resolve(message.result)
    else pending.reject(new WorkerError(message.error.code, message.error.message))
  }

  private rejectAll(error: WorkerError): void {
    const pending = [...this.pending.values()]
    this.pending.clear()
    for (const p of pending) p.reject(error)
  }
}
