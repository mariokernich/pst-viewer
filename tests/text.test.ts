import { describe, expect, it } from 'vitest'
import { findMatches, fold, makeSnippet } from '../src/shared/text'
import { htmlToText, referencedContentIds } from '../src/worker/html'
import { rtfToText } from '../src/worker/rtf'

describe('fold', () => {
  it('lower-cases and strips diacritics', () => {
    expect(fold('Müller Straße ÉTÉ')).toBe('muller strasse ete')
  })
})

describe('findMatches', () => {
  it('maps folded matches back to the original text', () => {
    const text = 'Grüße an Frau MÜLLER'
    const ranges = findMatches(text, ['muller', 'grusse'])
    expect(ranges.map((r) => text.slice(r.start, r.end))).toEqual(['Grüße', 'MÜLLER'])
  })

  it('merges overlapping matches', () => {
    expect(findMatches('abcdef', ['abc', 'bcd'])).toEqual([{ start: 0, end: 4 }])
  })
})

describe('makeSnippet', () => {
  it('cuts around the first match', () => {
    const text = `${'lorem '.repeat(40)}Die Rechnung ist beigefügt ${'ipsum '.repeat(40)}`
    const snippet = makeSnippet(text, ['rechnung'], 20)!
    expect(snippet.startsWith('… ')).toBe(true)
    expect(snippet).toContain('Rechnung ist beigefügt')
  })
})

describe('htmlToText', () => {
  it('drops styles and scripts and keeps structure', () => {
    const html = '<html><head><style>p{color:red}</style></head><body><p>Hallo&nbsp;Welt</p><script>x()</script><div>Zeile&nbsp;2<br>Zeile 3</div><!-- c --></body></html>'
    expect(htmlToText(html)).toBe('Hallo Welt\nZeile 2\nZeile 3')
  })
})

describe('referencedContentIds', () => {
  it('finds cid references', () => {
    const ids = referencedContentIds('<img src="cid:Image001.png@01D">x<img src=\'cid:a%40b\'>')
    expect([...ids]).toEqual(['image001.png@01d', 'a@b'])
  })
})

describe('rtfToText', () => {
  it('extracts plain text', () => {
    const rtf = "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0 Arial;}}\\f0 Gr\\'fc\\'dfe\\par Zweite \\u8364? Zeile}"
    expect(rtfToText(rtf)).toBe('Grüße\nZweite € Zeile')
  })
})
