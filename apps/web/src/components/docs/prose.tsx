import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { AppLink } from '@/components/ui/app-link'
import { keyboardShortcuts, searchSyntax } from '@/content/reference'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { pathFor, type DocId, type LegalId } from '@/lib/routes'

/**
 * Building blocks for the documentation content. Plain elements (p, ul, ol,
 * code, table, strong) are styled by the `.doc-prose` wrapper in globals.css.
 */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="steps">{children}</ol>
}

const calloutStyles = {
  info: { icon: Info, className: 'border-sky-500/25 bg-sky-500/[0.06] [--callout-icon:var(--color-sky-600)] dark:[--callout-icon:var(--color-sky-300)]' },
  tip: { icon: Lightbulb, className: 'border-emerald-500/25 bg-emerald-500/[0.06] [--callout-icon:var(--color-emerald-600)] dark:[--callout-icon:var(--color-emerald-300)]' },
  warning: { icon: TriangleAlert, className: 'border-amber-500/30 bg-amber-500/[0.07] [--callout-icon:var(--color-amber-600)] dark:[--callout-icon:var(--color-amber-300)]' },
} as const

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof calloutStyles
  title?: string
  children: ReactNode
}) {
  const { icon: Icon, className } = calloutStyles[tone]
  return (
    <aside className={cn('callout my-6 flex gap-3 rounded-2xl border p-4 text-[15px] leading-relaxed', className)}>
      <Icon className="mt-0.5 size-5 shrink-0 text-(--callout-icon)" />
      <div className="min-w-0">
        {title ? <p className="font-semibold text-foreground">{title}</p> : null}
        <div className="text-muted [&_strong]:text-foreground">{children}</div>
      </div>
    </aside>
  )
}

export function DocLink({
  locale,
  id,
  hash,
  children,
}: {
  locale: Locale
  id: DocId
  hash?: string
  children: ReactNode
}) {
  return <AppLink href={`${pathFor(locale, { page: 'doc', id })}${hash ? `#${hash}` : ''}`}>{children}</AppLink>
}

export function LegalLink({ locale, id, children }: { locale: Locale; id: LegalId; children: ReactNode }) {
  return <AppLink href={pathFor(locale, { page: 'legal', id })}>{children}</AppLink>
}

const tableLabels = {
  de: { example: 'Beispiel', other: 'Englische Variante', meaning: 'Bedeutung', action: 'Aktion', or: 'oder' },
  en: { example: 'Example', other: 'German equivalent', meaning: 'Meaning', action: 'Action', or: 'or' },
} as const

/** Full search syntax table: examples in the page language plus the other language. */
export function SyntaxTable({ locale }: { locale: Locale }) {
  const labels = tableLabels[locale]
  const other: Locale = locale === 'de' ? 'en' : 'de'
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{labels.example}</th>
            <th scope="col">{labels.other}</th>
            <th scope="col">{labels.meaning}</th>
          </tr>
        </thead>
        <tbody>
          {searchSyntax.map((row) => (
            <tr key={row.en}>
              <td>
                <code lang={locale}>{row[locale]}</code>
              </td>
              <td>
                <code lang={other}>{row[other]}</code>
              </td>
              <td>{row.meaning[locale]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KeyAlternatives({ alternatives, or }: { alternatives: string[][]; or: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {alternatives.map((group, index) => (
        <Fragment key={group.join('+')}>
          {index > 0 ? <span className="px-0.5 text-sm text-muted">{or}</span> : null}
          {group.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </Fragment>
      ))}
    </span>
  )
}

/** Keyboard shortcuts of the desktop app for Mac and Windows. */
export function ShortcutTable({ locale }: { locale: Locale }) {
  const labels = tableLabels[locale]
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{labels.action}</th>
            <th scope="col">Mac</th>
            <th scope="col">Windows</th>
          </tr>
        </thead>
        <tbody>
          {keyboardShortcuts(locale).map((row) => (
            <tr key={row.action.en}>
              <td>
                {row.action[locale]}
                {row.context ? <span className="block text-sm text-muted">{row.context[locale]}</span> : null}
              </td>
              <td>
                <KeyAlternatives alternatives={row.mac} or={labels.or} />
              </td>
              <td>
                <KeyAlternatives alternatives={row.windows} or={labels.or} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
