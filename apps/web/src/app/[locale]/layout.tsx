import { GeistSans } from 'geist/font/sans'
import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { common } from '@/content/common'
import { isLocale, locales } from '@/lib/i18n'
import { siteConfig, siteUrl } from '@/lib/site'
import '../globals.css'

export const dynamicParams = false

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = common[locale]
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.meta.defaultTitle, template: `%s · ${siteConfig.name}` },
    description: t.meta.description,
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.owner }],
    creator: siteConfig.owner,
    formatDetection: { telephone: false, email: false, address: false },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = common[locale]

  return (
    <html lang={locale} className={GeistSans.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider>
          <a
            href="#main"
            className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-soft transition-transform focus:translate-y-0"
          >
            {t.skipToContent}
          </a>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader locale={locale} />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter locale={locale} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
