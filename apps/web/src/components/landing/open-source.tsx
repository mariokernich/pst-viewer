import { ArrowUpRight, Check, CircleSlash, MessageSquare, Scale } from 'lucide-react'
import { AppIcon } from '@/components/brand/app-icon'
import { GitHubIcon } from '@/components/brand/github-icon'
import { buttonClassName } from '@/components/ui/button-link'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { sectionIds } from '@/lib/routes'
import { github } from '@/lib/site'

/** "Free & open source": MIT license, transparent code, contributions. */
export function OpenSource({ locale }: { locale: Locale }) {
  const t = landing[locale].openSource

  return (
    <section id={sectionIds.openSource} aria-labelledby="open-source-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="open-source-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

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
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">{t.cardTitle}</h3>
                      <p className="text-sm text-muted">{t.cardText}</p>
                    </div>
                  </div>
                  <p className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-gradient text-6xl font-semibold tracking-tighter">{t.free}</span>
                    <span className="text-muted">{t.freeNote}</span>
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
                  <h4 className="text-sm font-semibold text-foreground">{t.pointsTitle}</h4>
                  <ul className="mt-4 space-y-4">
                    {t.points.map((point) => (
                      <li key={point.title} className="flex gap-3">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block font-medium text-foreground">{point.title}</span>
                          <span className="mt-0.5 block text-[15px] leading-relaxed text-muted">{point.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:flex-wrap sm:items-center">
                <a href={github.repo} className={buttonClassName('primary', 'md')}>
                  <GitHubIcon className="size-4" />
                  {t.repoCta}
                </a>
                <a href={github.issues} className={buttonClassName('secondary', 'md')}>
                  <MessageSquare className="size-4" aria-hidden="true" />
                  {t.issuesCta}
                </a>
                <a
                  href={github.license}
                  className="inline-flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold text-accent hover:underline sm:ml-auto"
                >
                  <Scale className="size-4" aria-hidden="true" />
                  {t.licenseLink}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
