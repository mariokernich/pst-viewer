'use client'

import { Download } from 'lucide-react'
import { AppLink } from '@/components/ui/app-link'
import { cn } from '@/lib/cn'
import { downloads, type DownloadId, type DownloadPlatform } from '@/lib/site'
import { useRecommendedDownload } from '@/lib/use-recommended-download'

export interface DownloadCtaLabels {
  cta: string
  ctaFor: Record<DownloadPlatform, string>
  items: Record<DownloadId, { label: string }>
}

/**
 * Primary download button. The server renders a generic button that links to
 * the downloads section; in the browser it becomes a direct download of the
 * build that matches the visitor's platform.
 */
export function DownloadCta({
  labels,
  fallbackHref,
  className,
  detailClassName,
}: {
  labels: DownloadCtaLabels
  /** Link to the downloads section (used without JavaScript or for unknown platforms). */
  fallbackHref: string
  className?: string
  detailClassName?: string
}) {
  const { download } = useRecommendedDownload()
  const target = download ? downloads[download] : null

  return (
    <AppLink href={target ? target.url : fallbackHref} className={className}>
      <Download className="size-4 shrink-0" aria-hidden="true" />
      {target ? (
        <>
          <span>{labels.ctaFor[target.platform]}</span>
          <span className={cn('font-normal opacity-80', detailClassName)}>· {labels.items[target.id].label}</span>
        </>
      ) : (
        <span>{labels.cta}</span>
      )}
    </AppLink>
  )
}
