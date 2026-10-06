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
    eyebrow: string
    titleLead: string
    titleAccent: string
    subtitle: string
    primaryCta: string
    secondaryCta: string
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
    badgeDesktop: string
    badgeInDevelopment: string
    items: {
      mac: TitledText
      windows: TitledText
      ios: TitledText
      android: TitledText
    }
  }
  useCases: SectionIntro & {
    items: Array<TitledText & { note?: string }>
  }
  pricing: SectionIntro & {
    planName: string
    planText: string
    includedTitle: string
    included: string[]
    excluded: string[]
    storesTitle: string
    footnote: string
  }
  faq: SectionIntro & {
    items: Array<{ question: string; answer: string }>
    more: string
  }
  finalCta: {
    title: string
    text: string
    primaryCta: string
    secondaryCta: string
  }
}
