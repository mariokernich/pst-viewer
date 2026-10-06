import { TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { legal } from '@/content/legal'
import { isLocale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { legalIdFromSlug, legalIds, legalSlugs } from '@/lib/routes'

export const dynamicParams = false

/** `/de/impressum`, `/de/datenschutz`, `/en/legal-notice`, `/en/privacy`. */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params
  if (!isLocale(locale)) return []
  return legalIds.map((id) => ({ legal: legalSlugs[id][locale] }))
}

function resolve(locale: string, slug: string) {
  if (!isLocale(locale)) return null
  const id = legalIdFromSlug(locale, slug)
  return id ? { locale, id } : null
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; legal: string }> }): Promise<Metadata> {
  const { locale, legal: slug } = await params
  const match = resolve(locale, slug)
  if (!match) return {}
  const page = legal[match.locale][match.id]
  return pageMetadata({ locale: match.locale, route: { page: 'legal', id: match.id }, title: page.title, description: page.description })
}

export default async function LegalPage({ params }: PageProps<'/[locale]/[legal]'>) {
  const { locale, legal: slug } = await params
  const match = resolve(locale, slug)
  if (!match) notFound()
  const page = legal[match.locale][match.id]

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 lg:pt-16">
      <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-5xl">{page.title}</h1>
      <p
        role="note"
        className="mt-8 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-[15px] leading-relaxed text-foreground"
      >
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
        {page.placeholderNotice}
      </p>
      <div className="doc-prose mt-6">{page.body}</div>
    </div>
  )
}
