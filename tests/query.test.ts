import { describe, expect, it } from 'vitest'
import { highlightTerms, isEmptyQuery, parseDateRange, parseQuery, parseSize } from '../src/shared/query'

const now = new Date(2026, 9, 6, 12, 0, 0)

describe('parseQuery', () => {
  it('splits free text into AND terms and folds them', () => {
    const q = parseQuery('Rechnung  Müller', now)
    expect(q.clauses).toEqual([
      { field: null, terms: ['rechnung'], negate: false },
      { field: null, terms: ['muller'], negate: false }
    ])
  })

  it('supports phrases, negation and OR', () => {
    const q = parseQuery('"Angebot 2024" -newsletter angebot OR offer', now)
    expect(q.clauses).toEqual([
      { field: null, terms: ['angebot 2024'], negate: false },
      { field: null, terms: ['newsletter'], negate: true },
      { field: null, terms: ['angebot', 'offer'], negate: false }
    ])
  })

  it('understands German and English field names', () => {
    const q = parseQuery('von:anna an:"Bob Meier" betreff:urlaub anhang:pdf body:x', now)
    expect(q.clauses.map((c) => [c.field, c.terms[0]])).toEqual([
      ['from', 'anna'],
      ['to', 'bob meier'],
      ['subject', 'urlaub'],
      ['attachments', 'pdf'],
      ['body', 'x']
    ])
  })

  it('parses operators', () => {
    const q = parseQuery('hat:anhang ist:ungelesen is:important typ:termin größer:2mb ordner:Archiv', now)
    expect(q.hasAttachments).toBe(true)
    expect(q.readState).toBe('unread')
    expect(q.important).toBe(true)
    expect(q.kinds).toEqual(['appointment'])
    expect(q.minSize).toBe(2 * 1024 * 1024)
    expect(q.folderNames).toEqual(['archiv'])
    expect(q.clauses).toEqual([])
  })

  it('parses date operators', () => {
    const q = parseQuery('nach:1.3.2024 vor:2024-04', now)
    expect(q.dateFrom).toBe(new Date(2024, 2, 1).getTime())
    expect(q.dateTo).toBe(new Date(2024, 3, 1).getTime())
    const q2 = parseQuery('bis:2024-04', now)
    expect(q2.dateTo).toBe(new Date(2024, 4, 1).getTime())
    const q3 = parseQuery('datum:2023', now)
    expect(q3.dateFrom).toBe(new Date(2023, 0, 1).getTime())
    expect(q3.dateTo).toBe(new Date(2024, 0, 1).getTime())
  })

  it('treats unknown prefixes as text', () => {
    const q = parseQuery('Re: Termin 10:30 is:banana', now)
    expect(q.clauses.map((c) => c.terms[0])).toEqual(['re:', 'termin', '10:30', 'is:banana'])
  })

  it('reports empty queries', () => {
    expect(isEmptyQuery(parseQuery('   ', now))).toBe(true)
    expect(isEmptyQuery(parseQuery('hat:anhang', now))).toBe(false)
  })

  it('collects highlight terms, longest first', () => {
    expect(highlightTerms(parseQuery('ab abc -x', now))).toEqual(['abc', 'ab'])
  })
})

describe('parseDateRange', () => {
  it('handles various formats', () => {
    expect(parseDateRange('2024-02-29', now)).toEqual({ start: new Date(2024, 1, 29).getTime(), end: new Date(2024, 2, 1).getTime() })
    expect(parseDateRange('29.02.24', now)?.start).toBe(new Date(2024, 1, 29).getTime())
    expect(parseDateRange('02.2024', now)?.start).toBe(new Date(2024, 1, 1).getTime())
    expect(parseDateRange('heute', now)?.start).toBe(new Date(2026, 9, 6).getTime())
    expect(parseDateRange('2023-02-30', now)).toBeNull()
    expect(parseDateRange('morgen', now)).toBeNull()
  })
})

describe('parseSize', () => {
  it('handles units', () => {
    expect(parseSize('500kb')).toBe(500 * 1024)
    expect(parseSize('1,5 MB')).toBe(Math.round(1.5 * 1024 * 1024))
    expect(parseSize('42')).toBe(42)
    expect(parseSize('abc')).toBeNull()
  })
})

describe('sanitizeFilters', () => {
  it('drops invalid values and keeps valid ones', async () => {
    const { sanitizeFilters, sanitizeSort } = await import('../src/shared/filters')
    const f = sanitizeFilters({ fields: ['subject', 'bogus', 'subject'], datePreset: 'never', dateFrom: '2024-01-01', dateTo: 'x', kinds: ['mail', 1], minSize: -5, hasAttachments: 'yes', from: 42 })
    expect(f.fields).toEqual(['subject'])
    expect(f.datePreset).toBe('any')
    expect(f.dateFrom).toBe('2024-01-01')
    expect(f.dateTo).toBeNull()
    expect(f.kinds).toEqual(['mail'])
    expect(f.minSize).toBeNull()
    expect(f.hasAttachments).toBe(false)
    expect(f.from).toBe('')
    expect(sanitizeSort({ field: 'size', dir: 'asc' })).toEqual({ field: 'size', dir: 'asc' })
    expect(sanitizeSort(null)).toEqual({ field: 'date', dir: 'desc' })
  })
})
