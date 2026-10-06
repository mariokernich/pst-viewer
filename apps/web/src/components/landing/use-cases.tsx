import { ArrowLeftRight, Inbox, Info, Receipt, Wrench, type LucideIcon } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { sectionIds } from '@/lib/routes'

const icons: LucideIcon[] = [ArrowLeftRight, Receipt, Wrench, Inbox]

export function UseCases({ locale }: { locale: Locale }) {
  const t = landing[locale].useCases

  return (
    <section
      id={sectionIds.useCases}
      aria-labelledby="use-cases-title"
      className="border-y border-line bg-background-subtle py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="use-cases-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
        <ul className="mt-14 grid gap-4 sm:mt-16 sm:grid-cols-2 xl:grid-cols-4">
          {t.items.map((item, index) => {
            const Icon = icons[index] ?? Inbox
            return (
              <li key={item.title} className="flex flex-col rounded-3xl border border-line bg-card p-6 shadow-soft">
                <span className="bg-brand-ink grid size-11 place-items-center rounded-2xl text-white shadow-[0_8px_20px_-8px_rgb(61_90_255/0.6)]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
                {item.note ? (
                  <p className="mt-4 flex gap-2 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {item.note}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
