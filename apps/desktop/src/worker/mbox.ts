import { open, type FileHandle } from 'node:fs/promises'

/**
 * MBOX support (mboxo/mboxrd as written by Thunderbird, Apple Mail and
 * Google Takeout). Messages are located by scanning for "From " separator
 * lines and read on demand by byte range, so files of any size work.
 */

const CHUNK_SIZE = 8 * 1024 * 1024
const TAIL = 8
const SEPARATOR = Buffer.from('\nFrom ')
const SEPARATOR_LINE = /^From \S+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/

export interface MboxScan {
  /** Byte offsets of the "From " separator lines. */
  offsets: number[]
  size: number
}

/** True if the buffer looks like the start of an MBOX file. */
export function looksLikeMbox(start: Buffer): boolean {
  return start.subarray(0, 5).toString('latin1') === 'From '
}

export async function scanMbox(path: string, onProgress?: (done: number, total: number) => void, isCanceled?: () => boolean): Promise<MboxScan> {
  const file = await open(path, 'r')
  try {
    const size = (await file.stat()).size
    const offsets: number[] = []
    const first = Buffer.alloc(5)
    await file.read(first, 0, 5, 0)
    if (first.toString('latin1') === 'From ') offsets.push(0)

    let position = 0
    let tail = Buffer.alloc(0)
    const chunk = Buffer.alloc(CHUNK_SIZE)
    while (position < size) {
      const { bytesRead } = await file.read(chunk, 0, CHUNK_SIZE, position)
      if (bytesRead === 0) break
      const data = Buffer.concat([tail, chunk.subarray(0, bytesRead)])
      const base = position - tail.length
      let index = data.indexOf(SEPARATOR)
      while (index >= 0) {
        // Matches lying completely inside the carried-over tail were handled before.
        if (index + SEPARATOR.length > tail.length && isSeparator(data, index)) offsets.push(base + index + 1)
        index = data.indexOf(SEPARATOR, index + 1)
      }
      tail = Buffer.from(data.subarray(Math.max(0, data.length - TAIL)))
      position += bytesRead
      onProgress?.(position, size)
      if (isCanceled?.()) break
      await new Promise((resolve) => setImmediate(resolve))
    }
    return { offsets, size }
  } finally {
    await file.close()
  }
}

/** A "From " line starts a message if the previous line is empty or it looks like an envelope line. */
function isSeparator(data: Buffer, newline: number): boolean {
  if (newline === 0) return true
  if (data[newline - 1] === 0x0a) return true
  if (data[newline - 1] === 0x0d && newline >= 2 && data[newline - 2] === 0x0a) return true
  const lineEnd = data.indexOf(0x0a, newline + 1)
  const line = data.subarray(newline + 1, lineEnd < 0 ? Math.min(data.length, newline + 200) : lineEnd).toString('latin1')
  return SEPARATOR_LINE.test(line) || /^From - /.test(line)
}

/** Reads one message (without its "From " line) and undoes mboxrd quoting. */
export async function readMboxMessage(file: FileHandle | string, start: number, end: number, limit = Infinity): Promise<Buffer> {
  const handle = typeof file === 'string' ? await open(file, 'r') : file
  try {
    const length = Math.min(end - start, limit)
    const data = Buffer.alloc(length)
    await handle.read(data, 0, length, start)
    const firstLineEnd = data.indexOf(0x0a)
    let message = firstLineEnd >= 0 && data.subarray(0, 5).toString('latin1') === 'From ' ? data.subarray(firstLineEnd + 1) : data
    // Drop the blank line that separates messages.
    let trimmed = message.length
    while (trimmed > 0 && (message[trimmed - 1] === 0x0a || message[trimmed - 1] === 0x0d)) trimmed--
    message = message.subarray(0, trimmed)
    // mboxrd: ">From " lines in the body are stored with one additional ">".
    if (message.indexOf('\n>From ') >= 0 || message.indexOf('\n>>From ') >= 0) {
      message = Buffer.from(message.toString('latin1').replace(/^>(>*From )/gm, '$1'), 'latin1')
    }
    return message
  } finally {
    if (typeof file === 'string') await handle.close()
  }
}
