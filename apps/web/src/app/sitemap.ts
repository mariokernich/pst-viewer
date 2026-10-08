import type { MetadataRoute } from 'next'
import { locales } from '@/lib/i18n'
import { allRoutes, alternatePaths, pathFor } from '@/lib/routes'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

/** Every page in every language, with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  return allRoutes().flatMap((route) => {
    const languages = Object.fromEntries(
      Object.entries(alternatePaths(route)).map(([language, path]) => [language, `${siteUrl}${path}`]),
    )
    return locales.map((locale) => ({
      url: `${siteUrl}${pathFor(locale, route)}`,
      alternates: { languages },
    }))
  })
}
