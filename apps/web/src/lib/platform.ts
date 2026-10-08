import type { DownloadId } from './site'

/**
 * Client-side detection of the visitor's platform, used to highlight the
 * matching download (progressive enhancement: the server-rendered page links
 * to the downloads section instead). Nothing is stored or sent anywhere.
 */

export type VisitorPlatform = 'mac' | 'windows' | 'linux' | 'android' | 'ios'

export type Architecture = 'arm' | 'x86'

interface UserAgentData {
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>
}

function userAgentData(): UserAgentData | undefined {
  return (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
}

/** The visitor's operating system, or `null` if unknown (e.g. ChromeOS). Browser only. */
export function detectPlatform(): VisitorPlatform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  const platform = (userAgentData()?.platform || navigator.platform || '').toLowerCase()

  if (platform === 'android' || /android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/.test(platform) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/mac/.test(platform) || /mac os x/i.test(ua)) return 'mac'
  if (/win/.test(platform) || /windows/i.test(ua)) return 'windows'
  if (/cros/i.test(ua) || platform === 'chrome os') return null
  if (/linux/.test(platform) || /linux/i.test(ua)) return 'linux'
  return null
}

/**
 * CPU architecture from User-Agent Client Hints (Chromium-based browsers
 * only), or from the user agent string where it is reliable. `null` if unknown.
 */
export async function detectArchitecture(): Promise<Architecture | null> {
  if (typeof navigator === 'undefined') return null
  if (/aarch64|arm64|armv\d/i.test(navigator.userAgent)) return 'arm'
  try {
    const values = await userAgentData()?.getHighEntropyValues?.(['architecture'])
    if (values?.architecture === 'arm') return 'arm'
    if (values?.architecture === 'x86') return 'x86'
  } catch {
    // Client hints unavailable or refused – fall back to the defaults below.
  }
  return null
}

/**
 * The download to recommend. Without a known architecture, Macs get the Apple
 * Silicon build (every Mac sold since 2021) and Windows PCs the x64 installer;
 * the other builds stay one click away in the downloads section.
 */
export function recommendedDownload(platform: VisitorPlatform, arch: Architecture | null): DownloadId | null {
  switch (platform) {
    case 'mac':
      return arch === 'x86' ? 'macX64' : 'macArm64'
    case 'windows':
      return arch === 'arm' ? 'windowsArm64' : 'windowsX64'
    case 'linux':
      // There is no ARM build for Linux yet.
      return arch === 'arm' ? null : 'linuxAppImage'
    case 'android':
      return 'android'
    case 'ios':
      return null
  }
}
