import { ArrowDownToLine, ArrowUpRight, Laptop, Smartphone, TabletSmartphone, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { GitHubIcon } from '@/components/brand/github-icon'
import { PhoneFrame, TabletFrame, WindowFrame } from '@/components/screenshots/device-frames'
import { Screenshot, ThemedDesktopScreenshot } from '@/components/screenshots/screenshot'
import { AppLink } from '@/components/ui/app-link'
import { buttonClassName } from '@/components/ui/button-link'
import { SectionHeading } from '@/components/ui/section-heading'
import { StoreButton } from '@/components/ui/store-button'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { sectionIds, sectionPath } from '@/lib/routes'
import { downloads, github } from '@/lib/site'

function Badge({ children, available }: { children: ReactNode; available: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        available
          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
          : 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
      )}
    >
      {children}
    </span>
  )
}

function CardHeader({ icon: Icon, title, badge }: { icon: LucideIcon; title: string; badge: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      {badge}
    </div>
  )
}

export function Platforms({ locale }: { locale: Locale }) {
  const t = landing[locale].platforms
  const c = common[locale]
  const placeholder = c.screenshot.placeholder

  return (
    <section id={sectionIds.platforms} aria-labelledby="platforms-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="platforms-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

        <ul className="mt-14 grid gap-5 sm:mt-16 md:grid-cols-2">
          {/* Desktop: Mac, Windows & Linux */}
          <li className="overflow-hidden rounded-3xl border border-line bg-card shadow-soft md:col-span-2 lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="flex flex-col p-6 sm:p-8 lg:p-10">
              <CardHeader icon={Laptop} title={t.items.desktop.title} badge={<Badge available>{t.badgeAvailable}</Badge>} />
              <p className="mt-3 leading-relaxed text-muted">{t.items.desktop.text}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <AppLink href={sectionPath(locale, 'download')} className={buttonClassName('primary', 'md')}>
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  {t.downloadsLink}
                </AppLink>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-auto lg:pt-8">
                <StoreButton storeId="macAppStore" locale={locale} className="w-full" />
                <StoreButton storeId="microsoftStore" locale={locale} className="w-full" />
              </div>
            </div>
            {/* Window, cropped at the right and bottom edge of the card */}
            <div className="relative h-60 overflow-hidden bg-gradient-to-b from-transparent to-accent-soft sm:h-80 lg:h-auto lg:min-h-96 lg:bg-gradient-to-br">
              <WindowFrame className="absolute top-8 left-6 w-[150%] sm:left-8 sm:w-[125%] lg:top-10 lg:left-4 lg:w-[150%]">
                <ThemedDesktopScreenshot
                  locale={locale}
                  placeholderLabel={placeholder}
                  sizes="(min-width: 1024px) 60vw, 125vw"
                  inverted
                />
              </WindowFrame>
            </div>
          </li>

          {/* iPhone & iPad */}
          <li className="flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-soft">
            <div className="flex flex-col p-6 sm:p-8">
              <CardHeader
                icon={TabletSmartphone}
                title={t.items.ios.title}
                badge={<Badge available={false}>{t.badgeComingSoon}</Badge>}
              />
              <p className="mt-3 leading-relaxed text-muted">{t.items.ios.text}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <StoreButton storeId="appStore" locale={locale} />
                <a
                  href={github.iosSource}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                >
                  <GitHubIcon className="size-4" />
                  {t.items.ios.sourceLink}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className="relative mt-auto h-56 overflow-hidden bg-gradient-to-b from-transparent to-accent-soft sm:h-72">
              <TabletFrame className="absolute top-8 left-6 w-[62%] sm:left-8 sm:w-[56%]">
                <Screenshot
                  id="ipad"
                  locale={locale}
                  placeholderLabel={placeholder}
                  sizes="(min-width: 768px) 28vw, 62vw"
                  labelAlign="start"
                />
              </TabletFrame>
              <PhoneFrame variant="iphone" className="absolute top-20 right-6 w-[32%] max-w-44 sm:right-10">
                <Screenshot id="iphone" locale={locale} placeholderLabel={placeholder} sizes="176px" />
              </PhoneFrame>
            </div>
          </li>

          {/* Android */}
          <li className="flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-soft">
            <div className="flex flex-col p-6 sm:p-8">
              <CardHeader icon={Smartphone} title={t.items.android.title} badge={<Badge available>{t.badgeAndroid}</Badge>} />
              <p className="mt-3 leading-relaxed text-muted">{t.items.android.text}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={downloads.android.url} className={buttonClassName('secondary', 'md', 'h-14 rounded-2xl')}>
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  {c.download.ctaFor.android}
                </a>
                <StoreButton storeId="googlePlay" locale={locale} />
              </div>
            </div>
            <div className="relative mt-auto h-56 overflow-hidden bg-gradient-to-b from-transparent to-accent-soft sm:h-72">
              <PhoneFrame variant="android" className="absolute top-8 left-1/2 w-44 -translate-x-1/2 sm:w-52">
                <Screenshot id="android" locale={locale} placeholderLabel={placeholder} sizes="208px" />
              </PhoneFrame>
            </div>
          </li>
        </ul>

      </div>
    </section>
  )
}
