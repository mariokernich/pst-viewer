import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/** Inherited by every page. Google Search Console checks the tag on the start page. */
export const metadata: Metadata = {
  verification: { google: 'TPMl1y2lpx-LKDl1I18Iox7zJK8U4GE3u33SkT9W4k4' },
}

/**
 * The document (<html>/<body>) is rendered by `app/[locale]/layout.tsx` so it
 * can carry the correct `lang` attribute. This root layout only exists so the
 * root `not-found.tsx` can handle unmatched URLs; it passes children through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
