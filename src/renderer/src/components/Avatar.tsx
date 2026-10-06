import clsx from 'clsx'
import { avatarGradient, initials } from '@/lib/people'

export function Avatar({ name, email, size = 36, className }: { name: string; email: string; size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx('flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.12)]', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: avatarGradient(email || name || '?') }}
    >
      {initials(name, email)}
    </div>
  )
}
