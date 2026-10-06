import { app } from 'electron'

/**
 * Mac App Store builds run in the App Sandbox: files the user picked are only
 * accessible later through security-scoped bookmarks. Everywhere else these
 * functions do nothing.
 */
export const isSandboxed = process.mas === true

const active = new Map<string, () => void>()

/** Starts accessing a bookmarked file or folder; true if access was started. */
export function startAccess(path: string, bookmark: string | undefined): boolean {
  if (!isSandboxed || !bookmark) return false
  if (active.has(path)) return true
  try {
    const stop = app.startAccessingSecurityScopedResource(bookmark) as () => void
    active.set(path, stop)
    return true
  } catch {
    return false
  }
}

export function stopAccess(path: string | null): void {
  if (!path) return
  const stop = active.get(path)
  active.delete(path)
  stop?.()
}

/** Runs `fn` with temporary access to a bookmarked path. */
export async function withAccess<T>(path: string, bookmark: string | undefined, fn: () => Promise<T>): Promise<T> {
  const started = !active.has(path) && startAccess(path, bookmark)
  try {
    return await fn()
  } finally {
    if (started) stopAccess(path)
  }
}

/** True for errors caused by missing sandbox access. */
export function isAccessError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code
  return code === 'EPERM' || code === 'EACCES'
}
