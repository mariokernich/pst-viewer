/**
 * Text normalisation used for searching and highlighting.
 *
 * "Folding" lower-cases text and strips diacritics so that a search for
 * "muller" also finds "Müller". Both the index and the query are folded with
 * the same function.
 */

const COMBINING_MARKS = /\p{M}/gu
const WHITESPACE = /\s+/g

export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').replace(/ß/g, 'ss')
}

/** Folds text and collapses all whitespace runs to a single space. */
export function foldForIndex(text: string): string {
  return fold(text).replace(WHITESPACE, ' ').trim()
}

export interface FoldedText {
  folded: string
  /** For each code unit in `folded`, the index of the source code unit. */
  map: Int32Array
}

/** Folds text code unit by code unit and keeps a map back to the source. */
export function foldWithMap(text: string): FoldedText {
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // Keep surrogate pairs together.
    const isHighSurrogate = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length
    const ch = isHighSurrogate ? text.slice(i, i + 2) : text[i]
    const f = ch.length === 1 && code < 0x80 ? ch.toLowerCase() : fold(ch)
    for (let j = 0; j < f.length; j++) map.push(i)
    folded += f
    if (isHighSurrogate) i++
  }
  return { folded, map: Int32Array.from(map) }
}

export interface MatchRange {
  start: number
  end: number
}

/**
 * Finds all ranges in `text` that match any of the folded `terms`.
 * Ranges refer to the original (unfolded) text and never overlap.
 */
export function findMatches(text: string, terms: readonly string[]): MatchRange[] {
  if (!text || terms.length === 0) return []
  const { folded, map } = foldWithMap(text)
  const ranges: MatchRange[] = []
  for (const term of terms) {
    if (!term) continue
    let from = 0
    for (;;) {
      const idx = folded.indexOf(term, from)
      if (idx === -1) break
      const start = map[idx]
      const lastSource = map[idx + term.length - 1]
      const end = lastSource + (isHighSurrogateAt(text, lastSource) ? 2 : 1)
      ranges.push({ start, end })
      from = idx + Math.max(term.length, 1)
    }
  }
  return mergeRanges(ranges)
}

function isHighSurrogateAt(text: string, index: number): boolean {
  const code = text.charCodeAt(index)
  return code >= 0xd800 && code <= 0xdbff
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  if (ranges.length <= 1) return ranges
  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: MatchRange[] = [ranges[0]]
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1]
    const cur = ranges[i]
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end)
    else merged.push(cur)
  }
  return merged
}

/**
 * Builds a short excerpt of `text` around the first match of any term.
 * Returns null if no term matches.
 */
export function makeSnippet(text: string, terms: readonly string[], radius = 70): string | null {
  const matches = findMatches(text, terms)
  if (matches.length === 0) return null
  const first = matches[0]
  let start = Math.max(0, first.start - radius)
  let end = Math.min(text.length, first.end + radius * 2)
  // Snap to word boundaries so the excerpt does not start mid-word.
  if (start > 0) {
    const space = text.indexOf(' ', start)
    if (space !== -1 && space < first.start) start = space + 1
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > first.end) end = space
  }
  return (start > 0 ? '… ' : '') + text.slice(start, end).trim() + (end < text.length ? ' …' : '')
}

/** Collapses whitespace for single-line display. */
export function squash(text: string): string {
  return text.replace(WHITESPACE, ' ').trim()
}
