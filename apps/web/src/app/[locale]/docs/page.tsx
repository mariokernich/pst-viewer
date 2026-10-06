import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocsShell } from '@/components/docs/docs-shell'
import { docs } from '@/content/docs'
import { isLocale } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { pathFor } from '@/lib/routes'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = docs[locale].overview
  return pageMetadata({ locale, route: { page: 'docs' }, title: t.title, description: t.description })
}

export default async function DocsOverviewPage({ params }: PageProps<'/[locale]/docs'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = docs[locale]

  return (
    <DocsShell locale={locale} active="overview" currentTitle={t.ui.overview}>
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-5xl">
          {t.overview.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted">{t.overview.intro}</p>
      </header>

      <section aria-labelledby="quick-start" className="doc-prose mt-10 max-w-3xl rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-8">
        <h2 id="quick-start" className="mt-0">
          {t.overview.quickStartTitle}
        </h2>
        <ol className="steps">
          {t.overview.quickStart.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="all-topics" className="mt-14">
        <h2 id="all-topics" className="text-2xl font-semibold tracking-tight text-foreground">
          {t.overview.pagesTitle}
        </h2>
        {t.groups.map((group) => (
          <div key={group.title} className="mt-8">
            <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{group.title}</h3>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.ids.map((id) => {
                const page = t.pages[id]
                return (
                  <li key={id}>
                    <Link
                      href={pathFor(locale, { page: 'doc', id })}
                      className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-accent/40 hover:shadow-window"
                    >
                      <span className="flex items-center justify-between gap-2 font-semibold text-foreground">
                        {page.title}
                        <ArrowRight
                          className="size-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-2 text-sm leading-relaxed text-muted">{page.description}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>
    </DocsShell>
  )
}
