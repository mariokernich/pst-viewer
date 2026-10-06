import { ArrowRight, Check, Paperclip, Search, X } from 'lucide-react'
import { AppLink } from '@/components/ui/app-link'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionIds } from '@/lib/routes'
import { Highlight } from './highlight'

/** Renders a query with operators (`von:anna`) emphasised like in the app. */
function QueryTokens({ query }: { query: string }) {
  return (
    <span className="truncate font-mono text-[13px] text-foreground">
      {query.split(' ').map((token, index) => {
        const colon = token.indexOf(':')
        return (
          <span key={`${token}-${index}`}>
            {index > 0 ? ' ' : null}
            {colon > 0 ? (
              <>
                <span className="font-semibold text-accent">{token.slice(0, colon + 1)}</span>
                {token.slice(colon + 1)}
              </>
            ) : (
              token
            )}
          </span>
        )
      })}
    </span>
  )
}

export function SearchShowcase({ locale }: { locale: Locale }) {
  const t = landing[locale].search
  const mock = t.mock

  return (
    <section
      id={sectionIds.search}
      aria-labelledby="search-title"
      className="relative overflow-hidden border-y border-line bg-background-subtle py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-8">
        <div>
          <SectionHeading id="search-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} align="left" />
          <ul className="mt-10 space-y-6">
            {t.points.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{point.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Search UI mock */}
          <div
            role="img"
            aria-label={mock.label}
            className="overflow-hidden rounded-2xl border border-line-strong bg-card shadow-window"
          >
            <div className="border-b border-line bg-card-muted/70 p-3 sm:p-4">
              <div className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-card px-3 shadow-soft">
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <QueryTokens query={mock.query} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="inline-flex rounded-lg bg-foreground/[0.06] p-0.5 text-xs font-medium">
                  <span className="rounded-md bg-card px-2.5 py-1 text-foreground shadow-soft">{mock.scopeAll}</span>
                  <span className="px-2.5 py-1 text-muted">{mock.scopeFolder}</span>
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap items-center gap-1.5">
                {mock.chips.map((chip) => (
                  <li
                    key={chip}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-accent/25 bg-accent-soft pr-1.5 pl-2.5 text-xs font-medium text-foreground"
                  >
                    {chip}
                    <X className="size-3.5 text-muted" aria-hidden="true" />
                  </li>
                ))}
                <li className="px-1.5 text-xs font-medium text-accent">{mock.resetAll}</li>
              </ul>
            </div>
            <ul className="divide-y divide-line">
              {mock.results.map((result) => (
                <li key={result.subject} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-foreground">{result.from}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                        {result.attachment ? <Paperclip className="size-3.5" aria-hidden="true" /> : null}
                        {result.date}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-foreground">
                      <Highlight text={result.subject} terms={[result.highlight]} />
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      <Highlight text={result.snippet} terms={[result.highlight]} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Query syntax excerpt */}
          <div className="rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
            <h3 className="font-semibold text-foreground">{t.syntaxTitle}</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-[auto_1fr]">
              {t.syntaxRows.map(([example, meaning]) => (
                <div key={example} className="contents">
                  <dt>
                    <code lang={locale} className="rounded-md bg-card-muted px-2 py-0.5 font-mono text-[13px] whitespace-nowrap text-foreground">
                      {example}
                    </code>
                  </dt>
                  <dd className="text-sm text-muted sm:self-center">{meaning}</dd>
                </div>
              ))}
            </dl>
            <AppLink
              href={`${pathFor(locale, { page: 'doc', id: 'search' })}#query-syntax`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              {t.syntaxLink}
              <ArrowRight className="size-4" aria-hidden="true" />
            </AppLink>
          </div>
        </div>
      </div>
    </section>
  )
}
