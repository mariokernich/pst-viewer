import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** macOS style segmented control. */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'md', className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex rounded-[9px] bg-fill p-0.5', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex-1 rounded-[7px] px-2.5 font-medium whitespace-nowrap transition-all duration-150',
              size === 'sm' ? 'h-6 text-[11.5px]' : 'h-7 text-[12px]',
              selected ? 'bg-surface-raised text-fg shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)]' : 'text-fg-muted hover:text-fg'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  icon?: LucideIcon
  children: ReactNode
  onRemove?: () => void
  removeLabel?: string
  title?: string
}

/** Toggle chip used for filters. */
export function Chip({ selected, onClick, icon: Icon, children, onRemove, removeLabel, title }: ChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex h-7 items-center rounded-full text-[12px] font-medium transition-colors duration-150',
        selected ? 'bg-accent/14 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]' : 'bg-fill text-fg hover:bg-fill-strong'
      )}
      title={title}
    >
      <button type="button" onClick={onClick} aria-pressed={onClick ? !!selected : undefined} className={clsx('inline-flex h-full items-center gap-1.5', onRemove ? 'pr-1 pl-3' : 'px-3')}>
        {Icon && <Icon className="size-3.5" strokeWidth={2} aria-hidden />}
        <span className="max-w-[220px] truncate">{children}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          title={removeLabel}
          className="mr-1 inline-flex size-5 items-center justify-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/15"
        >
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-surface-raised px-1 font-sans text-[10.5px] font-medium text-fg-muted">
      {children}
    </kbd>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('animate-spin', className ?? 'size-4')} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('text-[11px] font-semibold tracking-wide text-fg-muted uppercase', className)}>{children}</div>
}
