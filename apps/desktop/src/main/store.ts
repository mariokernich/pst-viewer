import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { LanguageSetting, RecentFile, ThemeSource } from '../shared/types'

/**
 * Small JSON backed persistence for app settings and the recent files list.
 * Only paths and metadata are stored - never any mail content.
 */
interface Settings {
  windowBounds?: { x?: number; y?: number; width: number; height: number; maximized?: boolean }
  themeSource?: ThemeSource
  language?: LanguageSetting
  recentFiles?: Omit<RecentFile, 'exists' | 'isFolder'>[]
}

const MAX_RECENT = 12

class JsonStore {
  private data: Settings
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly file: string) {
    try {
      this.data = JSON.parse(readFileSync(file, 'utf8')) as Settings
    } catch {
      this.data = {}
    }
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.data[key]
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data[key] = value
    const snapshot = JSON.stringify(this.data, null, 2)
    // Serialise writes and replace the file atomically.
    this.writing = this.writing
      .then(async () => {
        const tmp = `${this.file}.tmp`
        await writeFile(tmp, snapshot, 'utf8')
        await rename(tmp, this.file)
      })
      .catch(() => undefined)
  }
}

let instance: JsonStore | null = null

export function settings(): JsonStore {
  if (!instance) instance = new JsonStore(join(app.getPath('userData'), 'settings.json'))
  return instance
}

export async function listRecentFiles(): Promise<RecentFile[]> {
  const entries = settings().get('recentFiles') ?? []
  return Promise.all(
    entries.map(async (entry) => {
      try {
        const s = await stat(entry.path)
        return { ...entry, size: s.isFile() ? s.size : entry.size, exists: s.isFile() || s.isDirectory(), isFolder: s.isDirectory() }
      } catch {
        return { ...entry, exists: false, isFolder: false }
      }
    })
  )
}

export function addRecentFile(path: string, size: number, itemCount: number | null): void {
  const entries = (settings().get('recentFiles') ?? []).filter((e) => e.path !== path)
  entries.unshift({ path, name: basename(path), size, itemCount, lastOpened: Date.now() })
  settings().set('recentFiles', entries.slice(0, MAX_RECENT))
  if (process.platform !== 'linux') app.addRecentDocument(path)
}

export function removeRecentFile(path: string): void {
  settings().set(
    'recentFiles',
    (settings().get('recentFiles') ?? []).filter((e) => e.path !== path)
  )
}

export function clearRecentFiles(): void {
  settings().set('recentFiles', [])
  if (process.platform !== 'linux') app.clearRecentDocuments()
}
