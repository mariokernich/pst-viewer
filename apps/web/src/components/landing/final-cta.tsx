import { ArrowRight } from 'lucide-react'
import { AppIcon } from '@/components/brand/app-icon'
import { DownloadCta } from '@/components/download/download-cta'
import { AppLink } from '@/components/ui/app-link'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionPath } from '@/lib/routes'

export function FinalCta({ locale }: { locale: Locale }) {
  const t = landing[locale].finalCta

  return (
    <section aria-labelledby="final-cta-title" className="px-2 py-24 sm:px-4 sm:py-32">
      <div className="bg-brand-ink relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center shadow-window sm:rounded-[2.5rem] sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -right-24 -bottom-40 h-96 w-96 rounded-full bg-[#2a1aa8]/50 blur-3xl" />
        </div>
        <AppIcon size={72} className="mx-auto drop-shadow-[0_12px_24px_rgb(10_10_60/0.45)]" />
        <h2 id="final-cta-title" className="mx-auto mt-8 max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl">
          {t.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty text-white/85">{t.text}</p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <DownloadCta
            labels={common[locale].download}
            fallbackHref={sectionPath(locale, 'download')}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold whitespace-nowrap text-[#1d1d1f] shadow-soft transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-white active:scale-[0.98]"
          />
          <AppLink
            href={pathFor(locale, { page: 'docs' })}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 px-6 font-semibold text-white ring-1 ring-white/30 transition-colors duration-200 hover:bg-white/25 focus-visible:outline-white"
          >
            {t.secondaryCta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </AppLink>
        </div>
      </div>
    </section>
  )
}
