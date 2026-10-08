'use client'

import { ArrowDownToLine, Sparkles } from 'lucide-react'
import { buttonClassName } from '@/components/ui/button-link'
import { downloads, type DownloadId, type DownloadPlatform } from '@/lib/site'
import { useRecommendedDownload } from '@/lib/use-recommended-download'

export interface RecommendedDownloadLabels {
  recommended: string
  ctaFor: Record<DownloadPlatform, string>
  platformNames: Record<DownloadPlatform, string>
  items: Record<DownloadId, { label: string; detail: string }>
}

/**
 * Highlights the build for the visitor's platform above the list of all
 * downloads. Renders nothing on the server or when the platform is unknown.
 */
export function RecommendedDownload({ labels }: { labels: RecommendedDownloadLabels }) {
  const { download } = useRecommendedDownload()
  if (!download) return null
  const target = downloads[download]
  const item = labels.items[target.id]

  return (
    <div className="bg-brand mx-auto mt-12 max-w-3xl rounded-3xl p-px shadow-window">
      <div className="flex flex-col gap-5 rounded-[calc(1.5rem-1px)] bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Sparkles className="size-4" aria-hidden="true" />
            {labels.recommended}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {labels.platformNames[target.platform]} · {item.label}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">
            {item.detail} · <span className="font-mono text-[13px]">{target.file}</span>
          </p>
        </div>
        <a href={target.url} className={buttonClassName('primary', 'lg')}>
          <ArrowDownToLine className="size-4" aria-hidden="true" />
          {labels.ctaFor[target.platform]}
        </a>
      </div>
    </div>
  )
}
