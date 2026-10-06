import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import PostalMime from 'postal-mime'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, type FolderNode, type SearchRequest } from '../src/shared/types'
import { PstService } from '../src/worker/service'
import { buildEml, buildEmlx, buildMbox, buildMsg } from './fixtures/builders'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

function request(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return {
    text: '',
    folderId: null,
    includeSubfolders: true,
    filters: { ...DEFAULT_FILTERS },
    sort: { field: 'date', dir: 'desc' },
    now: Date.now(),
    firstDayOfWeek: 1,
    pageSize: 100,
    ...overrides
  }
}

function flatten(folders: FolderNode[], depth = 0): string[] {
  return folders.flatMap((f) => [`${'  '.repeat(depth)}${f.name}${f.special ? ` [${f.special}]` : ''} (${f.itemCount})`, ...flatten(f.children, depth + 1)])
}

let dir = ''
let invoiceEml: Buffer

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'pst-viewer-local-'))
  invoiceEml = await buildEml({
    from: 'Anna Müller <anna@example.com>',
    to: 'Bob <bob@example.com>',
    subject: 'Rechnung März',
    html: '<p>Hallo Bob, anbei die Rechnung.</p><img src="cid:logo@example">',
    attachments: [
      { filename: 'rechnung.pdf', content: Buffer.from('%PDF-1.4 test'), contentType: 'application/pdf' },
      { filename: 'logo.png', content: PNG, contentType: 'image/png', cid: 'logo@example' }
    ]
  })
  writeFileSync(join(dir, 'invoice.eml'), invoiceEml)

  const takeout = buildMbox([
    await buildEml({
      from: 'Anna Müller <anna@example.com>',
      to: 'me@example.com',
      subject: '=?UTF-8?Q?Gr=C3=BC=C3=9Fe_aus_W=C3=BCrzburg?=',
      text: 'From the start this line was escaped.\nViele Grüße',
      headers: { 'X-Gmail-Labels': 'Posteingang,Geöffnet' }
    }),
    await buildEml({
      from: 'Me <me@example.com>',
      to: 'Carl <carl@example.com>',
      subject: 'Angebot',
      text: 'Das Angebot im Anhang.',
      headers: { 'X-Gmail-Labels': 'Gesendet' },
      date: new Date('2025-02-01T10:00:00Z')
    }),
    await buildEml({
      from: 'Dora <dora@example.com>',
      to: 'me@example.com',
      subject: 'Projektplan',
      text: 'Der Projektplan für Alpha.',
      headers: { 'X-Gmail-Labels': 'Projekte/Alpha,Posteingang,Ungelesen,Markiert' },
      date: new Date('2025-01-01T10:00:00Z')
    })
  ])
  writeFileSync(join(dir, 'takeout.mbox'), takeout)

  const thunderbird = buildMbox(
    [
      await buildEml({ from: 'eve@example.com', to: 'me@example.com', subject: 'Gelesen', text: 'a', headers: { 'X-Mozilla-Status': '0001' } }),
      await buildEml({ from: 'eve@example.com', to: 'me@example.com', subject: 'Neu', text: 'b', headers: { 'X-Mozilla-Status': '0000' } })
    ],
    true
  )
  writeFileSync(join(dir, 'Inbox'), thunderbird)

  writeFileSync(
    join(dir, 'memo.msg'),
    buildMsg({
      subject: 'Protokoll Besprechung',
      senderName: 'Frank Fischer',
      senderEmail: 'frank@example.com',
      to: [{ name: 'Gina', email: 'gina@example.com' }],
      body: 'Ergebnisse der Besprechung vom Montag.',
      html: '<p>Ergebnisse der <b>Besprechung</b> vom Montag.</p>',
      date: new Date('2025-04-07T08:30:00Z'),
      attachments: [{ filename: 'notizen.txt', content: Buffer.from('Notizen'), mimeType: 'text/plain' }]
    })
  )

  // A folder with sub folders and an Apple Mail export bundle.
  const tree = join(dir, 'mails')
  mkdirSync(join(tree, 'Projekte'), { recursive: true })
  mkdirSync(join(tree, 'Export', 'Sent.mbox'), { recursive: true })
  writeFileSync(join(tree, 'a.eml'), invoiceEml)
  writeFileSync(join(tree, 'Projekte', 'b.eml'), await buildEml({ from: 'x@example.com', to: 'y@example.com', subject: 'B', text: 'b' }))
  writeFileSync(join(tree, 'Export', 'Sent.mbox', 'mbox'), takeout)
  writeFileSync(join(tree, 'Export', 'Sent.mbox', 'table_of_contents'), Buffer.from([1, 2, 3]))
  writeFileSync(join(tree, 'notes.txt'), 'not a mail')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('EML files', () => {
  it('opens a single message with attachments and inline images', async () => {
    const service = new PstService()
    const opened = await service.handle('open', { path: join(dir, 'invoice.eml') })
    await service.whenIndexed()
    expect(opened.store.format).toBe('eml')
    expect(opened.store.itemCount).toBe(1)
    expect(flatten(opened.folders)).toEqual(['invoice (1)'])

    const result = await service.handle('search', request())
    const item = result.items[0]
    expect(item.subject).toBe('Rechnung März')
    expect(item.fromName).toBe('Anna Müller')
    expect(item.attachmentCount).toBe(1)

    const detail = await service.handle('message', { id: item.id })
    expect(detail.html).toContain('anbei die Rechnung')
    expect(Object.keys(detail.inlineImages)).toEqual(['logo@example'])
    expect(detail.attachments.filter((a) => !a.isInline).map((a) => a.name)).toEqual(['rechnung.pdf'])

    // .eml exports keep the original message unchanged.
    const target = join(dir, 'export.eml')
    await service.handle('exportEml', { ref: { id: item.id }, targetPath: target })
    expect(readFileSync(target).equals(invoiceEml)).toBe(true)
    service.close()
  })
})

