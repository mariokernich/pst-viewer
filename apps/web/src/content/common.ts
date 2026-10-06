import type { Locale } from '@/lib/i18n'
import type { StoreId } from '@/lib/site'

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
    pricing: string
    docs: string
    faq: string
  }
  header: {
    home: string
    cta: string
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
  price: {
    /** Formatted price, e.g. "4,99 €". */
    amount: string
    oneTime: string
    perStore: string
  }
  store: {
    /** Small line above the store name, e.g. "Laden im". */
    prefix: Record<StoreId, string>
    inDevelopment: string
  }
  screenshot: {
    placeholder: string
  }
  footer: {
    tagline: string
    product: string
    documentation: string
    legal: string
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
}

const de: CommonContent = {
  meta: {
    defaultTitle: 'PST Viewer – Outlook-Archive öffnen, ohne Outlook',
    description:
      'PST Viewer öffnet PST-, MSG-, EML- und MBOX-Dateien schnell, streng schreibgeschützt und komplett lokal. Für Mac und Windows, einmalig 4,99 € – ohne Abo.',
  },
  skipToContent: 'Zum Inhalt springen',
  nav: {
    label: 'Hauptnavigation',
    features: 'Funktionen',
    platforms: 'Plattformen',
    pricing: 'Preis',
    docs: 'Doku',
    faq: 'FAQ',
  },
  header: {
    home: 'PST Viewer – zur Startseite',
    cta: 'Für 4,99 € kaufen',
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
  price: {
    amount: '4,99 €',
    oneTime: 'einmalig',
    perStore: 'pro Store',
  },
  store: {
    prefix: {
      macAppStore: 'Laden im',
      microsoftStore: 'Herunterladen im',
      appStore: 'Laden im',
      googlePlay: 'Jetzt bei',
    },
    inDevelopment: 'In Entwicklung',
  },
  screenshot: {
    placeholder: 'Screenshot folgt',
  },
  footer: {
    tagline: 'E-Mail-Archive öffnen, durchsuchen und lesen – schnell und ausschließlich lesend.',
    product: 'Produkt',
    documentation: 'Dokumentation',
    legal: 'Rechtliches',
    legalNotice: 'Impressum',
    privacy: 'Datenschutz',
    language: 'Sprache',
    appearance: 'Darstellung',
    copyright: (year) => `© ${year} Mario Kernich`,
    madeWith: 'Diese Website setzt keine Cookies und verwendet kein Tracking.',
    trademarks:
      'Microsoft, Outlook, Windows und Microsoft Store sind Marken der Microsoft-Unternehmensgruppe. Apple, Mac, iPhone, iPad, Apple Mail und App Store sind Marken von Apple Inc. Google Play, Gmail und Android sind Marken von Google LLC. Thunderbird ist eine Marke der Mozilla Foundation. PST Viewer ist ein unabhängiges Produkt und steht in keiner Verbindung zu diesen Unternehmen.',
  },
  notFound: {
    eyebrow: 'Fehler 404',
    title: 'Diese Seite gibt es nicht.',
    text: 'Vielleicht hat sich die Adresse geändert oder es hat sich ein Tippfehler eingeschlichen.',
    home: 'Zur Startseite',
    docs: 'Zur Dokumentation',
  },
}

const en: CommonContent = {
  meta: {
    defaultTitle: 'PST Viewer – Open Outlook archives without Outlook',
    description:
      'PST Viewer opens PST, MSG, EML and MBOX files quickly, strictly read-only and entirely on your device. For Mac and Windows, a one-time €4.99 – no subscription.',
  },
  skipToContent: 'Skip to content',
  nav: {
    label: 'Main navigation',
    features: 'Features',
    platforms: 'Platforms',
    pricing: 'Pricing',
    docs: 'Docs',
    faq: 'FAQ',
  },
  header: {
    home: 'PST Viewer – home',
    cta: 'Buy for €4.99',
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
  price: {
    amount: '€4.99',
    oneTime: 'one-time',
    perStore: 'per store',
  },
  store: {
    prefix: {
      macAppStore: 'Download on the',
      microsoftStore: 'Get it from the',
      appStore: 'Download on the',
      googlePlay: 'Get it on',
    },
    inDevelopment: 'In development',
  },
  screenshot: {
    placeholder: 'Screenshot coming soon',
  },
  footer: {
    tagline: 'Open, search and read email archives – fast and strictly read-only.',
    product: 'Product',
    documentation: 'Documentation',
    legal: 'Legal',
    legalNotice: 'Legal notice',
    privacy: 'Privacy',
    language: 'Language',
    appearance: 'Appearance',
    copyright: (year) => `© ${year} Mario Kernich`,
    madeWith: 'This website sets no cookies and uses no tracking.',
    trademarks:
      'Microsoft, Outlook, Windows and Microsoft Store are trademarks of the Microsoft group of companies. Apple, Mac, iPhone, iPad, Apple Mail and App Store are trademarks of Apple Inc. Google Play, Gmail and Android are trademarks of Google LLC. Thunderbird is a trademark of the Mozilla Foundation. PST Viewer is an independent product and is not affiliated with these companies.',
  },
  notFound: {
    eyebrow: 'Error 404',
    title: 'This page doesn’t exist.',
    text: 'The address may have changed, or there might be a typo in the URL.',
    home: 'Back to home',
    docs: 'Documentation',
  },
}

export const common: Record<Locale, CommonContent> = { de, en }
