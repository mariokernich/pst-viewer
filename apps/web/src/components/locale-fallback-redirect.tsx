'use client'

import { useEffect } from 'react'
import { defaultLocale, isLocale, locales, preferredLocale } from '@/lib/i18n'
import { matchPath } from '@/lib/routes'
import { basePath } from '@/lib/site'

/**
 * On the 404 page: URLs without a language prefix (e.g. `/docs/search/`, as
 * the former server-side redirect accepted them) are forwarded to the
 * matching page in the visitor's language, if such a page exists.
 */
export function LocaleFallbackRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location
    const path = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname
    const first = path.split('/').find(Boolean)
    if (first === undefined || isLocale(first)) return

    const preferred = preferredLocale(navigator.languages ?? [navigator.language], locales, defaultLocale)
    const normalized = path.endsWith('/') ? path : `${path}/`
    for (const locale of [preferred, ...locales.filter((l) => l !== preferred)]) {
      const candidate = `/${locale}${normalized}`
      if (matchPath(candidate)) {
        window.location.replace(`${basePath}${candidate}${search}${hash}`)
        return
      }
    }
  }, [])
  return null
}
