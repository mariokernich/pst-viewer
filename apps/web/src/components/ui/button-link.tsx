import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { AppLink, type AppLinkProps } from './app-link'

const variants = {
  primary:
    'bg-brand-ink text-white shadow-[0_8px_24px_-8px_rgb(61_90_255/0.55)] hover:brightness-110 hover:shadow-[0_10px_28px_-8px_rgb(61_90_255/0.7)]',
  secondary: 'border border-line-strong bg-card text-foreground shadow-soft hover:bg-card-muted',
  ghost: 'text-foreground hover:bg-card-muted',
} as const

const sizes = {
  sm: 'h-9 gap-1.5 px-4 text-sm',
  md: 'h-11 gap-2 px-5 text-[15px]',
  lg: 'h-12 gap-2 px-6 text-base',
} as const

type ButtonLinkProps = Omit<AppLinkProps, 'className'> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  className?: string
  children: ReactNode
}

/** A link styled as a button. */
export function ButtonLink({ variant = 'primary', size = 'md', className, children, ...props }: ButtonLinkProps) {
  return (
    <AppLink
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-[filter,box-shadow,background-color,transform] duration-200 active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </AppLink>
  )
}
