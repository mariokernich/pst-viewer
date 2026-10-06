/**
 * Locale configuration shared by the proxy, the pages and the client
 * components. Keep this module free of server-only imports.
 */

export const locales = ['de', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'de'

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}

/** Name of each language in its own language (for the language switcher). */
export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
}

/** Open Graph locale identifiers. */
export const ogLocales: Record<Locale, string> = {
  de: 'de_DE',
  en: 'en_US',
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 * Entries are ranked by their quality value (ties keep the header order);
 * region subtags are ignored (`en-GB` → `en`).
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale

  const ranked = acceptLanguage
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.trim().split(';')
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index }
    })
    .filter((entry) => entry.tag !== '' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)

  for (const { tag } of ranked) {
    if (tag === '*') return defaultLocale
    const language = tag.split('-')[0]
    if (isLocale(language)) return language
  }
  return defaultLocale
}
