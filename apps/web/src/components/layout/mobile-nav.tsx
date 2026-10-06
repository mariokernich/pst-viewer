'use client'

import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { ThemeSwitcher, type ThemeLabels } from '@/components/theme/theme-switcher'
import { AppLink } from '@/components/ui/app-link'
import type { Locale } from '@/lib/i18n'
import { LanguageList } from './language-switcher'

export interface NavItem {
  href: string
  label: string
}

interface MobileNavProps {
  locale: Locale
  items: NavItem[]
  cta: NavItem
  labels: { open: string; close: string; nav: string; language: string }
  themeLabels: ThemeLabels
}

/**
 * Disclosure menu for small screens. Closes on Escape, on link clicks, when
 * focus leaves the menu, on outside clicks and after navigation.
 */
export function MobileNav({ locale, items, cta, labels, themeLabels }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [lastPathname, setLastPathname] = useState(pathname)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Close after client-side navigation (state adjustment during render).
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  const close = () => setOpen(false)

  return (
    <div className="lg:hidden" onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-card-muted"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        <span className="sr-only">{open ? labels.close : labels.open}</span>
      </button>

      {open ? <div className="fixed inset-0 top-16 -z-10 bg-black/20 backdrop-blur-[2px]" onClick={close} aria-hidden="true" /> : null}

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-background/95 shadow-soft backdrop-blur-xl"
      >
        <div className="mx-auto max-w-7xl px-4 pt-3 pb-6 sm:px-6">
          <nav aria-label={labels.nav}>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.href}>
                  <AppLink
                    href={item.href}
                    onClick={close}
                    className="flex h-12 items-center text-[17px] font-medium text-foreground transition-colors hover:text-accent"
                  >
                    {item.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <LanguageList locale={locale} label={labels.language} />
            <ThemeSwitcher labels={themeLabels} />
          </div>
          <AppLink
            href={cta.href}
            onClick={close}
            className="bg-brand-ink mt-5 flex h-12 items-center justify-center rounded-full text-base font-medium text-white shadow-soft"
          >
            {cta.label}
          </AppLink>
        </div>
      </div>
    </div>
  )
}
