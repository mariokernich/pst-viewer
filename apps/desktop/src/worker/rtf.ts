import * as iconv from 'iconv-lite'
import { deEncapsulateSync } from 'rtf-stream-parser'

export interface RtfBody {
  html: string | null
  text: string
}

/**
 * Turns an (already decompressed) RTF body into HTML or text.
 * Outlook usually stores HTML or plain text encapsulated in RTF; for "real"
 * RTF documents we fall back to a simple text extraction.
 */
export function convertRtf(rtf: string): RtfBody | null {
  if (!rtf || !rtf.startsWith('{\\rtf')) return null
  if (/\\from(html|text)/.test(rtf.slice(0, 2048))) {
    try {
      const result = deEncapsulateSync(rtf, {
        decode: (buf: Buffer, enc: string) => iconv.decode(buf, iconv.encodingExists(enc) ? enc : 'cp1252'),
        mode: 'either',
        htmlFixContentType: true,
        outlookQuirksMode: true,
        warn: () => undefined
      })
      const content = typeof result.text === 'string' ? result.text : result.text.toString('utf8')
      return result.mode === 'html' ? { html: content, text: '' } : { html: null, text: content }
    } catch {
      // fall through to plain extraction
    }
  }
  return { html: null, text: rtfToText(rtf) }
}

const SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore',
  'xmlnstbl',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'header',
  'footer',
  'headerl',
  'headerr',
  'footerl',
  'footerr',
  'filetbl',
  'revtbl',
  'mmathPr',
  'pgdsctbl'
])

/** Minimal RTF to text converter (paragraphs, tabs, hex and unicode escapes). */
export function rtfToText(rtf: string): string {
  let out = ''
  let codepage = 'cp1252'
  const stack: { skip: boolean; uc: number }[] = []
  let skip = false
  let uc = 1
  let pendingSkip = 0
  let bytes: number[] = []

  const flushBytes = (): void => {
    if (bytes.length === 0) return
    if (!skip) out += iconv.decode(Buffer.from(bytes), codepage)
    bytes = []
  }

  let i = 0
  const n = rtf.length
  while (i < n) {
    const ch = rtf[i]
    if (ch === '{') {
      flushBytes()
      stack.push({ skip, uc })
      i++
      continue
    }
    if (ch === '}') {
      flushBytes()
      const prev = stack.pop()
      if (prev) {
        skip = prev.skip
        uc = prev.uc
      }
      i++
      continue
    }
    if (ch === '\\') {
      const next = rtf[i + 1]
      if (next === "'") {
        const hex = rtf.substr(i + 2, 2)
        if (pendingSkip > 0) pendingSkip--
        else bytes.push(parseInt(hex, 16))
        i += 4
        continue
      }
      flushBytes()
      if (next === '\\' || next === '{' || next === '}') {
        if (!skip) out += next
        i += 2
        continue
      }
      if (next === '*') {
        skip = true
        i += 2
        continue
      }
      if (next === '~') {
        if (!skip) out += ' '
        i += 2
        continue
      }
      if (next === '\n' || next === '\r') {
        if (!skip) out += '\n'
        i += 2
        continue
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40))
      if (!m) {
        i += 2
        continue
      }
      const word = m[1]
      const param = m[2] !== undefined ? Number(m[2]) : null
      i += 1 + m[0].length
      if (SKIP_DESTINATIONS.has(word)) skip = true
      else if (word === 'ansicpg' && param !== null) codepage = iconv.encodingExists(`cp${param}`) ? `cp${param}` : codepage
      else if (word === 'uc' && param !== null) uc = param
      else if (word === 'u' && param !== null) {
        if (!skip) out += String.fromCharCode(param < 0 ? param + 65536 : param)
        pendingSkip = uc
      } else if (!skip) {
        if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') out += '\n'
        else if (word === 'tab' || word === 'cell') out += '\t'
        else if (word === 'row') out += '\n'
        else if (word === 'emdash') out += '—'
        else if (word === 'endash') out += '–'
        else if (word === 'bullet') out += '•'
        else if (word === 'lquote') out += '‘'
        else if (word === 'rquote') out += '’'
        else if (word === 'ldblquote') out += '“'
        else if (word === 'rdblquote') out += '”'
      }
      continue
    }
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }
    flushBytes()
    if (pendingSkip > 0) pendingSkip--
    else if (!skip) out += ch
    i++
  }
  flushBytes()
  return out
}
