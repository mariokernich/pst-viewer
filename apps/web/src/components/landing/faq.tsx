import { ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionIds } from '@/lib/routes'

/** FAQ accordion based on native <details>/<summary>: keyboard operable without JavaScript. */
export function Faq({ locale }: { locale: Locale }) {
  const t = landing[locale].faq

  return (
    <section id={sectionIds.faq} aria-labelledby="faq-title" className="border-t border-line bg-background-subtle py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="faq-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} align="left" />
          <Link
            href={pathFor(locale, { page: 'doc', id: 'troubleshooting' })}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            {t.more}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {t.items.map((item) => (
            <details key={item.question} className="disclosure group">
              <summary className="flex items-start justify-between gap-6 py-5 text-left text-[17px] font-medium text-foreground transition-colors hover:text-accent">
                <span>{item.question}</span>
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-card text-muted transition-transform duration-200 group-open:rotate-45">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="pr-12 pb-6 leading-relaxed text-pretty text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