describe('MBOX files', () => {
  it('turns Google Takeout labels into folders and flags', async () => {
    const service = new PstService()
    const opened = await service.handle('open', { path: join(dir, 'takeout.mbox') })
    await service.whenIndexed()
    expect(opened.store.format).toBe('mbox')
    expect(opened.store.itemCount).toBe(3)
    expect(flatten(opened.folders)).toEqual(['Posteingang [inbox] (2)', 'Gesendet [sent] (1)', 'Projekte (0)', '  Alpha (1)'])

    const inbox = opened.folders.find((f) => f.special === 'inbox')!
    const inInbox = await service.handle('search', request({ folderId: inbox.id, includeSubfolders: false }))
    expect(inInbox.total).toBe(2)

    const all = await service.handle('search', request())
    const greeting = all.items.find((i) => i.subject.startsWith('Grüße'))!
    expect(greeting.subject).toBe('Grüße aus Würzburg')
    expect(greeting.isRead).toBe(true)
    const plan = all.items.find((i) => i.subject === 'Projektplan')!
    expect(plan.isRead).toBe(false)
    expect(plan.flagged).toBe(true)

    // mboxrd quoting is undone and bodies are searchable once indexed.
    const detail = await service.handle('message', { id: greeting.id })
    expect(detail.text).toContain('From the start this line was escaped.')
    const found = await service.handle('search', request({ text: 'inhalt:projektplan alpha' }))
    expect(found.items.map((i) => i.subject)).toEqual(['Projektplan'])
    const byLabel = await service.handle('search', request({ text: 'ordner:alpha' }))
    expect(byLabel.total).toBe(1)
    service.close()
  })

  it('reads Thunderbird read state and CRLF files without extension', async () => {
    const service = new PstService()
    const opened = await service.handle('open', { path: join(dir, 'Inbox') })
    expect(opened.store.format).toBe('mbox')
    const all = await service.handle('search', request({ sort: { field: 'subject', dir: 'asc' } }))
    expect(all.items.map((i) => [i.subject, i.isRead])).toEqual([
      ['Gelesen', true],
      ['Neu', false]
    ])
    service.close()
  })
})

