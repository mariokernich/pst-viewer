import type { Locale } from '@/lib/i18n'
import type { DownloadId, DownloadPlatform, StoreId } from '@/lib/site'

export interface CommonContent {
  meta: {
    defaultTitle: string
    description: string
  }
  skipToContent: string
  nav: {
    label: string
    features: string
    platforms: string
    openSource: string
    download: string
    docs: string
    faq: string
  }
  header: {
    home: string
    cta: string
    /** Visible text of the GitHub link. */
    github: string
    /** Accessible name / tooltip of the GitHub link. */
    githubLabel: string
    openMenu: string
    closeMenu: string
  }
  language: {
    label: string
    /** Accessible label of the header switch, in the target language. */
    switchTo: string
  }
  theme: {
    label: string
    system: string
    light: string
    dark: string
  }
  store: {
    /** Small line above the store name, e.g. "Laden im". */
    prefix: Record<StoreId, string>
    comingSoon: string
  }
  download: {
    /** Generic call to action (server-rendered default, links to the downloads section). */
    cta: string
    /** Call to action once the visitor's platform is known. */
    ctaFor: Record<DownloadPlatform, string>
    platformNames: Record<DownloadPlatform | 'ios', string>
    items: Record<DownloadId, { label: string; detail: string }>
    /** Line below the hero buttons, e.g. "Apple Silicon · .dmg". */
    otherVersions: string
    recommended: string
    /** Accessible suffix for links to github.com. */
    external: string
  }
  openSourceBadge: string
  screenshot: {
    placeholder: string
  }
  footer: {
    tagline: string
    product: string
    documentation: string
    legal: string
    openSource: string
    sourceCode: string
    releases: string
    issues: string
    license: string
    legalNotice: string
    privacy: string
    language: string
    appearance: string
    copyright: (year: number) => string
    madeWith: string
    trademarks: string
  }
  notFound: {
    eyebrow: string
    title: string
    text: string
    home: string
    docs: string
  }
  /** Language chooser of the root page (`/`), shown while redirecting or without JavaScript. */
  root: {
    title: string
    text: string
    action: string
  }
}

const de: CommonContent = {
  meta: {
    defaultTitle: 'PST Viewer – Outlook-Archive öffnen, ohne Outlook',
    description:
      'PST Viewer öffnet PST-, MSG-, EML- und MBOX-Dateien schnell, streng schreibgeschützt und komplett lokal. Kostenlos und Open Source (MIT) – für Mac, Windows, Linux und Android.',
  },
  skipToContent: 'Zum Inhalt springen',
  nav: {
    label: 'Hauptnavigation',
    features: 'Funktionen',
    platforms: 'Plattformen',
    openSource: 'Open Source',
    download: 'Download',
    docs: 'Doku',
    faq: 'FAQ',
  },
  header: {
    home: 'PST Viewer – zur Startseite',
    cta: 'Download',
    github: 'GitHub',
    githubLabel: 'Quellcode von PST Viewer auf GitHub',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
  },
  language: {
    label: 'Sprache',
    switchTo: 'Switch to English',
  },
  theme: {
    label: 'Darstellung',
    system: 'System',
    light: 'Hell',
    dark: 'Dunkel',
  },
  store: {
    prefix: {
      macAppStore: 'Laden im',
      microsoftStore: 'Herunterladen im',
      appStore: 'Laden im',
      googlePlay: 'Jetzt bei',
    },
    comingSoon: 'Demnächst – kostenlos',
  },
  download: {
    cta: 'Kostenlos herunterladen',
    ctaFor: {
      mac: 'Für macOS herunterladen',
      windows: 'Für Windows herunterladen',
      linux: 'Für Linux herunterladen',
      android: 'Für Android herunterladen',
    },
    platformNames: { mac: 'macOS', windows: 'Windows', linux: 'Linux', android: 'Android', ios: 'iPhone & iPad' },
    items: {
      macArm64: { label: 'Apple Silicon', detail: 'M1 oder neuer · .dmg' },
      macX64: { label: 'Intel', detail: 'Ältere Macs mit Intel-Prozessor · .dmg' },
      windowsX64: { label: 'x64', detail: 'Die meisten Windows-PCs · Installer (.exe)' },
      windowsArm64: { label: 'ARM64', detail: 'z. B. Snapdragon-Notebooks · Installer (.exe)' },
      linuxAppImage: { label: 'AppImage', detail: 'Für die meisten Distributionen · x86_64' },
      linuxDeb: { label: 'Debian / Ubuntu', detail: 'Paket (.deb) · amd64' },
      android: { label: 'APK', detail: 'Smartphones und Tablets · Android-Paket' },
    },
    otherVersions: 'Andere Plattformen & Versionen',
    recommended: 'Empfohlen für Ihr Gerät',
    external: '(GitHub)',
  },
  openSourceBadge: 'Kostenlos & Open Source · MIT-Lizenz',
  screenshot: {
    placeholder: 'Screenshot folgt',
  },
  footer: {
    tagline: 'E-Mail-Archive öffnen, durchsuchen und lesen – schnell und ausschließlich lesend.',
    product: 'Produkt',
    documentation: 'Dokumentation',
    legal: 'Rechtliches',
    openSource: 'Open Source',
    sourceCode: 'Quellcode',
    releases: 'Releases & Changelog',
    issues: 'Fehler melden & Ideen',
    license: 'MIT-Lizenz',
    legalNotice: 'Impressum',
    privacy: 'Datenschutz',
    language: 'Sprache',
    appearance: 'Darstellung',
    copyright: (year) => `© ${year} Mario Kernich`,
    madeWith: 'Kostenlos und Open Source unter der MIT-Lizenz. Diese Website setzt keine Cookies und verwendet kein Tracking.',
    trademarks:
      'Microsoft, Outlook, Windows und Microsoft Store sind Marken der Microsoft-Unternehmensgruppe. Apple, Mac, iPhone, iPad, Apple Mail und App Store sind Marken von Apple Inc. Google Play, Gmail und Android sind Marken von Google LLC. Thunderbird ist eine Marke der Mozilla Foundation. GitHub ist eine Marke von GitHub, Inc. Linux ist eine eingetragene Marke von Linus Torvalds. PST Viewer ist ein unabhängiges Projekt und steht in keiner Verbindung zu diesen Unternehmen.',
  },
  notFound: {
    eyebrow: 'Fehler 404',
    title: 'Diese Seite gibt es nicht.',
    text: 'Vielleicht hat sich die Adresse geändert oder es hat sich ein Tippfehler eingeschlichen.',
    home: 'Zur Startseite',
    docs: 'Zur Dokumentation',
  },
  root: {
    title: 'PST Viewer auf Deutsch',
    text: 'Outlook-Archive öffnen – ohne Outlook. Kostenlos und Open Source.',
    action: 'Weiter auf Deutsch',
  },
}

