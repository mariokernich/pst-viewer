import { Check, CircleSlash } from 'lucide-react'
import { AppIcon } from '@/components/brand/app-icon'
import { SectionHeading } from '@/components/ui/section-heading'
import { StoreButton } from '@/components/ui/store-button'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { sectionIds } from '@/lib/routes'
import { storeOrder } from '@/lib/site'

export function Pricing({ locale }: { locale: Locale }) {
  const t = landing[locale].pricing
  const price = common[locale].price

  return (
    <section id={sectionIds.pricing} aria-labelledby="pricing-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="pricing-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

        <div className="relative mx-auto mt-14 max-w-4xl sm:mt-16">
          <div aria-hidden="true" className="bg-brand absolute inset-8 -z-10 rounded-[3rem] opacity-25 blur-3xl" />
          {/* Gradient hairline border */}
          <div className="bg-brand rounded-[2rem] p-px shadow-window">
            <div className="rounded-[calc(2rem-1px)] bg-card p-6 sm:p-10">
              <div className="grid gap-10 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-3">
                    <AppIcon size={44} />
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">{t.planName}</h3>
                      <p className="text-sm text-muted">{t.planText}</p>
                    </div>
                  </div>
                  <p className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-6xl font-semibold tracking-tighter text-foreground">{price.amount}</span>
                    <span className="text-muted">
                      {price.oneTime} · {price.perStore}
                    </span>
                  </p>
                  <ul className="mt-8 flex flex-wrap gap-2">
                    {t.excluded.map((item) => (
                      <li
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-muted px-3 py-1 text-sm font-medium text-foreground"
                      >
                        <CircleSlash className="size-3.5 text-accent" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{t.includedTitle}</h4>
                  <ul className="mt-4 space-y-3">
                    {t.included.map((item) => (
                      <li key={item} className="flex gap-3 text-muted">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-10 border-t border-line pt-8">
                <h4 className="text-sm font-semibold text-foreground">{t.storesTitle}</h4>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {storeOrder.map((storeId) => (
                    <li key={storeId}>
                      <StoreButton storeId={storeId} locale={locale} className="w-full" />
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm leading-relaxed text-muted">{t.footnote}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
