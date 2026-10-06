import { defaultLocale, isLocale, locales, type Locale } from './i18n'

/**
 * Central route registry. Every page exists in both languages, partly under
 * localized slugs (e.g. `/de/impressum` ↔ `/en/legal-notice`). All links,
 * canonical/hreflang URLs, the sitemap and the language switcher are derived
 * from here, so a slug only has to be changed in one place.
 *
 * This module is imported by client components (language switcher), so it
 * must only contain the slugs – no page content.
 */

export const docIds = [
  'getting-started',
  'navigation',
  'search',
  'attachments',
  'export',
  'privacy',
  'mobile',
  'troubleshooting',
] as const

export type DocId = (typeof docIds)[number]

export const docSlugs: Record<DocId, Record<Locale, string>> = {
  'getting-started': { de: 'erste-schritte', en: 'getting-started' },
  navigation: { de: 'navigation', en: 'navigation' },
  search: { de: 'suche', en: 'search' },
  attachments: { de: 'anhaenge', en: 'attachments' },
  export: { de: 'export-und-drucken', en: 'export-and-print' },
  privacy: { de: 'datenschutz-und-sicherheit', en: 'privacy-and-security' },
  mobile: { de: 'mobile-apps', en: 'mobile-apps' },
  troubleshooting: { de: 'fehlerbehebung', en: 'troubleshooting' },
}

export const legalIds = ['legalNotice', 'privacy'] as const

export type LegalId = (typeof legalIds)[number]

export const legalSlugs: Record<LegalId, Record<Locale, string>> = {
  legalNotice: { de: 'impressum', en: 'legal-notice' },
  privacy: { de: 'datenschutz', en: 'privacy' },
}

/** Anchors of the landing page sections (identical in both languages). */
export const sectionIds = {
  features: 'features',
  search: 'search',
  privacy: 'privacy',
  platforms: 'platforms',
  useCases: 'use-cases',
  pricing: 'pricing',
  faq: 'faq',
} as const

export type SectionId = keyof typeof sectionIds

export type Route =
  | { page: 'home' }
  | { page: 'docs' }
  | { page: 'doc'; id: DocId }
  | { page: 'legal'; id: LegalId }

/** Absolute path (without origin) of a route in the given locale. */
export function pathFor(locale: Locale, route: Route): string {
  switch (route.page) {
    case 'home':
      return `/${locale}`
    case 'docs':
      return `/${locale}/docs`
    case 'doc':
      return `/${locale}/docs/${docSlugs[route.id][locale]}`
    case 'legal':
      return `/${locale}/${legalSlugs[route.id][locale]}`
  }
}

/** Link to a section of the landing page. */
export function sectionPath(locale: Locale, section: SectionId): string {
  return `${pathFor(locale, { page: 'home' })}#${sectionIds[section]}`
}

/** Paths of a route in every locale, plus `x-default` (the default locale). */
export function alternatePaths(route: Route): Record<Locale | 'x-default', string> {
  const entries = locales.map((locale) => [locale, pathFor(locale, route)] as const)
  return { ...Object.fromEntries(entries), 'x-default': pathFor(defaultLocale, route) } as Record<
    Locale | 'x-default',
    string
  >
}

export function docIdFromSlug(locale: Locale, slug: string): DocId | undefined {
  return docIds.find((id) => docSlugs[id][locale] === slug)
}

export function legalIdFromSlug(locale: Locale, slug: string): LegalId | undefined {
  return legalIds.find((id) => legalSlugs[id][locale] === slug)
}

/** Resolves a pathname like `/de/docs/suche` to its locale and route. */
export function matchPath(pathname: string): { locale: Locale; route: Route } | null {
  const [first, ...rest] = pathname.split('/').filter(Boolean)
  if (!isLocale(first)) return null
  const locale = first

  if (rest.length === 0) return { locale, route: { page: 'home' } }

  if (rest[0] === 'docs') {
    if (rest.length === 1) return { locale, route: { page: 'docs' } }
    const id = rest.length === 2 ? docIdFromSlug(locale, rest[1] ?? '') : undefined
    return id ? { locale, route: { page: 'doc', id } } : null
  }

  if (rest.length === 1) {
    const id = legalIdFromSlug(locale, rest[0] ?? '')
    if (id) return { locale, route: { page: 'legal', id } }
  }
  return null
}

/**
 * The same page in another language. Falls back to the home page of the
 * target locale for unknown paths.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const match = matchPath(pathname)
  return pathFor(target, match?.route ?? { page: 'home' })
}

/** Every route of the site (used for the sitemap). */
export function allRoutes(): Route[] {
  return [
    { page: 'home' },
    { page: 'docs' },
    ...docIds.map((id): Route => ({ page: 'doc', id })),
    ...legalIds.map((id): Route => ({ page: 'legal', id })),
  ]
}
