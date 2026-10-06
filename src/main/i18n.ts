import { app } from 'electron'
import type { LanguageSetting } from '../shared/types'
import { settings } from './store'

const de = {
  appName: 'PST Viewer',
  file: 'Ablage',
  fileWin: 'Datei',
  open: 'PST-Datei öffnen …',
  openRecent: 'Zuletzt geöffnet',
  clearRecent: 'Liste leeren',
  noRecent: 'Keine Einträge',
  closeFile: 'Datei schließen',
  edit: 'Bearbeiten',
  find: 'Suchen',
  filters: 'Suchfilter',
  view: 'Darstellung',
  toggleSidebar: 'Seitenleiste ein-/ausblenden',
  showHeaders: 'Internet-Kopfzeilen anzeigen',
  appearance: 'Erscheinungsbild',
  appearanceSystem: 'Wie System',
  appearanceLight: 'Hell',
  appearanceDark: 'Dunkel',
  language: 'Sprache',
  languageSystem: 'Wie System',
  window: 'Fenster',
  help: 'Hilfe',
  searchHelp: 'Suchsyntax',
  openDialogTitle: 'Outlook-Datendatei öffnen',
  openDialogButton: 'Öffnen',
  pstFilter: 'Outlook-Datendatei',
  allFiles: 'Alle Dateien',
  saveAttachmentTitle: 'Anhang speichern',
  saveAllTitle: 'Ordner für Anhänge wählen',
  saveAllButton: 'Hier speichern',
  about: 'Über PST Viewer',
  openLink: 'Link im Browser öffnen',
  copyLink: 'Link kopieren',
  openLinkQuestion: 'Diesen Link im Browser öffnen?',
  cancel: 'Abbrechen',
  exportPdf: 'Als PDF exportieren …',
  exportEml: 'Als E-Mail-Datei (.eml) exportieren …',
  exportText: 'Als Text exportieren …',
  print: 'Drucken …',
  exportPdfTitle: 'Als PDF exportieren',
  exportEmlTitle: 'Als E-Mail-Datei exportieren',
  exportTextTitle: 'Als Text exportieren',
  pdfFilter: 'PDF-Dokument',
  emlFilter: 'E-Mail-Nachricht',
  textFilter: 'Textdatei'
}

type Strings = typeof de

const en: Strings = {
  appName: 'PST Viewer',
  file: 'File',
  fileWin: 'File',
  open: 'Open PST File…',
  openRecent: 'Open Recent',
  clearRecent: 'Clear Menu',
  noRecent: 'No Recent Files',
  closeFile: 'Close File',
  edit: 'Edit',
  find: 'Find',
  filters: 'Search Filters',
  view: 'View',
  toggleSidebar: 'Toggle Sidebar',
  showHeaders: 'Show Internet Headers',
  appearance: 'Appearance',
  appearanceSystem: 'System',
  appearanceLight: 'Light',
  appearanceDark: 'Dark',
  language: 'Language',
  languageSystem: 'System',
  window: 'Window',
  help: 'Help',
  searchHelp: 'Search Syntax',
  openDialogTitle: 'Open Outlook Data File',
  openDialogButton: 'Open',
  pstFilter: 'Outlook Data File',
  allFiles: 'All Files',
  saveAttachmentTitle: 'Save Attachment',
  saveAllTitle: 'Choose a Folder for the Attachments',
  saveAllButton: 'Save Here',
  about: 'About PST Viewer',
  openLink: 'Open Link in Browser',
  copyLink: 'Copy Link',
  openLinkQuestion: 'Open this link in your browser?',
  cancel: 'Cancel',
  exportPdf: 'Export as PDF…',
  exportEml: 'Export as Email File (.eml)…',
  exportText: 'Export as Text…',
  print: 'Print…',
  exportPdfTitle: 'Export as PDF',
  exportEmlTitle: 'Export as Email File',
  exportTextTitle: 'Export as Text',
  pdfFilter: 'PDF Document',
  emlFilter: 'Email Message',
  textFilter: 'Text File'
}

function systemLocale(): string {
  return app.getPreferredSystemLanguages()[0] ?? app.getLocale()
}

export function languageSetting(): LanguageSetting {
  return settings().get('language') ?? 'system'
}

export function setLanguageSetting(language: LanguageSetting): void {
  settings().set('language', language)
}

/** UI language: the user's choice, or the system language if supported. */
export function uiLocale(): 'de' | 'en' {
  const setting = languageSetting()
  if (setting !== 'system') return setting
  return systemLocale().toLowerCase().startsWith('de') ? 'de' : 'en'
}

/** Locale for dates and numbers, keeping regional conventions (e.g. en-DE). */
export function formatLocale(): string {
  const system = systemLocale()
  return system.toLowerCase().startsWith(uiLocale()) ? system : uiLocale()
}

export function t(): Strings {
  return uiLocale() === 'de' ? de : en
}
