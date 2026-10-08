import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Laptop,
  Monitor,
  ShieldQuestion,
  Smartphone,
  SquareTerminal,
  TabletSmartphone,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { GitHubIcon } from '@/components/brand/github-icon'
import { RecommendedDownload } from '@/components/download/recommended-download'
import { AppLink } from '@/components/ui/app-link'
import { SectionHeading } from '@/components/ui/section-heading'
import { StoreButton } from '@/components/ui/store-button'
import { common } from '@/content/common'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionIds } from '@/lib/routes'
import { downloadGroups, downloads, github, storeOrder, type DownloadPlatform } from '@/lib/site'

/** Generic device icons – deliberately no platform trademarks. */
const platformIcons: Record<DownloadPlatform | 'ios', LucideIcon> = {
  mac: Laptop,
  windows: Monitor,
  linux: SquareTerminal,
  android: Smartphone,
  ios: TabletSmartphone,
}

function Card({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-3xl border border-line bg-card p-5 shadow-soft sm:p-6">
      <h3 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </li>
  )
}

/**
 * All downloads from GitHub Releases, grouped by platform. Fully server
 * rendered; the recommendation for the visitor's platform is added on the client.
 */
export function Downloads({ locale }: { locale: Locale }) {
  const t = landing[locale].download
  const c = common[locale]
  const labels = c.download

  return (
    <section id={sectionIds.download} aria-labelledby="download-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="download-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

        <RecommendedDownload
          labels={{
            recommended: labels.recommended,
            ctaFor: labels.ctaFor,
            platformNames: labels.platformNames,
            items: labels.items,
          }}
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {downloadGroups.map((group) => (
            <Card key={group.platform} icon={platformIcons[group.platform]} title={labels.platformNames[group.platform]}>
              <ul className="space-y-2">
                {group.ids.map((id) => {
                  const item = labels.items[id]
                  return (
                    <li key={id}>
                      <a
                        href={downloads[id].url}
                        className="group flex items-center gap-3 rounded-2xl border border-line bg-card-muted/60 px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent-soft"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-foreground">{item.label}</span>
                          <span className="block text-sm leading-snug text-muted">{item.detail}</span>
                        </span>
                        <ArrowDownToLine
                          className="size-5 shrink-0 text-muted transition-colors group-hover:text-accent"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}

          <Card icon={platformIcons.ios} title={labels.platformNames.ios}>
            <p className="leading-relaxed text-muted">{t.iosText}</p>
            <a
              href={github.iosSource}
              className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent hover:underline"
            >
              <GitHubIcon className="size-4" />
              {t.iosSourceLink}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </Card>

          <Card icon={ShieldQuestion} title={t.unsignedTitle}>
            <p className="text-[15px] leading-relaxed text-muted">{t.unsignedText}</p>
            <dl className="mt-4 space-y-3 text-sm leading-relaxed">
              {t.unsignedSteps.map((step) => (
                <div key={step.platform}>
                  <dt className="font-semibold text-foreground">{step.platform}</dt>
                  <dd className="text-muted">{step.text}</dd>
                </div>
              ))}
            </dl>
            <AppLink
              href={`${pathFor(locale, { page: 'doc', id: 'installation' })}#first-launch`}
              className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-accent hover:underline"
            >
              {t.unsignedLink}
              <ArrowRight className="size-4" aria-hidden="true" />
            </AppLink>
          </Card>
        </ul>

        <div className="mt-6 flex justify-center">
          <a
            href={github.releases}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:underline"
          >
            <GitHubIcon className="size-4" />
            {t.allReleases}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-14 rounded-3xl border border-dashed border-line-strong p-6 sm:p-8">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t.storesTitle}</h3>
            <p className="mt-1 leading-relaxed text-muted">{t.storesText}</p>
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {storeOrder.map((storeId) => (
              <li key={storeId}>
                <StoreButton storeId={storeId} locale={locale} className="w-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
