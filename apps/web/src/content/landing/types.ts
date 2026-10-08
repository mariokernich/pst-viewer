export interface SectionIntro {
  eyebrow: string
  title: string
  subtitle: string
}

export interface TitledText {
  title: string
  text: string
}

export interface LandingContent {
  meta: {
    title: string
    description: string
  }
  hero: {
    titleLead: string
    titleAccent: string
    subtitle: string
    /** Secondary call to action (GitHub). */
    secondaryCta: string
    /** Line below the buttons, followed by a link to all downloads. */
    availability: string
    trust: [string, string, string, string]
  }
  formats: {
    label: string
    items: Array<{ ext: string; title: string; text: string }>
  }
  features: SectionIntro & {
    speed: TitledText & { stat: string; statLabel: string; indexLabel: string }
    search: TitledText & { query: string; highlights: string[]; results: Array<{ from: string; subject: string }> }
    layout: TitledText & { groups: [string, string, string, string] }
    attachments: TitledText & { types: string[] }
    export: TitledText & { formats: string[] }
    items: TitledText & { kinds: string[] }
    appearance: TitledText & { languages: string }
  }
  search: SectionIntro & {
    points: TitledText[]
    syntaxTitle: string
    syntaxRows: Array<[string, string]>
    syntaxLink: string
    mock: {
      label: string
      query: string
      scopeAll: string
      scopeFolder: string
      chips: string[]
      resetAll: string
      results: Array<{ from: string; subject: string; snippet: string; highlight: string; date: string; attachment: boolean }>
    }
  }
  privacy: SectionIntro & {
    items: TitledText[]
    docsLink: string
  }
  platforms: SectionIntro & {
    badgeAvailable: string
    badgeAndroid: string
    badgeComingSoon: string
    downloadsLink: string
    items: {
      desktop: TitledText
      ios: TitledText & { sourceLink: string }
      android: TitledText
    }
  }
  useCases: SectionIntro & {
    items: Array<TitledText & { note?: string }>
  }
  openSource: SectionIntro & {
    cardTitle: string
    cardText: string
    free: string
    freeNote: string
    excluded: string[]
    pointsTitle: string
    points: TitledText[]
    repoCta: string
    issuesCta: string
    licenseLink: string
  }
  download: SectionIntro & {
    allReleases: string
    iosText: string
    iosSourceLink: string
    unsignedTitle: string
    unsignedText: string
    unsignedSteps: Array<{ platform: string; text: string }>
    unsignedLink: string
    storesTitle: string
    storesText: string
  }
  faq: SectionIntro & {
    items: Array<{ question: string; answer: string }>
    more: string
  }
  finalCta: {
    title: string
    text: string
    secondaryCta: string
  }
}
