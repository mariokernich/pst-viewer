import { ArrowRight, Code, EyeOff, HardDrive, Lock, ShieldCheck, UserX, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { SectionHeading } from '@/components/ui/section-heading'
import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'
import { pathFor, sectionIds } from '@/lib/routes'

const icons: LucideIcon[] = [HardDrive, Lock, EyeOff, Code, ShieldCheck, UserX]

export function Privacy({ locale }: { locale: Locale }) {
  const t = landing[locale].privacy

  return (
    <section id={sectionIds.privacy} aria-labelledby="privacy-title" className="px-2 py-24 sm:px-4 sm:py-32">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#0b0d1c] px-4 py-16 shadow-window sm:rounded-[2.5rem] sm:px-10 sm:py-20 lg:px-16 lg:py-24 dark:bg-[#0e1024] dark:ring-1 dark:ring-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(61_139_255/0.28),transparent)]" />
          <div className="absolute -right-40 -bottom-48 h-[28rem] w-[40rem] bg-[radial-gradient(closest-side,rgb(90_61_255/0.3),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)] bg-[size:48px_48px]" />
        </div>

        <SectionHeading id="privacy-title" eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} tone="inverted" />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.items.map((item, index) => {
            const Icon = icons[index] ?? ShieldCheck
            return (
              <li
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.07]"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#a9c4ff]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-white/75">{item.text}</p>
              </li>
            )
          })}
        </ul>

        <div className="mt-12 text-center">
          <Link
            href={pathFor(locale, { page: 'doc', id: 'privacy' })}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-[#a9c4ff] hover:underline"
          >
            {t.docsLink}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
