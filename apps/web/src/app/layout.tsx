import type { ReactNode } from 'react'

/**
 * The document (<html>/<body>) is rendered by `app/[locale]/layout.tsx` so it
 * can carry the correct `lang` attribute. This root layout only exists so the
 * root `not-found.tsx` can handle unmatched URLs; it passes children through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
