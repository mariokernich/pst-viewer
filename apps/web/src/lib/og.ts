import type { Locale } from './i18n'

/** Shared settings of the generated Open Graph image (`app/[locale]/og-image.png/route.tsx`). */
export const ogImage = {
  size: { width: 1200, height: 630 },
  alt: 'PST Viewer – PST, MSG, EML & MBOX',
  contentType: 'image/png',
} as const

/** Path of the Open Graph image of a locale (without base path). */
export function ogImagePath(locale: Locale): string {
  return `/${locale}/og-image.png`
}

/** Path of the Apple touch icon (`app/apple-touch-icon.png/route.tsx`, without base path). */
export const appleTouchIconPath = '/apple-touch-icon.png'
