'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { detectArchitecture, detectPlatform, recommendedDownload, type Architecture, type VisitorPlatform } from './platform'
import type { DownloadId } from './site'

const subscribe = () => () => {}

/**
 * Platform and recommended download of the visitor. Both are `null` during
 * server rendering and hydration, so the server HTML stays the generic
 * fallback and there is no hydration mismatch.
 */
export function useRecommendedDownload(): { platform: VisitorPlatform | null; download: DownloadId | null } {
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => null)
  const [arch, setArch] = useState<Architecture | null>(null)

  useEffect(() => {
    if (!platform || platform === 'android' || platform === 'ios') return
    let active = true
    detectArchitecture().then((value) => {
      if (active) setArch(value)
    })
    return () => {
      active = false
    }
  }, [platform])

  return { platform, download: platform ? recommendedDownload(platform, arch) : null }
}
