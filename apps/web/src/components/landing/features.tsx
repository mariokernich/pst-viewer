import {
  BadgeCheck,
  CalendarDays,
  Contact,
  FileDown,
  FolderTree,
  Gauge,
  Languages,
  ListTodo,
  Paperclip,
  Search,
  SunMoon,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { sectionIds } from '@/lib/routes'
import { Highlight } from './highlight'

function FeatureCard({
  icon: Icon,
  title,
  text,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  text: string
  children?: ReactNode
  className?: string
}) {
  return (
    <li
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-soft transition-shadow duration-300 hover:shadow-window sm:p-8',
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 leading-relaxed text-pretty text-muted">{text}</p>
      {children ? <div className="mt-6 flex flex-1 flex-col justify-end">{children}</div> : null}
    </li>
  )
}

function Chip({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-muted px-3 py-1 text-sm font-medium text-foreground">
      {Icon ? <Icon className="size-3.5 text-accent" aria-hidden="true" /> : null}
      {children}
    </li>
  )
}

export function Features({ locale }: { locale: Locale }) {
  const t = landing[locale].features
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(0.64)

  return (
    <section id={sectionIds.features} aria-labelledby="features-title" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="features-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

        <ul className="mt-14 grid gap-4 sm:mt-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {/* Speed */}
          <FeatureCard icon={Gauge} title={t.speed.title} text={t.speed.text} className="lg:col-span-2">
            <div className="grid items-end gap-6 sm:grid-cols-[auto_1fr]">
              <p className="flex flex-col">
                <span className="text-gradient text-6xl font-semibold tracking-tighter">{t.speed.stat}</span>
                <span className="mt-1 text-sm text-muted">{t.speed.statLabel}</span>
              </p>
              <div aria-hidden="true" className="rounded-2xl border border-line bg-card-muted p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{t.speed.indexLabel}</span>
                  <span className="text-muted tabular-nums">{percent}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div className="bg-brand h-full w-[64%] rounded-full" />
                </div>
                <div className="mt-4 space-y-2">
                  {['78%', '64%', '86%'].map((width) => (
                    <div key={width} className="flex items-center gap-3">
                      <span className="size-6 shrink-0 rounded-full bg-gradient-to-br from-brand-from/40 to-brand-to/40" />
                      <span className="h-2 rounded-full bg-foreground/10" style={{ width }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FeatureCard>

          {/* Mailbox layout */}
          <FeatureCard icon={FolderTree} title={t.layout.title} text={t.layout.text}>
            <div aria-hidden="true" className="space-y-3 rounded-2xl border border-line bg-card-muted p-4">
              {t.layout.groups.map((group, index) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-accent">{group}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {Array.from({ length: index === 0 ? 2 : 1 }, (_, row) => (
                      <span
                        key={row}
                        className="block h-2 rounded-full bg-foreground/10"
                        style={{ width: `${88 - ((index + row) % 3) * 14}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>

          {/* Attachments */}
          <FeatureCard icon={Paperclip} title={t.attachments.title} text={t.attachments.text}>
            <ul className="flex flex-wrap gap-2">
              {t.attachments.types.map((type) => (
                <Chip key={type}>{type}</Chip>
              ))}
            </ul>
          </FeatureCard>

          {/* Search */}
          <FeatureCard icon={Search} title={t.search.title} text={t.search.text} className="lg:col-span-2">
            <div aria-hidden="true" className="rounded-2xl border border-line bg-card-muted p-3 sm:p-4">
              <div className="flex h-10 items-center gap-2.5 rounded-xl border border-line bg-card px-3 text-sm shadow-soft">
                <Search className="size-4 text-muted" />
                <span className="font-medium text-foreground">{t.search.query}</span>
                <span className="h-4 w-px animate-pulse bg-accent" />
              </div>
              <ul className="mt-3 divide-y divide-line">
                {t.search.results.map((result) => (
                  <li key={result.subject} className="flex items-baseline gap-3 px-1 py-2.5 text-sm">
                    <span className="w-32 shrink-0 truncate font-medium text-foreground sm:w-40">
                      <Highlight text={result.from} terms={t.search.highlights} />
                    </span>
                    <span className="truncate text-muted">
                      <Highlight text={result.subject} terms={t.search.highlights} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </FeatureCard>

          {/* Export */}
          <FeatureCard icon={FileDown} title={t.export.title} text={t.export.text}>
            <ul className="grid grid-cols-2 gap-2">
              {t.export.formats.map((format) => (
                <li
                  key={format}
                  className="rounded-xl border border-line bg-card-muted px-3 py-2.5 text-center text-sm font-semibold text-foreground"
                >
                  {format}
                </li>
              ))}
            </ul>
          </FeatureCard>

          {/* Calendar, contacts, tasks */}
          <FeatureCard icon={CalendarDays} title={t.items.title} text={t.items.text}>
            <ul className="flex flex-wrap gap-2">
              {t.items.kinds.map((kind, index) => (
                <Chip key={kind} icon={[CalendarDays, Contact, ListTodo, BadgeCheck][index]}>
                  {kind}
                </Chip>
              ))}
            </ul>
          </FeatureCard>

          {/* Appearance & languages */}
          <FeatureCard
            icon={SunMoon}
            title={t.appearance.title}
            text={t.appearance.text}
            className="md:col-span-2 lg:col-span-1"
          >
            <div aria-hidden="true" className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2">
              <span className="flex h-16 flex-col justify-center gap-1.5 rounded-xl border border-black/10 bg-white p-3">
                <span className="h-1.5 w-3/4 rounded-full bg-black/15" />
                <span className="h-1.5 w-1/2 rounded-full bg-black/10" />
              </span>
              <span className="flex h-16 flex-col justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1c1c20] p-3">
                <span className="h-1.5 w-3/4 rounded-full bg-white/25" />
                <span className="h-1.5 w-1/2 rounded-full bg-white/15" />
              </span>
              <span className="flex h-16 items-center gap-1.5 rounded-xl border border-line bg-card-muted px-3 text-sm font-semibold text-foreground">
                <Languages className="size-4 text-accent" />
                {t.appearance.languages}
              </span>
            </div>
          </FeatureCard>
        </ul>
      </div>
    </section>
  )
}
