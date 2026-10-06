'use client'

import { Check, Globe } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { localeNames, locales, type Locale } from '@/lib/i18n'
import { switchLocalePath } from '@/lib/routes'

/**
 * Header switch: links to the current page in the other language.
 * The link text is the target language in its own language (with `lang`).
 */
export function LanguageToggle({ locale, title, className }: { locale: Locale; title: string; className?: string }) {
  const pathname = usePathname()
  const target = locales.find((l) => l !== locale) ?? locale
  return (
    <Link
      href={switchLocalePath(pathname, target)}
      hrefLang={target}
      lang={target}
      title={title}
      prefetch={false}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground',
        className,
      )}
    >
      <Globe className="size-4" aria-hidden="true" />
      {localeNames[target]}
    </Link>
  )
}

/** List of all languages; the current one is marked and not a link. */
export function LanguageList({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        {locales.map((l) =>
          l === locale ? (
            <li key={l}>
              <span
                lang={l}
                aria-current="true"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-card-muted px-3 text-sm font-medium text-foreground"
              >
                <Check className="size-3.5" aria-hidden="true" />
                {localeNames[l]}
              </span>
            </li>
          ) : (
            <li key={l}>
              <Link
                href={switchLocalePath(pathname, l)}
                hrefLang={l}
                lang={l}
                prefetch={false}
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-card-muted hover:text-foreground"
              >
                {localeNames[l]}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
