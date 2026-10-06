import type { Locale } from '@/lib/i18n'
import { docIds, type DocId } from '@/lib/routes'
import { docsDe } from './de'
import { docsEn } from './en'
import type { DocsContent } from './types'

export type { DocPage, DocSection, DocsContent } from './types'

export const docs: Record<Locale, DocsContent> = { de: docsDe, en: docsEn }

/** Pages in sidebar order (used for previous/next links). */
export function orderedDocIds(locale: Locale): DocId[] {
  const ordered = docs[locale].groups.flatMap((group) => group.ids)
  // Pages that are missing from the groups still get listed at the end.
  return [...ordered, ...docIds.filter((id) => !ordered.includes(id))]
}
