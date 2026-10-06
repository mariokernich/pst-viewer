'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * `false` during server rendering and hydration, `true` afterwards. Use it to
 * render client-only state (like the stored theme) without hydration errors.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
