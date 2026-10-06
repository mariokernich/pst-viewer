import { decodeHTML } from 'entities'

const BLOCK_END = /<\/(p|div|tr|li|h[1-6]|table|blockquote|pre|section|article|header|footer|ul|ol|dl|dt|dd)\s*>/gi
const LINE_BREAK = /<(br|hr)\b[^>]*>/gi
const CELL_END = /<\/t[dh]\s*>/gi
const DROP_BLOCKS = /<(head|style|script|title|noscript|template|xml)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const COMMENTS = /<!--[\s\S]*?-->/g
const CONDITIONAL = /<!\[(?:end)?if[^\]]*\]>/gi
const TAGS = /<[^>]+>/g

/**
 * Converts an HTML mail body to readable plain text. Fast and dependency-free
 * (no DOM), good enough for search indexing and previews.
 */
export function htmlToText(html: string): string {
  if (!html) return ''
  const text = html
    .replace(COMMENTS, ' ')
    .replace(CONDITIONAL, ' ')
    .replace(DROP_BLOCKS, ' ')
    .replace(LINE_BREAK, '\n')
    .replace(BLOCK_END, '\n')
    .replace(CELL_END, '\t')
    .replace(TAGS, ' ')
  return tidyText(decodeHTML(text))
}

/** Normalises whitespace while keeping paragraph structure. */
export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[   ​‌‍﻿]/g, (c) => (c === ' ' || c === ' ' || c === ' ' ? ' ' : ''))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CID_REF = /cid:([^"'\s)>]+)/gi

/** Returns the (lower-cased, decoded) content IDs referenced by an HTML body. */
export function referencedContentIds(html: string | null | undefined): Set<string> {
  const ids = new Set<string>()
  if (!html) return ids
  for (const m of html.matchAll(CID_REF)) {
    let id = m[1]
    try {
      id = decodeURIComponent(id)
    } catch {
      // keep the raw value
    }
    ids.add(normalizeContentId(id))
  }
  return ids
}

export function normalizeContentId(id: string): string {
  return id.trim().replace(/^<|>$/g, '').toLowerCase()
}

/** Wraps plain text in minimal HTML (used for text bodies with formatting). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
