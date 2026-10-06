import type { LandingContent } from './types'

export const landingDe: LandingContent = {
  meta: {
    title: 'PST Viewer – PST-, MSG-, EML- und MBOX-Dateien öffnen, ohne Outlook',
    description:
      'Outlook-Archive öffnen und durchsuchen – ohne Outlook. PST Viewer liest PST, MSG, EML und MBOX streng schreibgeschützt und komplett lokal. Einmalig 4,99 €, kein Abo.',
  },
  hero: {
    eyebrow: 'Für Mac und Windows · iPhone, iPad und Android in Entwicklung',
    titleLead: 'Outlook-Archive öffnen.',
    titleAccent: 'Ohne Outlook.',
    subtitle:
      'PST Viewer öffnet PST-, MSG-, EML- und MBOX-Dateien in Sekunden, findet jede Nachricht per Volltextsuche und zeigt Anhänge direkt in der Vorschau – streng schreibgeschützt und vollständig auf Ihrem Gerät.',
    primaryCta: 'Für 4,99 € kaufen',
    secondaryCta: 'Dokumentation lesen',
    trust: [
      'Nur lesend – Dateien bleiben unverändert',
      '100 % lokal – kein Upload',
      'Einmalig 4,99 € pro Store',
      'Kein Abo, kein Konto, keine Werbung',
    ],
  },
  formats: {
    label: 'Öffnet die gängigen Mail-Archive',
    items: [
      { ext: 'PST', title: 'Outlook-Datendateien', text: 'Archive und Exporte aus Outlook' },
      { ext: 'MSG', title: 'Outlook-Elemente', text: 'Einzeln gespeicherte Nachrichten' },
      { ext: 'EML', title: 'E-Mail-Dateien', text: 'Das Standardformat für einzelne E-Mails' },
      { ext: 'MBOX', title: 'Postfächer', text: 'Gmail/Google Takeout, Apple Mail, Thunderbird' },
    ],
  },
  features: {
    eyebrow: 'Funktionen',
    title: 'Alles, was ein Mail-Archiv braucht.',
    subtitle: 'Schnell geöffnet, gründlich durchsucht, sicher angezeigt – und an Ihren Dateien ändert sich nichts.',
    speed: {
      title: 'Große Dateien in Sekunden',
      text: 'Auch große PST-Dateien öffnen schnell: Die Nachrichtenliste steht nach etwa einer Sekunde bereit, der Volltextindex entsteht im Hintergrund.',
      stat: '≈ 1 s',
      statLabel: 'bis zur Nachrichtenliste',
      indexLabel: 'Volltextindex',
    },
    search: {
      title: 'Suchen, während Sie tippen',
      text: 'In allen Ordnern oder nur im aktuellen – mit Vorschlägen, Filtern und hervorgehobenen Treffern. „muller“ findet auch „Müller“.',
      query: 'muller angebot',
      highlights: ['Müller', 'Angebot'],
      results: [
        { from: 'Anna Müller', subject: 'Angebot Büromöbel' },
        { from: 'Jonas Müller', subject: 'Re: Angebot Wartung' },
        { from: 'Müller & Partner', subject: 'Ihr Angebot vom 3. Mai' },
      ],
    },
    layout: {
      title: 'Vertraute Ansicht',
      text: 'Ordnerbaum, eine nach Datum gruppierte Nachrichtenliste und ein Lesebereich mit sicher bereinigtem HTML.',
      groups: ['Heute', 'Gestern', 'Diese Woche', 'Februar'],
    },
    attachments: {
      title: 'Anhänge ohne Umweg',
      text: 'Vorschau direkt in der App, ohne den Anhang vorher zu speichern. Alles andere öffnet als schreibgeschützte Kopie in der passenden App.',
      types: ['PDF', 'Bilder', 'Text', 'CSV als Tabelle', 'HTML', 'Termine (.ics)', 'Kontakte (.vcf)', 'Audio', 'Video'],
    },
    export: {
      title: 'Exportieren & drucken',
      text: 'Einzelne Nachrichten als PDF mit Kopfzeilen, Anhangliste, eingebetteten Bildern und Seitenzahlen, als EML für jedes Mailprogramm oder als Text.',
      formats: ['PDF', 'EML', 'Text', 'Drucken'],
    },
    items: {
      title: 'Mehr als E-Mails',
      text: 'Termine, Kontakte und Aufgaben werden übersichtlich angezeigt – digital signierte S/MIME-Nachrichten ebenso.',
      kinds: ['Termine', 'Kontakte', 'Aufgaben', 'S/MIME-signiert'],
    },
    appearance: {
      title: 'Hell, dunkel, zweisprachig',
      text: 'Helles und dunkles Design, die Oberfläche auf Deutsch oder Englisch.',
      languages: 'DE · EN',
    },
  },
  search: {
    eyebrow: 'Suche',
    title: 'Gefunden, während Sie tippen.',
    subtitle:
      'Beginnen Sie einfach mit einem Begriff – und verfeinern Sie bei Bedarf mit Filtern oder einer Suchsyntax, die Deutsch und Englisch versteht.',
    points: [
      { title: 'Alle Ordner oder nur einer', text: 'Durchsuchen Sie das ganze Archiv oder nur den geöffneten Ordner.' },
      {
        title: 'Vorschläge beim Tippen',
        text: 'Nur in Betreff, Absender oder Text suchen, passende Absender und Ordner und Ihre letzten Suchen.',
      },
      {
        title: 'Filter und Chips',
        text: 'Zeitraum, Absender, Empfänger, gelesen oder ungelesen, Anhänge und Anhangtyp, wichtig, markiert, Elementtyp und Mindestgröße. Aktive Filter erscheinen als Chips, die Sie einzeln entfernen.',
      },
      {
        title: 'Großzügig und genau',
        text: 'Groß-/Kleinschreibung und Akzente spielen keine Rolle: „muller“ findet „Müller“. Treffer werden in der Liste und in der Nachricht hervorgehoben.',
      },
    ],
    syntaxTitle: 'Suchsyntax – ein Auszug',
    syntaxRows: [
      ['von:anna', 'Absender (Name oder Adresse)'],
      ['hat:anhang', 'Nur Nachrichten mit Anhang'],
      ['"sehr geehrte"', 'Exakte Wortfolge'],
      ['-newsletter', 'Begriff ausschließen'],
      ['nach:1.3.2024 vor:2024-06', 'Zeitraum'],
      ['größer:5mb', 'Mindestgröße'],
    ],
    syntaxLink: 'Vollständige Suchsyntax ansehen',
    mock: {
      label: 'Beispiel: Suche nach Angeboten von Anna mit aktiven Filtern',
      query: 'angebot von:anna',
      scopeAll: 'Alle Ordner',
      scopeFolder: 'Aktueller Ordner',
      chips: ['Zeitraum: 12 Monate', 'Anhang: PDF', 'Ungelesen'],
      resetAll: 'Alle zurücksetzen',
      results: [
        {
          from: 'Anna Müller',
          subject: 'Angebot Büromöbel – überarbeitete Fassung',
          snippet: '… anbei das überarbeitete Angebot als PDF. Die Lieferung wäre …',
          highlight: 'Angebot',
          date: '12. März',
          attachment: true,
        },
        {
          from: 'Anna Becker',
          subject: 'Re: Angebot Wartungsvertrag',
          snippet: '… danke für das Angebot. Können wir den Termin verschieben …',
          highlight: 'Angebot',
          date: '28. Feb.',
          attachment: true,
        },
        {
          from: 'Anna Müller',
          subject: 'Angebot Messestand',
          snippet: '… wie besprochen das Angebot für den Messestand im Herbst …',
          highlight: 'Angebot',
          date: '9. Jan.',
          attachment: true,
        },
      ],
    },
  },
  privacy: {
    eyebrow: 'Datenschutz & Sicherheit',
    title: 'Ihre Mails bleiben bei Ihnen.',
    subtitle:
      'PST Viewer arbeitet vollständig lokal. Kein Upload, keine Cloud, kein Tracking – und Ihre Dateien werden niemals verändert.',
    items: [
      {
        title: '100 % lokal',
        text: 'Alles passiert auf Ihrem Gerät. Es gibt keinen Upload, keine Cloud und keine Telemetrie.',
      },
      {
        title: 'Streng schreibgeschützt',
        text: 'Dateien werden nur gelesen und nie verändert. Neue Dateien entstehen nur, wenn Sie selbst etwas exportieren oder speichern.',
      },
      {
        title: 'Schutz vor Tracking',
        text: 'Externe Bilder in E-Mails bleiben blockiert, bis Sie sie für eine Nachricht ausdrücklich erlauben.',
      },
      {
        title: 'Sichere Darstellung',
        text: 'HTML-Mails werden bereinigt und abgeschottet angezeigt – Skripte werden nicht ausgeführt.',
      },
      {
        title: 'Vorsicht bei Anhängen',
        text: 'Anhänge öffnen als schreibgeschützte temporäre Kopie, die beim Beenden gelöscht wird. Dateitypen, die Code ausführen können, werden nie direkt geöffnet.',
      },
      {
        title: 'Kein Konto nötig',
        text: 'Keine Registrierung, keine Anmeldung, keine Werbung. Datei öffnen und lesen.',
      },
    ],
    docsLink: 'Mehr zu Datenschutz & Sicherheit',
  },
  platforms: {
    eyebrow: 'Plattformen',
    title: 'Ein Viewer für alle Ihre Geräte.',
    subtitle:
      'PST Viewer gibt es für Mac und Windows. Apps für iPhone, iPad und Android mit demselben Funktionsumfang sind in Entwicklung.',
    badgeDesktop: 'Desktop-App',
    badgeInDevelopment: 'In Entwicklung',
    items: {
      mac: { title: 'Mac', text: 'Die Desktop-App für macOS – über den Mac App Store.' },
      windows: { title: 'Windows', text: 'Die Desktop-App für Windows – über den Microsoft Store.' },
      ios: { title: 'iPhone & iPad', text: 'Mit demselben Funktionsumfang – über den App Store.' },
      android: { title: 'Android', text: 'Mit demselben Funktionsumfang – über Google Play.' },
    },
  },
  useCases: {
    eyebrow: 'Anwendungsfälle',
    title: 'Wenn alte Mails plötzlich wichtig werden.',
    subtitle: 'Ob Umstieg, Buchhaltung oder IT-Support – PST Viewer macht alte Archive schnell wieder zugänglich.',
    items: [
      {
        title: 'Von Outlook umgestiegen',
        text: 'Sie nutzen inzwischen einen Mac, Apple Mail oder Gmail, haben aber noch alte PST-Archive? Öffnen Sie sie jederzeit – ganz ohne Outlook.',
      },
      {
        title: 'Aufbewahrung & Buchhaltung',
        text: 'Alte Rechnungen, Verträge und Belege schnell wiederfinden – etwa für Aufbewahrungspflichten nach GoBD oder für die Buchhaltung.',
        note: 'PST Viewer hilft beim Nachschlagen, ersetzt aber kein revisionssicheres Archiv.',
      },
      {
        title: 'IT-Administration',
        text: 'Kolleginnen und Kollegen schnell helfen: PST- oder MSG-Datei öffnen, die gesuchte Nachricht finden und als PDF oder EML weitergeben.',
      },
      {
        title: 'Google-Takeout-Export',
        text: 'Ihr Gmail-Export liegt als MBOX-Datei vor? PST Viewer macht ihn durchsuchbar – genauso wie Postfächer aus Apple Mail und Thunderbird.',
      },
    ],
  },
  pricing: {
    eyebrow: 'Preis',
    title: 'Einmal kaufen. Kein Abo.',
    subtitle: 'Ein klarer Preis ohne Kleingedrucktes – und ohne laufende Kosten.',
    planName: 'PST Viewer',
    planText: 'Der volle Funktionsumfang, einmal bezahlt.',
    includedTitle: 'Enthalten',
    included: [
      'PST, MSG, EML und MBOX öffnen',
      'Volltextsuche mit Filtern und Suchsyntax',
      'Vorschau für Anhänge',
      'Export als PDF, EML und Text, Drucken',
      'Termine, Kontakte und Aufgaben',
      'Hell & dunkel, Deutsch & Englisch',
    ],
    excluded: ['Kein Abo', 'Kein Konto', 'Keine Werbung', 'Keine In-App-Käufe'],
    storesTitle: 'Stores & Verfügbarkeit',
    footnote:
      'Der Preis gilt einmalig pro Store (Mac App Store, Microsoft Store, App Store, Google Play). Maßgeblich ist der im jeweiligen Store angezeigte Preis.',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Häufige Fragen',
    subtitle: 'Kurze Antworten auf das, was die meisten wissen möchten.',
    items: [
      {
        question: 'Werden meine E-Mails irgendwohin hochgeladen?',
        answer:
          'Nein. PST Viewer arbeitet vollständig lokal auf Ihrem Gerät. Es gibt keinen Upload, keine Cloud und weder Tracking noch Telemetrie.',
      },
      {
        question: 'Verändert PST Viewer meine PST-Datei?',
        answer:
          'Nein. Alle Dateien werden ausschließlich lesend geöffnet und niemals verändert. Neue Dateien entstehen nur, wenn Sie selbst eine Nachricht exportieren oder einen Anhang speichern.',
      },
      {
        question: 'Welche Dateiformate werden unterstützt?',
        answer:
          'PST (Outlook-Datendateien), MSG (einzelne Outlook-Elemente), EML (E-Mail-Dateien) und MBOX – zum Beispiel aus Gmail bzw. Google Takeout, Apple Mail oder Thunderbird.',
      },
      {
        question: 'Brauche ich Outlook?',
        answer: 'Nein. PST Viewer liest die Dateien selbst. Outlook muss dafür nicht installiert sein.',
      },
      {
        question: 'Funktioniert das auch mit sehr großen Dateien?',
        answer:
          'Ja. Auch große PST-Dateien öffnen schnell: Die Nachrichtenliste erscheint nach etwa einer Sekunde, der Volltextindex wird im Hintergrund aufgebaut. Solange er entsteht, können Treffer im Nachrichtentext noch fehlen.',
      },
      {
        question: 'Kann ich OST-Dateien öffnen?',
        answer: 'Noch nicht. OST-Dateien (Offline-Datendateien von Outlook) werden derzeit nicht unterstützt.',
      },
      {
        question: 'Kann PST Viewer verschlüsselte S/MIME-Nachrichten anzeigen?',
        answer:
          'Nein. Verschlüsselte S/MIME-Nachrichten lassen sich nicht entschlüsseln, weil der private Schlüssel nicht in der Datei enthalten ist. Digital signierte Nachrichten werden dagegen angezeigt.',
      },
      {
        question: 'Ist PST Viewer ein Abo?',
        answer:
          'Nein. Sie zahlen einmalig 4,99 € pro Store – ohne Abo, ohne Konto, ohne Werbung und ohne In-App-Käufe.',
      },
      {
        question: 'In welchen Sprachen gibt es PST Viewer?',
        answer:
          'Die Oberfläche gibt es auf Deutsch und Englisch. Die Suchsyntax versteht deutsche und englische Operatoren in beiden Sprachen.',
      },
      {
        question: 'Gibt es PST Viewer auch für iPhone, iPad und Android?',
        answer:
          'Die Apps für iPhone, iPad und Android sind in Entwicklung und erhalten denselben Funktionsumfang wie die Desktop-App.',
      },
    ],
    more: 'Weitere Antworten finden Sie in der Dokumentation.',
  },
  finalCta: {
    title: 'Ihr Mail-Archiv wartet.',
    text: 'PST Viewer für einmalig 4,99 € – ohne Abo, ohne Konto. Ihre Daten bleiben auf Ihrem Gerät.',
    primaryCta: 'Für 4,99 € kaufen',
    secondaryCta: 'Dokumentation lesen',
  },
}
