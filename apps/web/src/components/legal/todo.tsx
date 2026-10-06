import type { ReactNode } from 'react'

/**
 * Visible placeholder for information that still has to be filled in
 * (legal pages). Search the code base for `<Todo>` before going live.
 */
export function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-md bg-amber-200/70 px-1.5 py-0.5 font-medium text-amber-950 dark:bg-amber-400/20 dark:text-amber-100">
      TODO: {children}
    </mark>
  )
}
