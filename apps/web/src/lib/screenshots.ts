import type { Locale } from './i18n'

/**
 * Product screenshots (fictional demo data). The PNG files live in the
 * repository's `docs/screenshots/` folder; `scripts/copy-screenshots.mjs`
 * copies them into `public/screenshots/` before `dev` and `build` and records
 * their real pixel size. A screenshot whose file is missing renders a styled
 * placeholder with the fallback size below, so the build never breaks.
 *
 * Desktop screenshots are the window content without title bar and shadow
 * (the site draws the frame and traffic lights); mobile screenshots are plain
 * screen captures (the site draws the device bezel).
 */

export type ScreenshotId = 'desktopLight' | 'desktopDark' | 'iphone' | 'ipad' | 'android'

export type ScreenshotKind = 'desktop' | 'phone' | 'tablet'

export interface ScreenshotSpec {
  kind: ScreenshotKind
  /** File name in `docs/screenshots/` without `.png`, per locale. */
  file: Record<Locale, string>
  /** Size used for the placeholder when the file does not exist. */
  fallbackSize: { width: number; height: number }
  alt: Record<Locale, string>
}

const perLocale = (name: string): Record<Locale, string> => ({ de: `${name}-de`, en: `${name}-en` })

export const screenshots: Record<ScreenshotId, ScreenshotSpec> = {
  desktopLight: {
    kind: 'desktop',
    file: perLocale('desktop-light'),
    fallbackSize: { width: 2880, height: 1800 },
    alt: {
      de: 'PST Viewer am Desktop im hellen Design mit Ordnerliste, Nachrichtenliste und Lesebereich',
      en: 'PST Viewer on the desktop in light mode with folder list, message list and reading pane',
    },
  },
  desktopDark: {
    kind: 'desktop',
    file: perLocale('desktop-dark'),
    fallbackSize: { width: 2880, height: 1800 },
    alt: {
      de: 'PST Viewer am Desktop im dunklen Design mit Ordnerliste, Nachrichtenliste und Lesebereich',
      en: 'PST Viewer on the desktop in dark mode with folder list, message list and reading pane',
    },
  },
  iphone: {
    kind: 'phone',
    file: perLocale('iphone'),
    fallbackSize: { width: 1206, height: 2622 },
    alt: {
      de: 'PST Viewer auf dem iPhone mit der Nachrichtenliste',
      en: 'PST Viewer on the iPhone showing the message list',
    },
  },
  ipad: {
    kind: 'tablet',
    file: perLocale('ipad'),
    fallbackSize: { width: 2064, height: 2752 },
    alt: {
      de: 'PST Viewer auf dem iPad mit Ordnern, Nachrichtenliste und Lesebereich',
      en: 'PST Viewer on the iPad with folders, message list and reading pane',
    },
  },
  android: {
    kind: 'phone',
    file: perLocale('android'),
    fallbackSize: { width: 1344, height: 2992 },
    alt: {
      de: 'PST Viewer auf einem Android-Smartphone mit der Nachrichtenliste',
      en: 'PST Viewer on an Android phone showing the message list',
    },
  },
}
