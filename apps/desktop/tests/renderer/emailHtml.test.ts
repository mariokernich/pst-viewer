// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { highlightDocument, prepareHtml } from '../../src/renderer/src/lib/emailHtml'

function body(doc: string): Document {
  return new DOMParser().parseFromString(doc, 'text/html')
}

describe('prepareHtml', () => {
  it('removes scripts, event handlers, forms and plugins', () => {
    const { doc } = prepareHtml(
      `<p onclick="alert(1)">Hi</p><script>alert(2)</script><form action="https://x"><input name="pw"></form>
       <iframe src="https://evil"></iframe><object data="x"></object><a href="javascript:alert(3)">x</a><img src="x" onerror="alert(4)">`,
      {},
      false
    )
    expect(doc).not.toMatch(/<script/i)
    expect(doc).not.toMatch(/onclick|onerror/i)
    expect(doc).not.toMatch(/<form|<input|<iframe|<object/i)
    expect(doc).not.toMatch(/javascript:/i)
    expect(doc).toContain('Hi')
  })

  it('locks the document down with a CSP', () => {
    const { doc } = prepareHtml('<p>x</p>', {}, false)
    const csp = body(doc).querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''
    expect(csp).toContain("script-src 'none'")
    expect(csp).toContain("default-src 'none'")
    expect(csp).not.toContain('https:')
  })

  it('blocks remote images unless allowed', () => {
    const html = '<img src="https://tracker.example/pixel.gif" width="1" height="1"><div style="background:url(http://x/y.png)">a</div>'
    const blocked = prepareHtml(html, {}, false)
    expect(blocked.hasRemote).toBe(true)
    const img = body(blocked.doc).querySelector('img')!
    expect(img.getAttribute('src')).toMatch(/^data:image\/gif/)
    expect(img.getAttribute('data-blocked-src')).toBe('https://tracker.example/pixel.gif')

    const allowed = prepareHtml(html, {}, true)
    expect(body(allowed.doc).querySelector('img')!.getAttribute('src')).toBe('https://tracker.example/pixel.gif')
    expect(body(allowed.doc).querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain('https:')
  })

  it('resolves inline images by content id', () => {
    const { doc, hasRemote } = prepareHtml('<img src="cid:Image001.PNG@01D">', { 'image001.png@01d': 'data:image/png;base64,AAAA' }, false)
    expect(hasRemote).toBe(false)
    expect(body(doc).querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('keeps styles from the head and body attributes', () => {
    const { doc } = prepareHtml('<html><head><style>p { color: red }</style></head><body bgcolor="#eeeeee"><p>x</p></body></html>', {}, false)
    const parsed = body(doc)
    expect([...parsed.querySelectorAll('style')].some((s) => s.textContent?.includes('color: red'))).toBe(true)
    expect(parsed.body.getAttribute('bgcolor')).toBe('#eeeeee')
  })

  it('neutralises links', () => {
    const { doc } = prepareHtml('<a href="https://example.com" target="_blank">x</a>', {}, false)
    const a = body(doc).querySelector('a')!
    expect(a.getAttribute('target')).toBeNull()
    expect(a.getAttribute('rel')).toBe('noreferrer noopener')
  })
})

describe('highlightDocument', () => {
  it('wraps matches in marks, ignoring case and accents', () => {
    const doc = body('<p>Grüße an <b>Frau Müller</b></p><style>.muller{}</style>')
    const marks = highlightDocument(doc, ['muller', 'grusse'])
    expect(marks.map((m) => m.textContent)).toEqual(['Grüße', 'Müller'])
    expect(doc.querySelector('style')!.textContent).toBe('.muller{}')
  })
})
