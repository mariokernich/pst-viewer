import { Laptop, Monitor, Smartphone, TabletSmartphone, type LucideIcon } from 'lucide-react'
import { common } from '@/content/common'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { stores, type PlatformId, type StoreId } from '@/lib/site'

/** Generic device icons – deliberately no store or platform trademarks. */
const platformIcons: Record<PlatformId, LucideIcon> = {
  mac: Laptop,
  windows: Monitor,
  ios: TabletSmartphone,
  android: Smartphone,
}

/**
 * Neutral store button (no official badge artwork). Stores that are not
 * available yet render as a non-interactive "coming soon" button.
 * Store URLs and availability are configured in `lib/site.ts`.
 */
export function StoreButton({ storeId, locale, className }: { storeId: StoreId; locale: Locale; className?: string }) {
  const store = stores[storeId]
  const t = common[locale].store
  const Icon = platformIcons[store.platform]

  const content = (
    <>
      <Icon className="size-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="flex min-w-0 flex-col items-start text-left leading-tight">
        <span className="text-[11px] font-medium opacity-75">
          {store.available ? t.prefix[storeId] : t.comingSoon}
        </span>
        <span className="text-[15px] font-semibold tracking-tight">{store.name}</span>
      </span>
    </>
  )

  const base = 'inline-flex h-14 min-w-[11.5rem] items-center gap-3 rounded-2xl px-4'

  if (!store.available) {
    return (
      <span className={cn(base, 'border border-dashed border-line-strong text-muted', className)}>{content}</span>
    )
  }

  return (
    <a
      href={store.url}
      className={cn(
        base,
        'bg-foreground text-background shadow-soft transition-[transform,opacity] duration-200 hover:opacity-90 active:scale-[0.98]',
        className,
      )}
    >
      {content}
    </a>
  )
}
