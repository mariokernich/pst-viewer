import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { docs } from '@/content/docs'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { pathFor, type DocId } from '@/lib/routes'

type ActivePage = DocId | 'overview'

function DocsNav({ locale, active }: { locale: Locale; active: ActivePage }) {
  const t = docs[locale]
  const linkClass = (isActive: boolean) =>
    cn(
      'block rounded-lg px-3 py-1.5 text-[15px] transition-colors',
      isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-card-muted hover:text-foreground',
    )

  return (
    <nav aria-label={t.ui.navLabel}>
      <Link
        href={pathFor(locale, { page: 'docs' })}
        aria-current={active === 'overview' ? 'page' : undefined}
        className={linkClass(active === 'overview')}
      >
        {t.ui.overview}
      </Link>
      {t.groups.map((group) => (
        <div key={group.title} className="mt-6">
          <p className="px-3 text-xs font-semibold tracking-wide text-foreground uppercase">{group.title}</p>
          <ul className="mt-2 space-y-0.5">
            {group.ids.map((id) => (
              <li key={id}>
                <Link
                  href={pathFor(locale, { page: 'doc', id })}
                  aria-current={active === id ? 'page' : undefined}
                  className={linkClass(active === id)}
                >
                  {t.pages[id].title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export interface TocEntry {
  id: string
  title: string
}

interface DocsShellProps {
  locale: Locale
  active: ActivePage
  /** Title of the current page (shown in the collapsed mobile navigation). */
  currentTitle: string
  toc?: TocEntry[]
  children: ReactNode
}

/** Documentation layout: sidebar, content and – on wide screens – “On this page”. */
export function DocsShell({ locale, active, currentTitle, toc = [], children }: DocsShellProps) {
  const t = docs[locale]
  const showToc = toc.length >= 3

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 lg:px-8 lg:pt-12">
      <div className={cn('lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12', showToc && 'xl:grid-cols-[15rem_minmax(0,1fr)_13rem]')}>
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8">
            <DocsNav locale={locale} active={active} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* Mobile navigation; `key` resets the disclosure after navigating. */}
          <details key={active} className="disclosure group mb-8 rounded-2xl border border-line bg-card lg:hidden">
            <summary className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted">{t.ui.mobileNavToggle}</span>
                <span className="block truncate font-semibold text-foreground">{currentTitle}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-line px-1 py-4">
              <DocsNav locale={locale} active={active} />
            </div>
          </details>

          {children}
        </div>

        {showToc ? (
          <aside className="hidden xl:block">
            <nav aria-labelledby="toc-title" className="sticky top-24">
              <p id="toc-title" className="text-xs font-semibold tracking-wide text-foreground uppercase">
                {t.ui.tocTitle}
              </p>
              <ul className="mt-3 space-y-2 border-l border-line">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="-ml-px block border-l border-transparent pl-4 text-sm text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                      {entry.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
