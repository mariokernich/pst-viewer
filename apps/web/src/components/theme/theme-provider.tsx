'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * next-themes renders an inline script that applies the stored theme before
 * the first paint (no flash). The script only has to run in the server HTML;
 * on the client it is marked as `text/plain` so React does not warn about
 * rendering a script tag (pattern from the Next.js "Preventing Flash" guide).
 * The preference is stored in localStorage under `theme` – no cookies.
 */
const scriptProps = { type: typeof window === 'undefined' ? 'text/javascript' : 'text/plain' }

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
    >
      {children}
    </NextThemesProvider>
  )
}
