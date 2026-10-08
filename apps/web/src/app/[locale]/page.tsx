import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/json-ld'
import { Faq } from '@/components/landing/faq'
import { Features } from '@/components/landing/features'
import { FinalCta } from '@/components/landing/final-cta'
import { Formats } from '@/components/landing/formats'
import { Downloads } from '@/components/landing/downloads'
import { Hero } from '@/components/landing/hero'
import { OpenSource } from '@/components/landing/open-source'
import { Platforms } from '@/components/landing/platforms'
import { Privacy } from '@/components/landing/privacy'
import { SearchShowcase } from '@/components/landing/search-showcase'
import { UseCases } from '@/components/landing/use-cases'
import { landing } from '@/content/landing'
import { isLocale, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { pathFor } from '@/lib/routes'
import { absoluteUrl, github, siteConfig } from '@/lib/site'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = landing[locale].meta
  return pageMetadata({ locale, route: { page: 'home' }, title: t.title, description: t.description, absoluteTitle: true })
}

function softwareApplication(locale: Locale) {
  const t = landing[locale]
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    description: t.meta.description,
    url: absoluteUrl(pathFor(locale, { page: 'home' })),
    image: absoluteUrl('/icon.svg'),
    inLanguage: locale,
    applicationCategory: 'UtilitiesApplication',
    // TODO: add "iOS, iPadOS" once the iPhone & iPad app is released.
    operatingSystem: 'macOS, Windows, Linux, Android',
    softwareHelp: absoluteUrl(pathFor(locale, { page: 'docs' })),
    downloadUrl: github.releases,
    installUrl: absoluteUrl(pathFor(locale, { page: 'doc', id: 'installation' })),
    releaseNotes: github.releases,
    license: 'https://opensource.org/licenses/MIT',
    isAccessibleForFree: true,
    sameAs: [github.repo],
    author: { '@type': 'Person', name: siteConfig.owner },
    // Free: price 0 is how schema.org/Google express "no cost".
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', url: github.latestRelease },
  }
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <>
      <JsonLd data={softwareApplication(locale)} />
      <Hero locale={locale} />
      <Formats locale={locale} />
      <Features locale={locale} />
      <SearchShowcase locale={locale} />
      <Privacy locale={locale} />
      <OpenSource locale={locale} />
      <Platforms locale={locale} />
      <Downloads locale={locale} />
      <UseCases locale={locale} />
      <Faq locale={locale} />
      <FinalCta locale={locale} />
    </>
  )
}
