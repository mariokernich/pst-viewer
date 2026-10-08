/**
 * Site-wide configuration: URLs, owner, GitHub links, downloads and stores.
 * This module is imported by client components, so it must stay free of
 * server-only imports.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000'

/**
 * Public URL of the site without trailing slash, including the base path
 * (e.g. `https://mariokernich.github.io/pst-viewer`). From `NEXT_PUBLIC_SITE_URL`.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')

/**
 * Path prefix of the site (e.g. `/pst-viewer`), empty when served at the root.
 * From `NEXT_PUBLIC_BASE_PATH`, the same value `next.config.ts` uses.
 */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '')

/**
 * Prefixes a root-relative path with the base path. Only needed where Next.js
 * does not do it itself: plain `<a>`/`<img>` elements and public assets
 * (`next/link` and metadata files already include the base path).
 */
export function withBasePath(path: string): string {
  return path.startsWith('/') ? `${basePath}${path}` : path
}

/** Absolute URL of a path of this site (for canonical URLs, sitemap, JSON-LD). */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export const siteConfig = {
  name: 'PST Viewer',
  owner: 'Mario Kernich',
  license: 'MIT',
} as const

const repoUrl = 'https://github.com/mariokernich/pst-viewer'

/** Links into the public GitHub repository. */
export const github = {
  repo: repoUrl,
  releases: `${repoUrl}/releases`,
  latestRelease: `${repoUrl}/releases/latest`,
  issues: `${repoUrl}/issues`,
  newIssue: `${repoUrl}/issues/new`,
  pulls: `${repoUrl}/pulls`,
  license: `${repoUrl}/blob/main/LICENSE`,
  iosSource: `${repoUrl}/tree/main/apps/ios`,
} as const

/* ---------------------------------------------------------------------------
 * Downloads (GitHub Releases)
 * ------------------------------------------------------------------------ */

export type DownloadPlatform = 'mac' | 'windows' | 'linux' | 'android'

export type DownloadId = 'macArm64' | 'macX64' | 'windowsX64' | 'windowsArm64' | 'linuxAppImage' | 'linuxDeb' | 'android'

export interface Download {
  id: DownloadId
  platform: DownloadPlatform
  /** Asset name; identical in every release, so the `latest/download` URL always works. */
  file: string
  url: string
}

function download(id: DownloadId, platform: DownloadPlatform, file: string): Download {
  return { id, platform, file, url: `${repoUrl}/releases/latest/download/${file}` }
}

export const downloads: Record<DownloadId, Download> = {
  macArm64: download('macArm64', 'mac', 'PST-Viewer-mac-arm64.dmg'),
  macX64: download('macX64', 'mac', 'PST-Viewer-mac-x64.dmg'),
  windowsX64: download('windowsX64', 'windows', 'PST-Viewer-windows-x64-setup.exe'),
  windowsArm64: download('windowsArm64', 'windows', 'PST-Viewer-windows-arm64-setup.exe'),
  linuxAppImage: download('linuxAppImage', 'linux', 'PST-Viewer-linux-x86_64.AppImage'),
  linuxDeb: download('linuxDeb', 'linux', 'PST-Viewer-linux-amd64.deb'),
  android: download('android', 'android', 'PST-Viewer-android.apk'),
}

/** Downloads grouped by platform, in display order. */
export const downloadGroups: Array<{ platform: DownloadPlatform; ids: DownloadId[] }> = [
  { platform: 'mac', ids: ['macArm64', 'macX64'] },
  { platform: 'windows', ids: ['windowsX64', 'windowsArm64'] },
  { platform: 'linux', ids: ['linuxAppImage', 'linuxDeb'] },
  { platform: 'android', ids: ['android'] },
]

/* ---------------------------------------------------------------------------
 * Stores (an additional, free channel)
 * ------------------------------------------------------------------------ */

export type StoreId = 'macAppStore' | 'microsoftStore' | 'appStore' | 'googlePlay'

export type PlatformId = 'mac' | 'windows' | 'ios' | 'android'

export interface Store {
  id: StoreId
  platform: PlatformId
  /** Store name as shown on the button (not translated). */
  name: string
  /**
   * `true` once the app is listed in this store. Unavailable stores are
   * rendered as non-interactive "coming soon" buttons.
   */
  available: boolean
  url: string
}

export const stores: Record<StoreId, Store> = {
  macAppStore: {
    id: 'macAppStore',
    platform: 'mac',
    name: 'Mac App Store',
    // TODO: set to true once Apple has approved the app (in review since 2026-10-08).
    available: false,
    // Same App Store record for iPhone, iPad and Mac.
    url: 'https://apps.apple.com/app/id6820516765',
  },
  microsoftStore: {
    id: 'microsoftStore',
    platform: 'windows',
    name: 'Microsoft Store',
    // TODO: set to true and add the product URL once the app is listed.
    available: false,
    url: '#',
  },
  appStore: {
    id: 'appStore',
    platform: 'ios',
    name: 'App Store',
    // TODO: set to true once Apple has approved the app (in review since 2026-10-08).
    available: false,
    // Same App Store record for iPhone, iPad and Mac.
    url: 'https://apps.apple.com/app/id6820516765',
  },
  googlePlay: {
    id: 'googlePlay',
    platform: 'android',
    name: 'Google Play',
    // TODO: set to true and add the product URL once the Android app is listed.
    available: false,
    url: '#',
  },
}

export const storeOrder: StoreId[] = ['macAppStore', 'microsoftStore', 'appStore', 'googlePlay']
