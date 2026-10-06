import { describe, expect, it } from 'vitest'
import { fileExtension, isUnsafeToOpen, sanitizeFileName } from '../src/shared/files'

describe('sanitizeFileName', () => {
  it('removes characters that are invalid on common file systems', () => {
    expect(sanitizeFileName('Re: Angebot <final>?.pdf')).toBe('Re_ Angebot _final__.pdf')
    expect(sanitizeFileName('../../etc/passwd')).toBe('_.._etc_passwd')
    expect(sanitizeFileName('  .hidden  ')).toBe('hidden')
    expect(sanitizeFileName('CON.txt')).toBe('attachment-CON.txt')
    expect(sanitizeFileName('', 'message')).toBe('message')
  })
})

describe('isUnsafeToOpen', () => {
  it('blocks executables, scripts and active documents', () => {
    for (const name of ['setup.exe', 'run.command', 'evil.app', 'x.js', 'script.ps1', 'disk.dmg', 'page.html', 'image.svg', 'Invoice.PDF.exe']) {
      expect(isUnsafeToOpen(name, 'application/octet-stream')).toBe(true)
    }
    expect(isUnsafeToOpen('noext', 'application/x-msdownload')).toBe(true)
  })

  it('allows documents and media', () => {
    for (const name of ['report.pdf', 'budget.xlsx', 'photo.jpg', 'notes.txt', 'invite.ics', 'archive.zip', 'macro.docm']) {
      expect(isUnsafeToOpen(name, 'application/octet-stream')).toBe(false)
    }
  })

  it('reads extensions', () => {
    expect(fileExtension('a.tar.GZ')).toBe('gz')
    expect(fileExtension('README')).toBe('')
  })
})
