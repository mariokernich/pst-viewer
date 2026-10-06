import {
  Archive,
  BookOpen,
  Calendar,
  Contact,
  FilePen,
  Folder,
  Inbox,
  ListTodo,
  type LucideIcon,
  RefreshCw,
  Rss,
  Send,
  SendHorizontal,
  ShieldAlert,
  StickyNote,
  Trash2
} from 'lucide-react'
import type { FolderNode, SpecialFolder } from '@shared/types'
import { specialFolderName } from '@/i18n'

const ICONS: Record<SpecialFolder, LucideIcon> = {
  inbox: Inbox,
  drafts: FilePen,
  sent: Send,
  deleted: Trash2,
  archive: Archive,
  junk: ShieldAlert,
  outbox: SendHorizontal,
  calendar: Calendar,
  contacts: Contact,
  tasks: ListTodo,
  notes: StickyNote,
  journal: BookOpen,
  syncIssues: RefreshCw,
  rss: Rss
}

export function folderIcon(node: FolderNode): LucideIcon {
  if (node.special) return ICONS[node.special]
  const c = node.containerClass
  if (/^IPF\.Appointment/i.test(c)) return Calendar
  if (/^IPF\.Contact/i.test(c)) return Contact
  if (/^IPF\.Task/i.test(c)) return ListTodo
  if (/^IPF\.StickyNote/i.test(c)) return StickyNote
  return Folder
}

/** Folders detected by type only keep their name unless it is the standard one. */
const STANDARD_NAMES: Partial<Record<SpecialFolder, RegExp>> = {
  calendar: /^(calendar|kalender)$/i,
  contacts: /^(contacts|kontakte)$/i,
  tasks: /^(tasks|aufgaben)$/i,
  notes: /^(notes|notizen)$/i,
  journal: /^journal$/i
}

/** Display name of a folder, localising the well-known Outlook folders. */
export function folderName(node: FolderNode): string {
  if (!node.special) return node.name
  const standard = STANDARD_NAMES[node.special]
  if (standard && !standard.test(node.name.trim())) return node.name
  return specialFolderName(node.special)
}

/** True if a folder or any descendant holds items. */
export function folderHasItems(node: FolderNode): boolean {
  return node.totalCount > 0
}
