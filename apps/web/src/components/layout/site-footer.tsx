import { AppIcon } from '@/components/brand/app-icon'
import { ThemeSwitcher } from '@/components/theme/theme-switcher'
import { AppLink } from '@/components/ui/app-link'
import { common } from '@/content/common'
import { docs } from '@/content/docs'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionPath, type DocId } from '@/lib/routes'
import { LanguageList } from './language-switcher'

const footerDocs: DocId[] = ['getting-started', 'search', 'attachments', 'export', 'privacy', 'troubleshooting']

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = common[locale]
  const docsContent = docs[locale]
  const year = new Date().getFullYear()

  const columns = [
    {
      title: t.footer.product,
      links: [
        { href: sectionPath(locale, 'features'), label: t.nav.features },
        { href: sectionPath(locale, 'platforms'), label: t.nav.platforms },
        { href: sectionPath(locale, 'pricing'), label: t.nav.pricing },
        { href: sectionPath(locale, 'faq'), label: t.nav.faq },
      ],
    },
    {
      title: t.footer.documentation,
      links: [
        { href: pathFor(locale, { page: 'docs' }), label: docsContent.ui.overview },
        ...footerDocs.map((id) => ({ href: pathFor(locale, { page: 'doc', id }), label: docsContent.pages[id].title })),
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: pathFor(locale, { page: 'legal', id: 'legalNotice' }), label: t.footer.legalNotice },
        { href: pathFor(locale, { page: 'legal', id: 'privacy' }), label: t.footer.privacy },
      ],
    },
  ]

  return (
    <footer className="border-t border-line bg-background-subtle">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <AppLink href={pathFor(locale, { page: 'home' })} className="inline-flex items-center gap-2.5 rounded-lg">
              <AppIcon size={30} />
              <span className="text-[17px] font-semibold tracking-tight">PST Viewer</span>
            </AppLink>
            <p className="mt-4 text-sm leading-relaxed text-muted">{t.footer.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t.footer.madeWith}</p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <AppLink href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                      {link.label}
                    </AppLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t.footer.copyright(year)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageList locale={locale} label={t.footer.language} />
            <ThemeSwitcher labels={t.theme} />
          </div>
        </div>
        <p className="mt-6 max-w-4xl text-xs leading-relaxed text-muted">{t.footer.trademarks}</p>
      </div>
    </footer>
  )
}
