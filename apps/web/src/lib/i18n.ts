/**
 * Locale configuration shared by the pages and the client components.
 * Keep this module free of server-only imports.
 */

export const locales = ['de', 'en'] as const

export type Locale = (typeof locales)[number]

/**
 * Fallback language: used for the root redirect when the browser prefers
 * neither German nor English, for `x-default` alternates and the 404 page.
 */
export const defaultLocale: Locale = 'en'

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
 * Picks the best supported locale from the browser's preferred languages
 * (`navigator.languages`, most preferred first). Region subtags are ignored
 * (`en-GB` → `en`); without a match, `fallback` is returned.
 *
 * The function is self-contained (no references to the module scope) because
 * the root page serializes it into an inline script that redirects before
 * any JavaScript bundle has loaded.
 */
export function preferredLocale<T extends string>(languages: readonly string[], supported: readonly T[], fallback: T): T {
  for (const tag of languages) {
    const language = String(tag).trim().toLowerCase().split('-')[0]
    const match = supported.find((locale) => locale === language)
    if (match) return match
  }
  return fallback
}
