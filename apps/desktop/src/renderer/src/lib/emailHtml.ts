import DOMPurify from 'dompurify'
import { findMatches } from '@shared/text'

/** 1x1 transparent GIF used in place of blocked remote images. */
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const FORBID_TAGS = [
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'option',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'base',
  'link',
  'meta',
  'audio',
  'video',
  'source',
  'track',
  'portal',
  'dialog',
  'script',
  'noscript',
  'template'
]

const FORBID_ATTR = ['srcset', 'ping', 'formaction', 'action', 'autofocus', 'contenteditable', 'srcdoc']

const REMOTE_URL = /^\s*(https?:)?\/\//i
const CSS_REMOTE = /url\(\s*['"]?\s*(https?:)?\/\//i

let hooksInstalled = false

function installHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noreferrer noopener')
      node.removeAttribute('target')
    }
  })
}

export interface SanitizedMail {
  /** Style sheets of the mail, moved out of the document. */
  styles: string[]
  /** Sanitised content of the mail's body. */
  body: string
  /** Serialised attributes of the mail's <body> element. */
  bodyAttributes: string
  /** True if the message references remote resources. */
  hasRemote: boolean
}

/**
 * Sanitises an HTML mail body: no scripts, no forms, no plugins and - unless
 * allowed - no remote images. Inline images (cid:) are replaced by data URLs.
 */
export function sanitizeMail(html: string, inlineImages: Record<string, string>, allowRemote: boolean): SanitizedMail {
  installHooks()
  const withImages = html.replace(/cid:([^"'\s)>]+)/gi, (match, id: string) => {
    let key = id
    try {
      key = decodeURIComponent(id)
    } catch {
      // keep raw id
    }
    return inlineImages[key.replace(/^<|>$/g, '').toLowerCase()] ?? match
  })

  const root = DOMPurify.sanitize(withImages, {
    WHOLE_DOCUMENT: true,
    RETURN_DOM: true,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_TAGS: ['style'],
    ADD_ATTR: ['bgcolor', 'background', 'valign', 'align', 'border', 'cellpadding', 'cellspacing', 'width', 'height', 'color', 'face', 'size']
  }) as HTMLElement

  // Collect styles from anywhere in the document.
  const styles: string[] = []
  root.querySelectorAll('style').forEach((style) => {
    styles.push((style.textContent ?? '').replace(/<\/style/gi, ''))
    style.remove()
  })

  let hasRemote = styles.some((css) => CSS_REMOTE.test(css) || /@import/i.test(css))
  root.querySelectorAll<HTMLElement>('[src], [background], [style], [poster]').forEach((el) => {
    const src = el.getAttribute('src')
    if (src && REMOTE_URL.test(src)) {
      hasRemote = true
      if (!allowRemote) {
        el.setAttribute('data-blocked-src', src)
        el.setAttribute('src', BLANK_IMAGE)
      }
    }
    const background = el.getAttribute('background')
    if (background && REMOTE_URL.test(background)) {
      hasRemote = true
      if (!allowRemote) el.removeAttribute('background')
    }
    const style = el.getAttribute('style')
    if (style && CSS_REMOTE.test(style)) hasRemote = true
  })

  const body = root.querySelector('body')
  return {
    styles,
    body: body ? body.innerHTML : root.innerHTML,
    bodyAttributes: body ? [...body.attributes].map((a) => `${a.name}="${escapeAttribute(a.value)}"`).join(' ') : '',
    hasRemote
  }
}

/** Content Security Policy for documents showing mail content. */
export function mailCsp(allowRemote: boolean): string {
  return [
    "default-src 'none'",
    `img-src data: blob:${allowRemote ? ' https: http:' : ''}`,
    "style-src 'unsafe-inline'",
    'font-src data:',
    "media-src 'none'",
    "script-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'"
  ].join('; ')
}

export interface PreparedHtml {
  /** Complete document for the iframe's srcdoc. */
  doc: string
  /** True if the message references remote resources. */
  hasRemote: boolean
}

/** Sanitises a mail and wraps it in a locked down document for an iframe. */
export function prepareHtml(html: string, inlineImages: Record<string, string>, allowRemote: boolean): PreparedHtml {
  const mail = sanitizeMail(html, inlineImages, allowRemote)
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${mailCsp(allowRemote)}"><meta name="color-scheme" content="light"><style>${BASE_CSS}</style>${mail.styles
    .map((css) => `<style>${css}</style>`)
    .join('')}</head><body ${mail.bodyAttributes}>${mail.body}</body></html>`
  return { doc, hasRemote: mail.hasRemote }
}

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

const BASE_CSS = `
html { overflow-x: auto; overflow-y: hidden; }
body { margin: 0; padding: 22px 26px 28px; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1d1d1f; background: #fff; overflow-wrap: break-word; -webkit-font-smoothing: antialiased; }
img { max-width: 100%; }
img:not([height]) { height: auto; }
pre { white-space: pre-wrap; }
a { color: #0a64d8; }
blockquote[type="cite"] { margin: 0 0 0 0.8ex; border-left: 2px solid #c7c7cc; padding-left: 1ex; color: #48484a; }
mark.pst-hl { background: #ffe168; color: inherit; border-radius: 2px; box-shadow: 0 0 0 1px #ffe168; }
mark.pst-hl.pst-hl-current { background: #ff9f0a; box-shadow: 0 0 0 1px #ff9f0a; }
`

/** Wraps matches of the folded terms in <mark> elements. Returns the marks. */
export function highlightDocument(doc: Document, terms: readonly string[]): HTMLElement[] {
  if (terms.length === 0 || !doc.body) return []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent || parent.closest('style, title, mark')) return NodeFilter.FILTER_REJECT
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  const marks: HTMLElement[] = []
  for (const node of nodes) {
    const text = node.nodeValue ?? ''
    const ranges = findMatches(text, terms)
    if (ranges.length === 0) continue
    const fragment = doc.createDocumentFragment()
    let last = 0
    for (const range of ranges) {
      if (range.start > last) fragment.appendChild(doc.createTextNode(text.slice(last, range.start)))
      const mark = doc.createElement('mark')
      mark.className = 'pst-hl'
      mark.textContent = text.slice(range.start, range.end)
      fragment.appendChild(mark)
      marks.push(mark)
      last = range.end
    }
    if (last < text.length) fragment.appendChild(doc.createTextNode(text.slice(last)))
    node.parentNode?.replaceChild(fragment, node)
  }
  return marks
}
