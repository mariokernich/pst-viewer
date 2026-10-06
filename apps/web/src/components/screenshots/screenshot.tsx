import { ImageIcon } from 'lucide-react'
import Image from 'next/image'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { screenshots, type ScreenshotId, type ScreenshotKind } from '@/lib/screenshots'

interface ScreenshotProps {
  id: ScreenshotId
  locale: Locale
  /** Visible label of the placeholder, e.g. "Screenshot folgt". */
  placeholderLabel: string
  /** `sizes` attribute for the responsive image. */
  sizes: string
  /** Preload the image (use for the LCP image only). */
  preload?: boolean
  /** Horizontal position of the placeholder label (e.g. `start` when the right side is covered). */
  labelAlign?: 'center' | 'start'
  className?: string
}

/**
 * Renders a product screenshot from `lib/screenshots.ts`, or a placeholder
 * with the same aspect ratio as long as no image is configured.
 */
export function Screenshot({
  id,
  locale,
  placeholderLabel,
  sizes,
  preload = false,
  labelAlign = 'center',
  className,
}: ScreenshotProps) {
  const spec = screenshots[id]
  const src = spec.src[locale]

  if (src) {
    return (
      <Image
        src={src}
        alt={spec.alt[locale]}
        width={spec.width}
        height={spec.height}
        sizes={sizes}
        preload={preload}
        className={cn('block h-auto w-full', className)}
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={`${placeholderLabel}: ${spec.alt[locale]}`}
      className={cn('@container relative w-full overflow-hidden select-none', className)}
      style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
    >
      <Skeleton kind={spec.kind} />
      {/* Phones are often shown cropped, so their label sits in the upper part. */}
      <div
        className={cn(
          'absolute inset-0 grid p-3',
          spec.kind === 'phone' ? 'items-start pt-[42%]' : 'items-center',
          labelAlign === 'start' ? 'justify-items-start pl-[7%]' : 'justify-items-center',
        )}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card/90 p-2 text-xs font-medium whitespace-nowrap text-muted shadow-soft backdrop-blur @[11rem]:px-3 @[11rem]:py-1.5 @[24rem]:text-sm">
          <ImageIcon className="size-3.5 @[24rem]:size-4" aria-hidden="true" />
          {/* Very narrow frames only show the icon; the full text is in the aria-label. */}
          <span className="hidden @[11rem]:inline">{placeholderLabel}</span>
        </span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Skeleton UI that hints at the app layout. All sizes use container query
 * units (cqw) so the placeholder scales like an image.
 * ------------------------------------------------------------------------ */

function Bar({ width, height = 1.1, className }: { width: string; height?: number; className?: string }) {
  const style: CSSProperties = { width, height: `${height}cqw` }
  return <span className={cn('block shrink-0 rounded-full bg-foreground/[0.08]', className)} style={style} />
}

function Lights() {
  return (
    <span className="flex gap-[0.7cqw]">
      {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
        <span key={color} className="block size-[1.1cqw] rounded-full" style={{ background: color }} />
      ))}
    </span>
  )
}

const listRows = [
  ['58%', '82%', '64%'],
  ['46%', '70%', '88%'],
  ['62%', '76%', '58%'],
  ['40%', '84%', '72%'],
  ['54%', '66%', '80%'],
  ['48%', '78%', '62%'],
]

function DesktopSkeleton({ platform }: { platform: 'mac' | 'windows' }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex bg-card">
      {/* Sidebar */}
      <div className="flex w-[21%] flex-col gap-[1.6cqw] border-r border-line bg-card-muted p-[1.6cqw]">
        {platform === 'mac' ? <Lights /> : <Bar width="55%" height={1} />}
        <div className="mt-[1cqw] flex flex-col gap-[1.3cqw]">
          {['70%', '52%', '64%', '44%', '58%', '48%', '62%'].map((width, index) => (
            <span key={index} className="flex items-center gap-[0.8cqw]">
              <span className="block size-[1.2cqw] shrink-0 rounded-[0.3cqw] bg-accent/25" />
              <Bar width={width} height={0.9} />
            </span>
          ))}
        </div>
      </div>
      {/* Message list */}
      <div className="flex w-[31%] flex-col border-r border-line p-[1.4cqw]">
        <span className="block h-[2.6cqw] rounded-[0.8cqw] bg-foreground/[0.06]" />
        <Bar width="26%" height={0.8} className="mt-[1.8cqw] bg-accent/30" />
        <div className="mt-[1cqw] flex flex-col">
          {listRows.map(([a, b, c], index) => (
            <span
              key={index}
              className={cn(
                'flex flex-col gap-[0.6cqw] rounded-[0.8cqw] p-[0.9cqw]',
                index === 0 && 'bg-accent/[0.12]',
              )}
            >
              <Bar width={a ?? '50%'} height={0.95} className="bg-foreground/[0.14]" />
              <Bar width={b ?? '70%'} height={0.8} />
              <Bar width={c ?? '60%'} height={0.8} />
            </span>
          ))}
        </div>
      </div>
      {/* Reading pane */}
      <div className="flex flex-1 flex-col p-[2.4cqw]">
        {platform === 'windows' ? (
          <span className="mb-[1.2cqw] flex justify-end gap-[2.2cqw] text-[1.2cqw] leading-none text-subtle">
            <span>—</span>
            <span>▢</span>
            <span>✕</span>
          </span>
        ) : null}
        <Bar width="62%" height={1.6} className="bg-foreground/[0.14]" />
        <span className="mt-[1.8cqw] flex items-center gap-[1cqw]">
          <span className="block size-[3.4cqw] rounded-full bg-gradient-to-br from-brand-from/50 to-brand-to/50" />
          <span className="flex flex-1 flex-col gap-[0.7cqw]">
            <Bar width="34%" height={0.95} className="bg-foreground/[0.14]" />
            <Bar width="52%" height={0.8} />
          </span>
        </span>
        <span className="mt-[2.4cqw] flex flex-col gap-[1cqw]">
          {['96%', '92%', '88%', '94%', '58%'].map((width, index) => (
            <Bar key={index} width={width} height={0.85} />
          ))}
        </span>
        <span className="mt-[2cqw] flex flex-col gap-[1cqw]">
          {['90%', '94%', '72%'].map((width, index) => (
            <Bar key={index} width={width} height={0.85} />
          ))}
        </span>
        <span className="mt-auto flex gap-[1cqw]">
          <span className="block h-[4cqw] w-[22%] rounded-[0.8cqw] border border-line bg-card-muted" />
          <span className="block h-[4cqw] w-[22%] rounded-[0.8cqw] border border-line bg-card-muted" />
        </span>
      </div>
    </div>
  )
}

