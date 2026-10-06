import type { FolderNode, SpecialFolder } from '../shared/types'

const NAME_PATTERNS: [SpecialFolder, RegExp][] = [
  ['inbox', /^(inbox|posteingang|boîte de réception|bandeja de entrada|posta in arrivo|postvak in)$/i],
  ['drafts', /^(drafts|entwürfe|entwuerfe|brouillons|borradores|bozze|concepten)$/i],
  ['sent', /^(sent items|sent|sent mail|gesendete elemente|gesendet|gesendete objekte|éléments envoyés|elementos enviados|posta inviata|verzonden items)$/i],
  ['deleted', /^(deleted items|deleted|trash|gelöschte elemente|geloeschte elemente|papierkorb|éléments supprimés|elementos eliminados|posta eliminata|verwijderde items)$/i],
  ['archive', /^(archive|archiv|archives|archivo|archivio|archief)$/i],
  ['junk', /^(junk e-?mail|junk-e-mail|junk|spam|junk-e-mail-ordner|courrier indésirable|correo no deseado|posta indesiderata|ongewenste e-mail)$/i],
  ['outbox', /^(outbox|postausgang|boîte d'envoi|bandeja de salida|posta in uscita|postvak uit)$/i],
  ['syncIssues', /^(sync issues|synchronisierungsprobleme|problèmes de synchronisation)$/i],
  ['rss', /^(rss[- ]feeds?|rss[- ]abonnements|rss subscriptions)$/i]
]

const CLASS_PATTERNS: [SpecialFolder, RegExp][] = [
  ['calendar', /^IPF\.Appointment/i],
  ['contacts', /^IPF\.Contact/i],
  ['tasks', /^IPF\.Task/i],
  ['notes', /^IPF\.StickyNote/i],
  ['journal', /^IPF\.Journal/i]
]

export function detectSpecialFolder(name: string, containerClass: string, depth: number): SpecialFolder | null {
  for (const [special, pattern] of CLASS_PATTERNS) {
    if (pattern.test(containerClass)) return depth === 0 ? special : null
  }
  if (depth !== 0) return null
  for (const [special, pattern] of NAME_PATTERNS) {
    if (pattern.test(name.trim())) return special
  }
  return null
}

const ORDER: Partial<Record<SpecialFolder, number>> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  deleted: 3,
  archive: 4,
  junk: 5,
  outbox: 6,
  calendar: 20,
  contacts: 21,
  tasks: 22,
  notes: 23,
  journal: 24,
  rss: 30,
  syncIssues: 31
}

const USER_FOLDER_RANK = 10

function rank(folder: FolderNode): number {
  return folder.special ? (ORDER[folder.special] ?? USER_FOLDER_RANK) : USER_FOLDER_RANK
}

/** Orders folders like Outlook does: well-known folders first, then by name. */
export function sortFolders(folders: FolderNode[], collator: Intl.Collator): FolderNode[] {
  folders.sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    // Prefer the folder that actually holds items when names collide
    // (e.g. "Deleted Items" and "Gelöschte Elemente").
    if (a.special && a.special === b.special) return b.totalCount - a.totalCount
    return collator.compare(a.name, b.name)
  })
  for (const f of folders) sortFolders(f.children, collator)
  return folders
}

/** Sums up item and unread counts of each subtree. */
export function computeTotals(folder: FolderNode): number {
  let total = folder.itemCount
  for (const child of folder.children) total += computeTotals(child)
  folder.totalCount = total
  return total
}

/** All folder ids of a subtree, including the root. */
export function collectFolderIds(folder: FolderNode, into: Set<number> = new Set()): Set<number> {
  into.add(folder.id)
  for (const child of folder.children) collectFolderIds(child, into)
  return into
}

export function findFolder(folders: FolderNode[], id: number): FolderNode | null {
  for (const f of folders) {
    if (f.id === id) return f
    const found = findFolder(f.children, id)
    if (found) return found
  }
  return null
}
