import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import PostalMime from 'postal-mime'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, type SearchRequest } from '../src/shared/types'
import { PstService } from '../src/worker/service'

/**
 * Integration tests against a real PST file. Set PST_TEST_FILE to run them,
 * e.g. PST_TEST_FILE=~/Downloads/sample.pst npm test
 */
const file = process.env.PST_TEST_FILE
const run = file && existsSync(file) ? describe : describe.skip

function request(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return {
    text: '',
    folderId: null,
    includeSubfolders: true,
    filters: { ...DEFAULT_FILTERS },
    sort: { field: 'date', dir: 'desc' },
    now: Date.now(),
    firstDayOfWeek: 1,
    pageSize: 50,
    ...overrides
  }
}

run('PstService', () => {
  const service = new PstService()
  let tmp = ''

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'pst-viewer-test-'))
    await service.handle('open', { path: file! })
    await service.whenIndexed()
  })

  afterAll(() => {
    service.close()
    rmSync(tmp, { recursive: true, force: true })
  })

  it('lists folders and items', async () => {
    const opened = await service.handle('open', { path: file! })
    await service.whenIndexed()
    expect(opened.store.itemCount).toBeGreaterThan(0)
    expect(opened.folders.length).toBeGreaterThan(0)
    const all = await service.handle('search', request())
    expect(all.total).toBe(opened.store.itemCount)
    expect(all.items.length).toBe(Math.min(50, all.total))
    // sorted by date, newest first
    for (let i = 1; i < all.items.length; i++) expect(all.items[i - 1].date).toBeGreaterThanOrEqual(all.items[i].date)
    // groups cover all items
    expect(all.groups.reduce((n, g) => n + g.count, 0)).toBe(all.total)
  })

  it('finds items by subject words and pages through results', async () => {
    const all = await service.handle('search', request())
    const sample = all.items.find((i) => i.subject.split(/\s+/).some((w) => w.length > 4))
    expect(sample).toBeDefined()
    const word = sample!.subject.split(/\s+/).find((w) => w.length > 4)!
    const res = await service.handle('search', request({ text: word }))
    expect(res.total).toBeGreaterThan(0)
    expect(res.items.some((i) => i.id === sample!.id)).toBe(true)
    const page = await service.handle('page', { token: res.token, offset: 0, limit: 10 })
    expect(page?.[0].id).toBe(res.items[0].id)
    const stale = await service.handle('page', { token: res.token - 1, offset: 0, limit: 10 })
    expect(stale).toBeNull()
  })

  it('filters by attachments and read state', async () => {
    const withAttachments = await service.handle('search', request({ filters: { ...DEFAULT_FILTERS, hasAttachments: true } }))
    for (const item of withAttachments.items) expect(item.attachmentCount).toBeGreaterThan(0)
    const viaSyntax = await service.handle('search', request({ text: 'hat:anhang' }))
    expect(viaSyntax.total).toBe(withAttachments.total)
    const unread = await service.handle('search', request({ text: 'ist:ungelesen' }))
    for (const item of unread.items) expect(item.isRead).toBe(false)
  })

  it('loads message details and saves attachments', async () => {
    const res = await service.handle('search', request({ filters: { ...DEFAULT_FILTERS, hasAttachments: true }, pageSize: 200 }))
    const item = res.items.find((i) => i.messageClass === 'IPM.Note') ?? res.items[0]
    expect(item).toBeDefined()
    const detail = await service.handle('message', { id: item!.id })
    expect(detail.subject).toBe(item!.subject)
    expect(detail.bodyFormat).not.toBe('none')
    const visible = detail.attachments.filter((a) => !a.isInline)
    expect(visible.length).toBe(item!.attachmentCount)
    const dir = mkdtempSync(join(tmp, 'all-'))
    const saved = await service.handle('saveAttachments', { ref: { id: item!.id }, directory: dir })
    expect(saved.count).toBe(visible.length)
    expect(readdirSync(dir).length).toBe(visible.length)
  })

  it('opens attached messages', async () => {
    const res = await service.handle('search', request({ text: 'hat:anhang', pageSize: 1000 }))
    let opened = 0
    for (const item of res.items) {
      const detail = await service.handle('message', { id: item.id })
      const index = detail.attachments.findIndex((a) => a.isMessage)
      if (index < 0) continue
      const embedded = await service.handle('message', { id: item.id, path: [index] })
      expect(embedded.ref.path).toEqual([index])
      expect(embedded.subject.length + embedded.text.length).toBeGreaterThan(0)
      opened++
    }
    if (opened === 0) console.warn('no attached messages found')
  })

  it('exports messages as .eml that parse back to the same content', async () => {
    const res = await service.handle('search', request({ text: 'hat:anhang', pageSize: 50 }))
    const item = res.items.find((i) => i.kind === 'mail') ?? res.items[0]
    const detail = await service.handle('message', { id: item.id })
    const target = join(tmp, 'export.eml')
    await service.handle('exportEml', { ref: { id: item.id }, targetPath: target })
    const parsed = await PostalMime.parse(readFileSync(target))
    expect(parsed.subject ?? '').toBe(detail.subject)
    expect(parsed.from?.address ?? '').toBe(detail.from.email)
    const visible = detail.attachments.filter((a) => !a.isInline)
    expect(parsed.attachments.filter((a) => a.disposition !== 'inline' || a.mimeType === 'message/rfc822').length).toBeGreaterThanOrEqual(visible.length)
    if (detail.html) expect(parsed.html).toBeTruthy()
  })

  it('saves attached messages as .eml and reads .eml attachments', async () => {
    const res = await service.handle('search', request({ text: 'hat:anhang', pageSize: 500 }))
    for (const item of res.items) {
      const detail = await service.handle('message', { id: item.id })
      const index = detail.attachments.findIndex((a) => a.isMessage)
      if (index < 0) continue
      const info = await service.handle('attachmentInfo', { ref: { id: item.id }, index })
      expect(info.fileName.endsWith('.eml')).toBe(true)
      const target = join(tmp, info.fileName)
      await service.handle('saveAttachment', { ref: { id: item.id }, index, targetPath: target })
      const parsed = await PostalMime.parse(readFileSync(target))
      const embedded = await service.handle('message', { id: item.id, path: [index] })
      expect(parsed.subject ?? '').toBe(embedded.subject)
      return
    }
    console.warn('no attached messages found')
  })

  it('resolves inline images', async () => {
    const res = await service.handle('search', request({ pageSize: 1000 }))
    let found = false
    for (const item of res.items.slice(0, 300)) {
      const detail = await service.handle('message', { id: item.id })
      if (detail.html && /cid:/i.test(detail.html)) {
        expect(Object.keys(detail.inlineImages).length).toBeGreaterThan(0)
        for (const url of Object.values(detail.inlineImages)) expect(url).toMatch(/^data:image\//)
        found = true
        break
      }
    }
    if (!found) console.warn('no message with inline images found')
  })
})
