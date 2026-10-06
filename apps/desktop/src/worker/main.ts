/**
 * Entry point of the PST worker, running as an Electron utility process.
 * Parsing and searching happen here so the UI never blocks.
 *
 * The PST file is opened read-only; nothing in this process writes to it.
 */
import type { MainToWorkerMessage, WorkerToMainMessage } from './protocol'
import { PstService, ServiceError } from './service'

const port = process.parentPort
if (!port) throw new Error('The PST worker must run as an Electron utility process')

// pst-extractor logs parser diagnostics via console; keep them out of the app log
// unless debugging.
if (!process.env.PST_VIEWER_DEBUG) {
  console.log = () => undefined
  console.error = () => undefined
}

const send = (message: WorkerToMainMessage): void => port.postMessage(message)
const service = new PstService((event) => send(event))

port.on('message', (event: { data: MainToWorkerMessage }) => {
  const message = event.data
  if (message.type === 'cancel') {
    service.cancel()
    return
  }
  if (message.type !== 'request') return
  service.handle(message.method, message.args).then(
    (result) => send({ type: 'response', id: message.id, ok: true, result }),
    (err: unknown) => {
      const error = err instanceof ServiceError ? { code: err.code, message: err.message } : { code: 'UNKNOWN' as const, message: String(err) }
      send({ type: 'response', id: message.id, ok: false, error })
    }
  )
})

send({ type: 'ready' })
