import type { Locale } from './i18n'

/** Shared settings of the generated Open Graph image (`app/[locale]/opengraph-image.tsx`). */
export const ogImage = {
  size: { width: 1200, height: 630 },
  alt: 'PST Viewer – PST, MSG, EML & MBOX',
  contentType: 'image/png',
} as const

/** Path of the Open Graph image of a locale. */
export function ogImagePath(locale: Locale): string {
  return `/${locale}/opengraph-image`
}
