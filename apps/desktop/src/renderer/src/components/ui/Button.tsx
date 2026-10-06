import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  children?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-sm hover:brightness-110 active:brightness-95',
  secondary: 'bg-fill text-fg hover:bg-fill-strong',
  ghost: 'text-fg hover:bg-hover active:bg-fill',
  danger: 'text-danger hover:bg-danger/10'
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-lg',
  md: 'h-8 px-3 text-[13px] gap-2 rounded-[9px]',
  lg: 'h-10 px-4 text-[14px] gap-2 rounded-xl'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,filter,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'lg' ? 'size-[18px]' : 'size-4'} strokeWidth={1.9} aria-hidden />}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  active?: boolean
  size?: 'sm' | 'md'
  badge?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, active, size = 'md', badge, className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35',
        size === 'sm' ? 'size-7' : 'size-8',
        active ? 'bg-fill text-accent' : 'text-fg-muted hover:bg-hover hover:text-fg active:bg-fill',
        className
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-[15px]' : 'size-[17px]'} strokeWidth={1.8} aria-hidden />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg">
          {badge}
        </span>
      )}
    </button>
  )
})
