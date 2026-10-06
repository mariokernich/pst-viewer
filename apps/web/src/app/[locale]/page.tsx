import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/json-ld'
import { Faq } from '@/components/landing/faq'
import { Features } from '@/components/landing/features'
import { FinalCta } from '@/components/landing/final-cta'
import { Formats } from '@/components/landing/formats'
import { Hero } from '@/components/landing/hero'
import { Platforms } from '@/components/landing/platforms'
import { Pricing } from '@/components/landing/pricing'
import { Privacy } from '@/components/landing/privacy'
import { SearchShowcase } from '@/components/landing/search-showcase'
import { UseCases } from '@/components/landing/use-cases'
import { landing } from '@/content/landing'
import { isLocale, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { pathFor } from '@/lib/routes'
import { siteConfig, siteUrl } from '@/lib/site'

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
    url: `${siteUrl}${pathFor(locale, { page: 'home' })}`,
    image: `${siteUrl}/icon.svg`,
    inLanguage: locale,
    applicationCategory: 'UtilitiesApplication',
    // TODO: add "iOS, iPadOS, Android" once the mobile apps are released.
    operatingSystem: 'macOS, Windows',
    softwareHelp: `${siteUrl}${pathFor(locale, { page: 'docs' })}`,
    author: { '@type': 'Person', name: siteConfig.owner },
    offers: {
      '@type': 'Offer',
      price: siteConfig.price.amount,
      priceCurrency: siteConfig.price.currency,
    },
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
      <Platforms locale={locale} />
      <UseCases locale={locale} />
      <Pricing locale={locale} />
      <Faq locale={locale} />
      <FinalCta locale={locale} />
    </>
  )
}
