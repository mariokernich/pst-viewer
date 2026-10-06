import { AppIcon } from '@/components/brand/app-icon'
import { ThemeSwitcher } from '@/components/theme/theme-switcher'
import { AppLink } from '@/components/ui/app-link'
import { ButtonLink } from '@/components/ui/button-link'
import { common } from '@/content/common'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionPath } from '@/lib/routes'
import { LanguageToggle } from './language-switcher'
import { MobileNav, type NavItem } from './mobile-nav'

export function SiteHeader({ locale }: { locale: Locale }) {
  const t = common[locale]
  const items: NavItem[] = [
    { href: sectionPath(locale, 'features'), label: t.nav.features },
    { href: sectionPath(locale, 'platforms'), label: t.nav.platforms },
    { href: sectionPath(locale, 'pricing'), label: t.nav.pricing },
    { href: pathFor(locale, { page: 'docs' }), label: t.nav.docs },
    { href: sectionPath(locale, 'faq'), label: t.nav.faq },
  ]
  const cta: NavItem = { href: sectionPath(locale, 'pricing'), label: t.header.cta }

  return (
    <header className="sticky top-0 z-50">
      {/* Glass background on its own layer, so the header itself stays a normal containing block. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 border-b border-line bg-background/75 backdrop-blur-xl backdrop-saturate-150" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <AppLink
          href={pathFor(locale, { page: 'home' })}
          aria-label={t.header.home}
          className="-ml-1 flex items-center gap-2.5 rounded-lg px-1 py-1"
        >
          <AppIcon size={30} />
          <span className="text-[17px] font-semibold tracking-tight text-foreground">PST Viewer</span>
        </AppLink>

        <nav aria-label={t.nav.label} className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <AppLink
                  href={item.href}
                  className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground"
                >
                  {item.label}
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <LanguageToggle locale={locale} title={t.language.switchTo} className="max-lg:hidden" />
          <ThemeSwitcher labels={t.theme} className="max-lg:hidden" />
          <ButtonLink href={cta.href} size="sm" className="max-sm:hidden">
            {cta.label}
          </ButtonLink>
          <MobileNav
            locale={locale}
            items={items}
            cta={cta}
            labels={{ open: t.header.openMenu, close: t.header.closeMenu, nav: t.nav.label, language: t.language.label }}
            themeLabels={t.theme}
          />
        </div>
      </div>
    </header>
  )
}