describe('MSG files', () => {
  it('opens an Outlook item with recipients, HTML body and attachments', async () => {
    const service = new PstService()
    const opened = await service.handle('open', { path: join(dir, 'memo.msg') })
    await service.whenIndexed()
    expect(opened.store.format).toBe('msg')
    const result = await service.handle('search', request())
    const item = result.items[0]
    expect(item.subject).toBe('Protokoll Besprechung')
    expect(item.fromName).toBe('Frank Fischer')
    expect(item.fromEmail).toBe('frank@example.com')
    expect(item.preview).toContain('Ergebnisse der Besprechung')

    const detail = await service.handle('message', { id: item.id })
    expect(detail.recipients).toEqual([{ name: 'Gina', email: 'gina@example.com', type: 'to' }])
    expect(detail.html).toContain('<b>Besprechung</b>')
    expect(detail.attachments.map((a) => a.name)).toEqual(['notizen.txt'])

    const target = join(dir, 'memo.eml')
    await service.handle('exportEml', { ref: { id: item.id }, targetPath: target })
    const parsed = await PostalMime.parse(readFileSync(target))
    expect(parsed.subject).toBe('Protokoll Besprechung')
    expect(parsed.from?.address).toBe('frank@example.com')
    expect(parsed.attachments.map((a) => a.filename)).toEqual(['notizen.txt'])

    const saved = join(dir, 'notizen-copy.txt')
    await service.handle('saveAttachment', { ref: { id: item.id }, index: 0, targetPath: saved })
    expect(readFileSync(saved, 'utf8')).toBe('Notizen')
    service.close()
  })
})

describe('Folders of mail files', () => {
  it('mirrors the directory tree and includes Apple Mail exports', async () => {
    const service = new PstService()
    const opened = await service.handle('open', { path: join(dir, 'mails') })
    await service.whenIndexed()
    expect(opened.store.format).toBe('folder')
    expect(opened.store.itemCount).toBe(5)
    expect(flatten(opened.folders)).toEqual([
      'mails (1)',
      '  Export (0)',
      '    Posteingang [inbox] (2)',
      '    Gesendet [sent] (1)',
      '    Projekte (0)',
      '      Alpha (1)',
      '  Projekte (1)'
    ])
    service.close()
  })

  it('reads Apple Mail mailboxes with .emlx files', async () => {
    const root = join(dir, 'AppleMail')
    const inbox = join(root, 'INBOX.mbox', '1A2B', 'Data', '0', 'Messages')
    const projects = join(root, 'INBOX.mbox', 'Projekte.mbox', '3C4D', 'Data', 'Messages')
    mkdirSync(inbox, { recursive: true })
    mkdirSync(projects, { recursive: true })
    writeFileSync(join(root, 'INBOX.mbox', 'Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict/></plist>')
    const important = await buildEml({ from: 'Hans <hans@example.com>', to: 'me@example.com', subject: 'Wichtig', text: 'Bitte ansehen.' })
    writeFileSync(join(inbox, '1.emlx'), buildEmlx(important, 0x10)) // unread, flagged
    writeFileSync(join(projects, '2.partial.emlx'), buildEmlx(await buildEml({ from: 'ida@example.com', to: 'me@example.com', subject: 'Plan', text: 'p' }), 0x01)) // read

    const service = new PstService()
    const opened = await service.handle('open', { path: root })
    await service.whenIndexed()
    expect(flatten(opened.folders)).toEqual(['AppleMail (0)', '  INBOX [inbox] (1)', '    Projekte (1)'])

    const all = await service.handle('search', request({ sort: { field: 'subject', dir: 'asc' } }))
    expect(all.items.map((i) => [i.subject, i.isRead, i.flagged])).toEqual([
      ['Plan', true, false],
      ['Wichtig', false, true]
    ])
    const detail = await service.handle('message', { id: all.items[1].id })
    expect(detail.text).toContain('Bitte ansehen.')
    expect(detail.text).not.toContain('plist')

    // The .eml export is the message without the Apple Mail wrapper.
    const target = join(dir, 'wichtig.eml')
    await service.handle('exportEml', { ref: { id: all.items[1].id }, targetPath: target })
    expect(readFileSync(target).equals(important)).toBe(true)
    service.close()
  })

  it('rejects unsupported files', async () => {
    const service = new PstService()
    await expect(service.handle('open', { path: join(dir, 'mails', 'notes.txt') })).rejects.toMatchObject({ code: 'NOT_PST' })
  })
})