const en: CommonContent = {
  meta: {
    defaultTitle: 'PST Viewer – Open Outlook archives without Outlook',
    description:
      'PST Viewer opens PST, MSG, EML and MBOX files quickly, strictly read-only and entirely on your device. Free and open source (MIT) – for Mac, Windows, Linux and Android.',
  },
  skipToContent: 'Skip to content',
  nav: {
    label: 'Main navigation',
    features: 'Features',
    platforms: 'Platforms',
    openSource: 'Open Source',
    download: 'Download',
    docs: 'Docs',
    faq: 'FAQ',
  },
  header: {
    home: 'PST Viewer – home',
    cta: 'Download',
    github: 'GitHub',
    githubLabel: 'PST Viewer source code on GitHub',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  language: {
    label: 'Language',
    switchTo: 'Auf Deutsch wechseln',
  },
  theme: {
    label: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  store: {
    prefix: {
      macAppStore: 'Download on the',
      microsoftStore: 'Get it from the',
      appStore: 'Download on the',
      googlePlay: 'Get it on',
    },
    comingSoon: 'Coming soon – free',
  },
  download: {
    cta: 'Download for free',
    ctaFor: {
      mac: 'Download for macOS',
      windows: 'Download for Windows',
      linux: 'Download for Linux',
      android: 'Download for Android',
    },
    platformNames: { mac: 'macOS', windows: 'Windows', linux: 'Linux', android: 'Android', ios: 'iPhone & iPad' },
    items: {
      macArm64: { label: 'Apple Silicon', detail: 'M1 or newer · .dmg' },
      macX64: { label: 'Intel', detail: 'Older Macs with an Intel processor · .dmg' },
      windowsX64: { label: 'x64', detail: 'Most Windows PCs · installer (.exe)' },
      windowsArm64: { label: 'ARM64', detail: 'e.g. Snapdragon laptops · installer (.exe)' },
      linuxAppImage: { label: 'AppImage', detail: 'Works on most distributions · x86_64' },
      linuxDeb: { label: 'Debian / Ubuntu', detail: 'Package (.deb) · amd64' },
      android: { label: 'APK', detail: 'Phones and tablets · Android package' },
    },
    otherVersions: 'Other platforms & versions',
    recommended: 'Recommended for your device',
    external: '(GitHub)',
  },
  openSourceBadge: 'Free & open source · MIT license',
  screenshot: {
    placeholder: 'Screenshot coming soon',
  },
  footer: {
    tagline: 'Open, search and read email archives – fast and strictly read-only.',
    product: 'Product',
    documentation: 'Documentation',
    legal: 'Legal',
    openSource: 'Open source',
    sourceCode: 'Source code',
    releases: 'Releases & changelog',
    issues: 'Issues & ideas',
    license: 'MIT license',
    legalNotice: 'Legal notice',
    privacy: 'Privacy',
    language: 'Language',
    appearance: 'Appearance',
    copyright: (year) => `© ${year} Mario Kernich`,
    madeWith: 'Free and open source under the MIT license. This website sets no cookies and uses no tracking.',
    trademarks:
      'Microsoft, Outlook, Windows and Microsoft Store are trademarks of the Microsoft group of companies. Apple, Mac, iPhone, iPad, Apple Mail and App Store are trademarks of Apple Inc. Google Play, Gmail and Android are trademarks of Google LLC. Thunderbird is a trademark of the Mozilla Foundation. GitHub is a trademark of GitHub, Inc. Linux is a registered trademark of Linus Torvalds. PST Viewer is an independent project and is not affiliated with these companies.',
  },
  notFound: {
    eyebrow: 'Error 404',
    title: 'This page doesn’t exist.',
    text: 'The address may have changed, or there might be a typo in the URL.',
    home: 'Back to home',
    docs: 'Documentation',
  },
  root: {
    title: 'PST Viewer in English',
    text: 'Open Outlook archives – no Outlook required. Free and open source.',
    action: 'Continue in English',
  },
}

export const common: Record<Locale, CommonContent> = { de, en }
