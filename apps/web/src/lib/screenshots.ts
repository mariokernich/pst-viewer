import type { Locale } from './i18n'

/**
 * Product screenshots. Until real images exist, every entry renders a styled
 * placeholder in the matching device frame.
 *
 * To add a screenshot, put the file into `public/screenshots/` and set `src`
 * for each locale (e.g. `'/screenshots/mac-main-de.png'`). Keep the pixel size
 * in `width`/`height` in sync with the file – it defines the aspect ratio of
 * the frame. Desktop screenshots are full window captures without the drop
 * shadow (macOS: `screencapture -o -w`), mobile screenshots are plain screen
 * captures; the device bezel is drawn by the site.
 */

export type ScreenshotId = 'macMain' | 'windowsMain' | 'iphone' | 'ipad' | 'android'

export type ScreenshotKind = 'mac' | 'windows' | 'phone' | 'tablet'

export interface ScreenshotSpec {
  kind: ScreenshotKind
  width: number
  height: number
  src: Record<Locale, string | null>
  alt: Record<Locale, string>
}

export const screenshots: Record<ScreenshotId, ScreenshotSpec> = {
  macMain: {
    kind: 'mac',
    width: 2560,
    height: 1600,
    // TODO: add the Mac screenshots, e.g. '/screenshots/mac-main-de.png'.
    src: { de: null, en: null },
    alt: {
      de: 'PST Viewer auf dem Mac mit Ordnerliste, Nachrichtenliste und Lesebereich',
      en: 'PST Viewer on the Mac with folder list, message list and reading pane',
    },
  },
  windowsMain: {
    kind: 'windows',
    width: 2560,
    height: 1600,
    // TODO: add the Windows screenshots.
    src: { de: null, en: null },
    alt: {
      de: 'PST Viewer unter Windows mit geöffnetem Postfach',
      en: 'PST Viewer on Windows with an open mailbox',
    },
  },
  iphone: {
    kind: 'phone',
    width: 1206,
    height: 2622,
    // TODO: add the iPhone screenshots once the app is available.
    src: { de: null, en: null },
    alt: {
      de: 'PST Viewer auf dem iPhone mit der Nachrichtenliste',
      en: 'PST Viewer on the iPhone showing the message list',
    },
  },
  ipad: {
    kind: 'tablet',
    width: 2752,
    height: 2064,
    // TODO: add the iPad screenshots once the app is available.
    src: { de: null, en: null },
    alt: {
      de: 'PST Viewer auf dem iPad mit Nachrichtenliste und Lesebereich',
      en: 'PST Viewer on the iPad with message list and reading pane',
    },
  },
  android: {
    kind: 'phone',
    width: 1080,
    height: 2400,
    // TODO: add the Android screenshots once the app is available.
    src: { de: null, en: null },
    alt: {
      de: 'PST Viewer auf einem Android-Smartphone mit der Nachrichtenliste',
      en: 'PST Viewer on an Android phone showing the message list',
    },
  },
}
