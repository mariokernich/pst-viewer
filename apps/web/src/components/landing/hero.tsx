import { ArrowRight, CircleCheck, Code, HardDrive, ShieldCheck, type LucideIcon } from 'lucide-react'
import { GitHubIcon } from '@/components/brand/github-icon'
import { DownloadCta } from '@/components/download/download-cta'
import { WindowFrame } from '@/components/screenshots/device-frames'
import { ThemedDesktopScreenshot } from '@/components/screenshots/screenshot'
import { AppLink } from '@/components/ui/app-link'
import { ButtonLink, buttonClassName } from '@/components/ui/button-link'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { sectionPath } from '@/lib/routes'
import { github } from '@/lib/site'

const trustIcons: [LucideIcon, LucideIcon, LucideIcon, LucideIcon] = [ShieldCheck, HardDrive, Code, CircleCheck]

export function Hero({ locale }: { locale: Locale }) {
  const t = landing[locale].hero
  const c = common[locale]
  const placeholder = c.screenshot.placeholder

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-14rem] left-1/2 h-[44rem] w-[80rem] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(61_139_255/0.18),transparent)] dark:bg-[radial-gradient(closest-side,rgb(61_139_255/0.2),transparent)]" />
        <div className="absolute top-[10rem] left-[58%] h-[34rem] w-[46rem] bg-[radial-gradient(closest-side,rgb(90_61_255/0.13),transparent)] dark:bg-[radial-gradient(closest-side,rgb(90_61_255/0.2),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)] bg-[size:64px_64px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24 lg:pb-28">
        <div className="mx-auto max-w-4xl text-center">
          <a
            href={github.repo}
            className="group inline-flex max-w-full items-center gap-2 rounded-2xl border border-line bg-card/70 px-3.5 py-1.5 text-left text-[13px] font-medium text-muted shadow-soft backdrop-blur transition-colors hover:border-accent/40 hover:text-foreground sm:rounded-full sm:text-sm"
          >
            <GitHubIcon className="size-4 shrink-0 text-foreground" />
            <span>{c.openSourceBadge}</span>
            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <h1
            id="hero-title"
            className="mt-6 text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
          >
            <span className="block">{t.titleLead}</span>
            <span className="text-gradient block pb-[0.08em]">{t.titleAccent}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted sm:text-xl">
            {t.subtitle}
          </p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <DownloadCta
              labels={c.download}
              fallbackHref={sectionPath(locale, 'download')}
              className={buttonClassName('primary', 'lg')}
            />
            <ButtonLink href={github.repo} size="lg" variant="secondary">
              <GitHubIcon className="size-4" />
              {t.secondaryCta}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-pretty text-muted">
            {t.availability} ·{' '}
            <AppLink href={sectionPath(locale, 'download')} className="font-medium text-accent hover:underline">
              {c.download.otherVersions}
            </AppLink>
          </p>
        </div>
        <ul className="mx-auto mt-10 grid w-fit gap-x-10 gap-y-3 text-sm text-muted sm:grid-cols-2 xl:flex xl:gap-x-8">
          {t.trust.map((item, index) => {
            const Icon = trustIcons[index] ?? CircleCheck
            return (
              <li key={item} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{item}</span>
              </li>
            )
          })}
        </ul>

        <div className="relative mx-auto mt-16 max-w-6xl sm:mt-20">
          <div
            aria-hidden="true"
            className="bg-brand absolute -inset-x-6 -inset-y-8 -z-10 rounded-[3rem] opacity-[0.18] blur-3xl dark:opacity-25"
          />
          <WindowFrame>
            <ThemedDesktopScreenshot
              locale={locale}
              placeholderLabel={placeholder}
              sizes="(min-width: 1280px) 1152px, calc(100vw - 2rem)"
              priority
            />
          </WindowFrame>
        </div>
      </div>
    </section>
  )
}
