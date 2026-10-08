import { GeistSans } from 'geist/font/sans'
import { ArrowRight } from 'lucide-react'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { AppIcon } from '@/components/brand/app-icon'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { common } from '@/content/common'
import { defaultLocale, locales, localeNames, ogLocales, type Locale } from '@/lib/i18n'
import { siteIcons } from '@/lib/metadata'
import { ogImage, ogImagePath } from '@/lib/og'
import { rootRedirectScript } from '@/lib/root-redirect'
import { alternatePaths, pathFor } from '@/lib/routes'
import { absoluteUrl, siteConfig } from '@/lib/site'
import './globals.css'

const t = common[defaultLocale]

/**
 * Root page (`/`). A static host cannot negotiate the language per request,
 * so this page redirects in the browser (inline script, `navigator.languages`,
 * English as fallback). Without JavaScript – or while redirecting takes
 * long – it shows a language chooser. hreflang links point search engines to
 * both language versions; this page itself is the `x-default`.
 */
export const metadata: Metadata = {
  title: { absolute: t.meta.defaultTitle },
  description: t.meta.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.owner }],
  icons: siteIcons,
  alternates: {
    canonical: absoluteUrl('/'),
    languages: Object.fromEntries(Object.entries(alternatePaths({ page: 'home' })).map(([lang, path]) => [lang, absoluteUrl(path)])),
  },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: t.meta.defaultTitle,
    description: t.meta.description,
    url: absoluteUrl('/'),
    locale: ogLocales[defaultLocale],
    images: [{ url: absoluteUrl(ogImagePath(defaultLocale)), ...ogImage.size, alt: ogImage.alt, type: ogImage.contentType }],
  },
  twitter: { card: 'summary_large_image', title: t.meta.defaultTitle, description: t.meta.description },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
}

/** Default locale first, then the others. */
const ordered: Locale[] = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)]

export default function RootPage() {
  return (
    <html lang={defaultLocale} className={GeistSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: rootRedirectScript() }} />
        <ThemeProvider>
          <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(61_139_255/0.16),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgb(90_61_255/0.22),transparent_70%)]"
            />
            <div className="mb-10 inline-flex items-center gap-2.5">
              <AppIcon size={40} />
              <span className="text-xl font-semibold tracking-tight">{siteConfig.name}</span>
            </div>
            <main className="w-full max-w-2xl">
              <h1 className="sr-only">{`${siteConfig.name} – ${ordered.map((locale) => localeNames[locale]).join(' / ')}`}</h1>
              <ul className="grid gap-4 sm:grid-cols-2">
                {ordered.map((locale) => {
                  const c = common[locale].root
                  return (
                    <li key={locale} lang={locale}>
                      <Link
                        href={pathFor(locale, { page: 'home' })}
                        hrefLang={locale}
                        className="group flex h-full flex-col rounded-3xl border border-line bg-card p-6 shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-accent/40 hover:shadow-window"
                      >
                        <span className="text-sm font-semibold text-accent">{localeNames[locale]}</span>
                        <span className="mt-2 text-lg font-semibold tracking-tight text-foreground">{c.title}</span>
                        <span className="mt-1 text-[15px] leading-relaxed text-muted">{c.text}</span>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:text-accent">
                          {c.action}
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
