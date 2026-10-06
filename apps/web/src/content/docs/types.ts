import type { ReactNode } from 'react'
import type { DocId } from '@/lib/routes'

export interface DocSection {
  /** Anchor id (identical in both languages). */
  id: string
  title: string
  body: ReactNode
}

export interface DocPage {
  title: string
  /** Used as page lead and meta description. */
  description: string
  sections: DocSection[]
}

export interface DocsContent {
  overview: {
    title: string
    description: string
    intro: string
    quickStartTitle: string
    quickStart: ReactNode[]
    pagesTitle: string
  }
  ui: {
    navLabel: string
    overview: string
    mobileNavToggle: string
    tocTitle: string
    previous: string
    next: string
    pagerLabel: string
  }
  /** Sidebar groups in display order. */
  groups: Array<{ title: string; ids: DocId[] }>
  pages: Record<DocId, DocPage>
}
