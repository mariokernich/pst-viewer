import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AppIcon } from '@/components/brand/app-icon'
import { LocaleFallbackRedirect } from '@/components/locale-fallback-redirect'
import { NotFoundContent } from '@/components/not-found-content'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { defaultLocale, locales, type Locale } from '@/lib/i18n'
import { pathFor } from '@/lib/routes'
import { siteIcons } from '@/lib/metadata'
import { siteConfig } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  title: `Page not found · Seite nicht gefunden – ${siteConfig.name}`,
  robots: { index: false },
  icons: siteIcons,
}

/** Default locale first, then the others. */
const ordered: Locale[] = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)]

/**
 * Bilingual 404 page for every unmatched URL (exported as `404.html`, which
 * GitHub Pages serves for unknown paths). It renders its own document because
 * the regular <html> lives in the locale layout.
 */
export default function NotFound() {
  return (
    <html lang={defaultLocale} className={GeistSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <LocaleFallbackRedirect />
        <ThemeProvider>
          <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(61_139_255/0.16),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgb(90_61_255/0.22),transparent_70%)]"
            />
            <Link href={pathFor(defaultLocale, { page: 'home' })} className="mb-12 inline-flex items-center gap-2.5 rounded-lg">
              <AppIcon size={36} />
              <span className="text-lg font-semibold tracking-tight">PST Viewer</span>
            </Link>
            <main className="grid w-full max-w-4xl gap-12 md:grid-cols-2 md:gap-8">
              {ordered.map((locale, index) => (
                <NotFoundContent key={locale} locale={locale} headingLevel={index === 0 ? 1 : 2} />
              ))}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
