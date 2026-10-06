import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button-link'
import { common } from '@/content/common'
import type { Locale } from '@/lib/i18n'
import { pathFor } from '@/lib/routes'

/** Text and links of the 404 page in one language. */
export function NotFoundContent({ locale, headingLevel = 1 }: { locale: Locale; headingLevel?: 1 | 2 }) {
  const t = common[locale].notFound
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div lang={locale} className="mx-auto max-w-xl text-center">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{t.eyebrow}</p>
      <Heading className="mt-3 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
        {t.title}
      </Heading>
      <p className="mt-4 text-lg text-pretty text-muted">{t.text}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href={pathFor(locale, { page: 'home' })}>{t.home}</ButtonLink>
        <ButtonLink href={pathFor(locale, { page: 'docs' })} variant="secondary">
          {t.docs}
          <ArrowRight className="size-4" aria-hidden="true" />
        </ButtonLink>
      </div>
    </div>
  )
}
