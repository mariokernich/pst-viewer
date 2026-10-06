import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocsShell } from '@/components/docs/docs-shell'
import { docs, orderedDocIds } from '@/content/docs'
import { isLocale, type Locale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { docIdFromSlug, docIds, docSlugs, pathFor } from '@/lib/routes'

export const dynamicParams = false

/** One page per document and locale, under the localized slug. */
export function generateStaticParams({ params }: { params: { locale: string } }) {
  const { locale } = params
  if (!isLocale(locale)) return []
  return docIds.map((id) => ({ slug: docSlugs[id][locale] }))
}

function resolve(locale: string, slug: string) {
  if (!isLocale(locale)) return null
  const id = docIdFromSlug(locale, slug)
  return id ? { locale, id } : null
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const match = resolve(locale, slug)
  if (!match) return {}
  const page = docs[match.locale].pages[match.id]
  return pageMetadata({ locale: match.locale, route: { page: 'doc', id: match.id }, title: page.title, description: page.description })
}

function Pager({ locale, index }: { locale: Locale; index: number }) {
  const t = docs[locale]
  const order = orderedDocIds(locale)
  const previous = order[index - 1]
  const next = order[index + 1]
  if (!previous && !next) return null

  return (
    <nav aria-label={t.ui.pagerLabel} className="mt-16 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
      {previous ? (
        <Link
          href={pathFor(locale, { page: 'doc', id: previous })}
          rel="prev"
          className="group rounded-2xl border border-line p-4 transition-colors hover:border-accent/40"
        >
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            {t.ui.previous}
          </span>
          <span className="mt-1 block font-semibold text-foreground">{t.pages[previous].title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={pathFor(locale, { page: 'doc', id: next })}
          rel="next"
          className="group rounded-2xl border border-line p-4 text-right transition-colors hover:border-accent/40"
        >
          <span className="flex items-center justify-end gap-1.5 text-sm text-muted">
            {t.ui.next}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="mt-1 block font-semibold text-foreground">{t.pages[next].title}</span>
        </Link>
      ) : null}
    </nav>
  )
}

export default async function DocPage({ params }: PageProps<'/[locale]/docs/[slug]'>) {
  const { locale, slug } = await params
  const match = resolve(locale, slug)
  if (!match) notFound()

  const t = docs[match.locale]
  const page = t.pages[match.id]
  const group = t.groups.find((g) => g.ids.includes(match.id))
  const index = orderedDocIds(match.locale).indexOf(match.id)

  return (
    <DocsShell
      locale={match.locale}
      active={match.id}
      currentTitle={page.title}
      toc={page.sections.map(({ id, title }) => ({ id, title }))}
    >
      <article>
        <header className="max-w-3xl">
          {group ? <p className="text-sm font-semibold text-accent">{group.title}</p> : null}
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-muted">{page.description}</p>
        </header>
        <div className="doc-prose mt-10 max-w-3xl">
          {page.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id}>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </article>
      <div className="max-w-3xl">
        <Pager locale={match.locale} index={index} />
      </div>
    </DocsShell>
  )
}
