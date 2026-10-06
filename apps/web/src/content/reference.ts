import type { Locale } from '@/lib/i18n'

/**
 * Search syntax, identical to the help table in the desktop app. German and
 * English operators work in both UI languages.
 */
export interface SyntaxRow {
  de: string
  en: string
  meaning: Record<Locale, string>
}

export const searchSyntax: SyntaxRow[] = [
  {
    de: 'rechnung 2024',
    en: 'invoice 2024',
    meaning: { de: 'Alle Begriffe müssen vorkommen', en: 'All terms must match' },
  },
  { de: '"sehr geehrte"', en: '"kind regards"', meaning: { de: 'Exakte Wortfolge', en: 'Exact phrase' } },
  { de: 'angebot OR offerte', en: 'offer OR quote', meaning: { de: 'Einer der Begriffe', en: 'Either term' } },
  { de: '-newsletter', en: '-newsletter', meaning: { de: 'Begriff ausschließen', en: 'Exclude a term' } },
  {
    de: 'von:anna',
    en: 'from:anna',
    meaning: { de: 'Absender (Name oder Adresse)', en: 'Sender (name or address)' },
  },
  { de: 'an:bob', en: 'to:bob', meaning: { de: 'Empfänger (An, Cc, Bcc)', en: 'Recipients (To, Cc, Bcc)' } },
  { de: 'betreff:urlaub', en: 'subject:vacation', meaning: { de: 'Nur im Betreff', en: 'Subject only' } },
  { de: 'inhalt:vertrag', en: 'body:contract', meaning: { de: 'Nur im Nachrichtentext', en: 'Message body only' } },
  {
    de: 'anhang:pdf',
    en: 'attachment:pdf',
    meaning: { de: 'Anhangname enthält „pdf“', en: 'Attachment name contains “pdf”' },
  },
  {
    de: 'hat:anhang',
    en: 'has:attachment',
    meaning: { de: 'Nur Nachrichten mit Anhang', en: 'Only messages with attachments' },
  },
  {
    de: 'ist:ungelesen',
    en: 'is:unread',
    meaning: {
      de: 'Ungelesen (auch: ist:gelesen, ist:wichtig, ist:markiert, ist:signiert)',
      en: 'Unread (also: is:read, is:important, is:flagged, is:signed)',
    },
  },
  {
    de: 'nach:1.3.2024 vor:2024-06',
    en: 'after:2024-03-01 before:2024-06',
    meaning: {
      de: 'Zeitraum (auch: datum:2023, bis:31.12.2024)',
      en: 'Date range (also: date:2023, until:2024-12-31)',
    },
  },
  {
    de: 'größer:5mb',
    en: 'larger:5mb',
    meaning: { de: 'Mindestgröße (auch: kleiner:100kb)', en: 'Minimum size (also: smaller:100kb)' },
  },
  {
    de: 'typ:termin',
    en: 'type:appointment',
    meaning: {
      de: 'Elementtyp: mail, termin, kontakt, aufgabe, notiz',
      en: 'Item type: mail, appointment, contact, task, note',
    },
  },
  {
    de: 'ordner:archiv',
    en: 'folder:archive',
    meaning: { de: 'Nur in Ordnern mit diesem Namen', en: 'Only in folders with this name' },
  },
]

/**
 * Keyboard shortcuts of the desktop app. `mac`/`windows` list alternatives
 * (joined with "or"); each alternative is a group of keys shown side by side.
 */
export interface ShortcutRow {
  mac: string[][]
  windows: string[][]
  action: Record<Locale, string>
  /** Optional context, e.g. "on an attachment". */
  context?: Record<Locale, string>
}

/** Key names that are labelled differently on German keyboards. */
const keyNames: Record<Locale, [string, string, string, string, string]> = {
  de: ['Bild ↑', 'Bild ↓', 'Pos1', 'Ende', 'Leertaste'],
  en: ['Page Up', 'Page Down', 'Home', 'End', 'Space'],
}

export function keyboardShortcuts(locale: Locale): ShortcutRow[] {
  const [pageUp, pageDown, home, end, space] = keyNames[locale]
  const same = (...alternatives: string[][]) => ({ mac: alternatives, windows: alternatives })
  return [
    { mac: [['⌘O']], windows: [['Ctrl+O']], action: { de: 'Datei öffnen', en: 'Open a file' } },
    { mac: [['⌘F'], ['/']], windows: [['Ctrl+F'], ['/']], action: { de: 'Suchen', en: 'Search' } },
    { mac: [['⌥⌘F']], windows: [['Ctrl+Alt+F']], action: { de: 'Filterbereich', en: 'Filter panel' } },
    {
      ...same(['↑', '↓'], ['j', 'k']),
      action: { de: 'Vorherige / nächste Nachricht', en: 'Previous / next message' },
    },
    { ...same([pageUp, pageDown]), action: { de: 'Seitenweise blättern', en: 'Move by one page' } },
    { ...same([home, end]), action: { de: 'Erste / letzte Nachricht', en: 'First / last message' } },
    { ...same(['Esc']), action: { de: 'Suche löschen', en: 'Clear the search' } },
    {
      mac: [['⌃⌘S']],
      windows: [['Ctrl+Shift+S']],
      action: { de: 'Seitenleiste ein-/ausblenden', en: 'Show or hide the sidebar' },
    },
    {
      mac: [['⌥⌘U']],
      windows: [['Ctrl+Alt+U']],
      action: { de: 'Internet-Kopfzeilen anzeigen', en: 'Show internet headers' },
    },
    { mac: [['⌘P']], windows: [['Ctrl+P']], action: { de: 'Nachricht drucken', en: 'Print the message' } },
    {
      ...same([space], ['Enter']),
      action: { de: 'Vorschau öffnen', en: 'Open the preview' },
      context: { de: 'auf einem Anhang', en: 'on an attachment' },
    },
    {
      ...same(['←', '→']),
      action: { de: 'Vorheriger / nächster Anhang', en: 'Previous / next attachment' },
      context: { de: 'in der Vorschau', en: 'in the preview' },
    },
    { mac: [['⇧⌘W']], windows: [['Ctrl+Shift+W']], action: { de: 'Datei schließen', en: 'Close the file' } },
  ]
}
