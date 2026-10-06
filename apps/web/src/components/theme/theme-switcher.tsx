'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useId } from 'react'
import { cn } from '@/lib/cn'
import { useHydrated } from '@/lib/use-hydrated'

export interface ThemeLabels {
  label: string
  system: string
  light: string
  dark: string
}

const options = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

/**
 * System / light / dark selector built from native radio buttons, so it is
 * fully keyboard operable (Tab into the group, arrow keys to change).
 */
export function ThemeSwitcher({ labels, className }: { labels: ThemeLabels; className?: string }) {
  const { theme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const name = useId()
  // The stored theme is unknown during server rendering – nothing is checked until hydration.
  const current = hydrated ? (theme ?? 'system') : null

  return (
    <fieldset
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-line bg-card-muted/70 p-0.5',
        className,
      )}
    >
      <legend className="sr-only">{labels.label}</legend>
      {options.map(({ value, icon: Icon }) => (
        <label
          key={value}
          title={labels[value]}
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-ring"
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={current === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          <Icon className="size-4" aria-hidden="true" />
          <span className="sr-only">{labels[value]}</span>
        </label>
      ))}
    </fieldset>
  )
}