function PhoneSkeleton() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col bg-card px-[6cqw] pt-[16cqw]">
      <Bar width="48%" height={5} className="bg-foreground/[0.14]" />
      <span className="mt-[5cqw] block h-[9cqw] rounded-[3cqw] bg-foreground/[0.06]" />
      <Bar width="22%" height={2.6} className="mt-[7cqw] bg-accent/30" />
      <div className="mt-[3cqw] flex flex-col gap-[5.5cqw]">
        {listRows.map(([a, b], index) => (
          <span key={index} className="flex items-center gap-[3.5cqw]">
            <span className="block size-[9cqw] shrink-0 rounded-full bg-gradient-to-br from-brand-from/40 to-brand-to/40" />
            <span className="flex flex-1 flex-col gap-[2cqw]">
              <Bar width={a ?? '50%'} height={2.8} className="bg-foreground/[0.14]" />
              <Bar width={b ?? '70%'} height={2.4} />
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function TabletSkeleton() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex bg-card">
      <div className="flex w-[36%] flex-col border-r border-line p-[2.2cqw] pt-[3.4cqw]">
        <Bar width="46%" height={2} className="bg-foreground/[0.14]" />
        <span className="mt-[2cqw] block h-[3.6cqw] rounded-[1.2cqw] bg-foreground/[0.06]" />
        <div className="mt-[2cqw] flex flex-col gap-[0.6cqw]">
          {listRows.slice(0, 5).map(([a, b], index) => (
            <span
              key={index}
              className={cn('flex flex-col gap-[0.9cqw] rounded-[1.2cqw] p-[1.2cqw]', index === 0 && 'bg-accent/[0.12]')}
            >
              <Bar width={a ?? '50%'} height={1.3} className="bg-foreground/[0.14]" />
              <Bar width={b ?? '70%'} height={1.1} />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-[3.4cqw]">
        <Bar width="58%" height={2.2} className="bg-foreground/[0.14]" />
        <span className="mt-[2.4cqw] flex items-center gap-[1.4cqw]">
          <span className="block size-[4.6cqw] rounded-full bg-gradient-to-br from-brand-from/50 to-brand-to/50" />
          <span className="flex flex-1 flex-col gap-[1cqw]">
            <Bar width="32%" height={1.3} className="bg-foreground/[0.14]" />
            <Bar width="48%" height={1.1} />
          </span>
        </span>
        <span className="mt-[3cqw] flex flex-col gap-[1.4cqw]">
          {['94%', '90%', '96%', '84%', '62%', '92%', '88%'].map((width, index) => (
            <Bar key={index} width={width} height={1.1} />
          ))}
        </span>
      </div>
    </div>
  )
}

function Skeleton({ kind }: { kind: ScreenshotKind }) {
  switch (kind) {
    case 'mac':
      return <DesktopSkeleton platform="mac" />
    case 'windows':
      return <DesktopSkeleton platform="windows" />
    case 'phone':
      return <PhoneSkeleton />
    case 'tablet':
      return <TabletSkeleton />
  }
}
