import { NextResponse, type NextRequest } from 'next/server'
import { locales, negotiateLocale } from '@/lib/i18n'

/**
 * Redirects URLs without a locale prefix (e.g. `/` or `/docs`) to the best
 * matching language from the `Accept-Language` header. All pages themselves
 * are prerendered; this is the only code that runs per request. No cookies
 * are set.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
  if (hasLocale) return NextResponse.next()

  const locale = negotiateLocale(request.headers.get('accept-language'))
  const url = request.nextUrl.clone()
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
  url.search = search

  const response = NextResponse.redirect(url, 307)
  response.headers.set('Vary', 'Accept-Language')
  return response
}

export const config = {
  // Skip Next.js internals, metadata routes and every path with a file extension.
  matcher: ['/((?!_next/|api/|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|manifest|.*\\..*).*)'],
}
