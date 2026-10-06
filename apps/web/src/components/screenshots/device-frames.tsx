import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Device frames for screenshots. Desktop screenshots already contain the
 * window chrome, so the window frame only adds the rounded outline and shadow.
 * Phone and tablet frames draw the device bezel around the screen.
 */

export function WindowFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line-strong bg-card shadow-window sm:rounded-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PhoneFrame({
  children,
  variant,
  className,
}: {
  children: ReactNode
  variant: 'iphone' | 'android'
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-zinc-900 p-2 shadow-window ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10',
        variant === 'iphone' ? 'rounded-[2.6rem]' : 'rounded-[2.2rem]',
        className,
      )}
    >
      <div
        className={cn('relative overflow-hidden bg-card', variant === 'iphone' ? 'rounded-[2.15rem]' : 'rounded-[1.8rem]')}
      >
        {children}
        {variant === 'iphone' ? (
          <span aria-hidden="true" className="absolute top-[1.6%] left-1/2 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
        ) : (
          <span aria-hidden="true" className="absolute top-[1.6%] left-1/2 aspect-square w-[4.5%] -translate-x-1/2 rounded-full bg-black" />
        )}
      </div>
    </div>
  )
}

export function TabletFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[1.6rem] bg-zinc-900 p-2.5 shadow-window ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.1rem] bg-card">{children}</div>
    </div>
  )
}
