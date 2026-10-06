import { Laptop, Monitor, Smartphone, TabletSmartphone, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PhoneFrame, TabletFrame, WindowFrame } from '@/components/screenshots/device-frames'
import { Screenshot } from '@/components/screenshots/screenshot'
import { SectionHeading } from '@/components/ui/section-heading'
import { StoreButton } from '@/components/ui/store-button'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { sectionIds } from '@/lib/routes'
import type { StoreId } from '@/lib/site'

function PlatformCard({
  icon: Icon,
  title,
  text,
  badge,
  inDevelopment,
  storeId,
  locale,
  children,
}: {
  icon: LucideIcon
  title: string
  text: string
  badge: string
  inDevelopment: boolean
  storeId: StoreId
  locale: Locale
  children: ReactNode
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-soft">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              inDevelopment
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
            )}
          >
            {badge}
          </span>
        </div>
        <p className="mt-3 leading-relaxed text-muted">{text}</p>
        <StoreButton storeId={storeId} locale={locale} className="mt-6" />
      </div>
      {/* Device frame, cropped at the bottom edge of the card */}
      <div className="relative mt-auto h-56 overflow-hidden bg-gradient-to-b from-transparent to-accent-soft sm:h-72">{children}</div>
    </li>
  )
}

export function Platforms({ locale }: { locale: Locale }) {
  const t = landing[locale].platforms
  const placeholder = common[locale].screenshot.placeholder

  return (
    <section id={sectionIds.platforms} aria-labelledby="platforms-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="platforms-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

        <ul className="mt-14 grid gap-5 sm:mt-16 md:grid-cols-2">
          <PlatformCard
            icon={Laptop}
            title={t.items.mac.title}
            text={t.items.mac.text}
            badge={t.badgeDesktop}
            inDevelopment={false}
            storeId="macAppStore"
            locale={locale}
          >
            <WindowFrame className="absolute top-8 left-6 w-[130%] sm:left-8 sm:w-[118%]">
              <Screenshot id="macMain" locale={locale} placeholderLabel={placeholder} sizes="(min-width: 768px) 46vw, 100vw" />
            </WindowFrame>
          </PlatformCard>

          <PlatformCard
            icon={Monitor}
            title={t.items.windows.title}
            text={t.items.windows.text}
            badge={t.badgeDesktop}
            inDevelopment={false}
            storeId="microsoftStore"
            locale={locale}
          >
            <WindowFrame className="absolute top-8 left-6 w-[130%] sm:left-8 sm:w-[118%]">
              <Screenshot id="windowsMain" locale={locale} placeholderLabel={placeholder} sizes="(min-width: 768px) 46vw, 100vw" />
            </WindowFrame>
          </PlatformCard>

          <PlatformCard
            icon={TabletSmartphone}
            title={t.items.ios.title}
            text={t.items.ios.text}
            badge={t.badgeInDevelopment}
            inDevelopment
            storeId="appStore"
            locale={locale}
          >
            <TabletFrame className="absolute top-8 left-6 w-[88%] sm:left-8 sm:w-[80%]">
              <Screenshot
                id="ipad"
                locale={locale}
                placeholderLabel={placeholder}
                sizes="(min-width: 768px) 40vw, 90vw"
                labelAlign="start"
              />
            </TabletFrame>
            <PhoneFrame variant="iphone" className="absolute top-20 right-5 w-[32%] max-w-44 sm:right-8">
              <Screenshot id="iphone" locale={locale} placeholderLabel={placeholder} sizes="176px" />
            </PhoneFrame>
          </PlatformCard>

          <PlatformCard
            icon={Smartphone}
            title={t.items.android.title}
            text={t.items.android.text}
            badge={t.badgeInDevelopment}
            inDevelopment
            storeId="googlePlay"
            locale={locale}
          >
            <PhoneFrame variant="android" className="absolute top-8 left-1/2 w-44 -translate-x-1/2 sm:w-52">
              <Screenshot id="android" locale={locale} placeholderLabel={placeholder} sizes="208px" />
            </PhoneFrame>
          </PlatformCard>
        </ul>
      </div>
    </section>
  )
}
