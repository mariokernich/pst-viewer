import { Callout, DocLink, Kbd, LegalLink, ShortcutTable, Steps, SyntaxTable } from '@/components/docs/prose'
import type { DocsContent } from './types'

const locale = 'de'

export const docsDe: DocsContent = {
  overview: {
    title: 'Dokumentation',
    description:
      'Alles zu PST Viewer: Dateien öffnen, navigieren, suchen, Anhänge ansehen und exportieren – und wie Ihre Daten dabei geschützt bleiben.',
    intro:
      'PST Viewer öffnet Outlook-Datendateien und Mail-Archive streng schreibgeschützt und komplett lokal. Hier erfahren Sie, wie Sie Nachrichten schnell finden, Anhänge sicher ansehen und Nachrichten exportieren.',
    quickStartTitle: 'Schnellstart',
    quickStart: [
      <>
        PST Viewer im <strong>Mac App Store</strong> oder im <strong>Microsoft Store</strong> kaufen und installieren.
      </>,
      <>
        App starten und <strong>Datei öffnen …</strong> wählen oder <Kbd>⌘O</Kbd> bzw. <Kbd>Ctrl+O</Kbd> drücken.
      </>,
      <>Eine PST-, MSG-, EML- oder MBOX-Datei auswählen – die Nachrichtenliste erscheint nach etwa einer Sekunde.</>,
      <>
        Mit <Kbd>⌘F</Kbd> bzw. <Kbd>Ctrl+F</Kbd> suchen, Nachricht lesen, Anhänge in der Vorschau ansehen.
      </>,
    ],
    pagesTitle: 'Alle Themen',
  },
  ui: {
    navLabel: 'Dokumentation',
    overview: 'Übersicht',
    mobileNavToggle: 'Themen der Dokumentation',
    tocTitle: 'Auf dieser Seite',
    previous: 'Zurück',
    next: 'Weiter',
    pagerLabel: 'Vorherige und nächste Seite',
  },
  groups: [
    { title: 'Grundlagen', ids: ['getting-started', 'navigation'] },
    { title: 'Funktionen', ids: ['search', 'attachments', 'export'] },
    { title: 'Weitere Themen', ids: ['privacy', 'mobile', 'troubleshooting'] },
  ],
  pages: {
    'getting-started': {
      title: 'Erste Schritte',
      description: 'PST Viewer installieren, die erste Datei öffnen und verstehen, was „schreibgeschützt“ bedeutet.',
      sections: [
        {
          id: 'install',
          title: 'PST Viewer installieren',
          body: (
            <>
              <p>
                PST Viewer gibt es für den Mac im <strong>Mac App Store</strong> und für Windows im{' '}
                <strong>Microsoft Store</strong>. Der Preis beträgt einmalig 4,99 € pro Store – ohne Abo, ohne Konto,
                ohne Werbung und ohne In-App-Käufe.
              </p>
              <p>
                Die Apps für iPhone und iPad (App Store) sowie für Android (Google Play) sind in Entwicklung. Mehr dazu
                unter <DocLink locale={locale} id="mobile">Mobile Apps</DocLink>.
              </p>
            </>
          ),
        },
        {
          id: 'open-a-file',
          title: 'Eine Datei öffnen',
          body: (
            <>
              <Steps>
                <li>Starten Sie PST Viewer.</li>
                <li>
                  Wählen Sie <strong>Datei öffnen …</strong> oder drücken Sie <Kbd>⌘O</Kbd> (Mac) bzw.{' '}
                  <Kbd>Ctrl+O</Kbd> (Windows).
                </li>
                <li>Wählen Sie eine PST-, MSG-, EML- oder MBOX-Datei aus.</li>
              </Steps>
              <p>
                Sie können eine Datei auch einfach in das Fenster ziehen. Zuletzt geöffnete Dateien erscheinen auf dem
                Startbildschirm und lassen sich mit einem Klick erneut öffnen.
              </p>
              <p>
                Auch große PST-Dateien öffnen schnell: Die Nachrichtenliste erscheint nach etwa einer Sekunde.
                Anschließend baut PST Viewer im Hintergrund den Volltextindex auf; der Fortschritt wird in der App
                angezeigt.
              </p>
              <Callout title="Während der Indizierung">
                Solange der Volltextindex entsteht, können Treffer im Nachrichtentext noch fehlen. Sie können trotzdem
                sofort lesen, navigieren und suchen.
              </Callout>
            </>
          ),
        },
        {
          id: 'formats',
          title: 'Unterstützte Formate',
          body: (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Format</th>
                      <th scope="col">Was ist das?</th>
                      <th scope="col">Typische Herkunft</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>PST</strong>
                      </td>
                      <td>Outlook-Datendatei mit Ordnern, E-Mails, Terminen, Kontakten und Aufgaben</td>
                      <td>Archive und Exporte aus Outlook</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>MSG</strong>
                      </td>
                      <td>Einzelnes Outlook-Element</td>
                      <td>Aus Outlook gespeicherte Nachrichten</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>EML</strong>
                      </td>
                      <td>Standard-E-Mail-Datei</td>
                      <td>Einzeln gespeicherte E-Mails aus vielen Mailprogrammen</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>MBOX</strong>
                      </td>
                      <td>Postfach mit vielen E-Mails in einer Datei</td>
                      <td>Gmail bzw. Google Takeout, Apple Mail, Thunderbird</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Callout tone="warning" title="OST-Dateien">
                OST-Dateien (Offline-Datendateien von Outlook) werden derzeit noch nicht unterstützt.
              </Callout>
            </>
          ),
        },
        {
          id: 'read-only',
          title: 'Schreibgeschützt – versprochen',
          body: (
            <>
              <p>
                PST Viewer öffnet jede Datei ausschließlich lesend. Ihre PST-, MSG-, EML- und MBOX-Dateien werden
                niemals verändert – auch nicht beim Durchsuchen, Filtern oder Anzeigen.
              </p>
              <p>Neue Dateien entstehen nur in zwei Fällen:</p>
              <ul>
                <li>
                  Sie exportieren eine Nachricht oder speichern einen Anhang – jeweils an einem Ort, den Sie selbst
                  wählen.
                </li>
                <li>
                  Sie öffnen einen Anhang in einer anderen App. Dafür legt PST Viewer eine schreibgeschützte, temporäre
                  Kopie an, die beim Beenden gelöscht wird.
                </li>
              </ul>
            </>
          ),
        },
      ],
    },
    navigation: {
      title: 'Navigation',
      description: 'Ordner, Nachrichtenliste und Lesebereich bedienen – mit Maus oder Tastatur.',
      sections: [
        {
          id: 'folders',
          title: 'Ordner',
          body: (
            <>
              <p>
                Die Seitenleiste zeigt den Ordnerbaum der geöffneten Datei. Ein Klick auf einen Ordner zeigt seine
                Elemente in der Nachrichtenliste.
              </p>
              <p>
                Mit <Kbd>⌃⌘S</Kbd> bzw. <Kbd>Ctrl+Shift+S</Kbd> blenden Sie die Seitenleiste aus und wieder ein –
                praktisch auf kleinen Bildschirmen.
              </p>
            </>
          ),
        },
        {
          id: 'message-list',
          title: 'Nachrichtenliste',
          body: (
            <>
              <p>
                Die Nachrichtenliste ist nach Datum gruppiert: <strong>Heute</strong>, <strong>Gestern</strong>,{' '}
                <strong>Diese Woche</strong> und ältere Nachrichten nach Monaten. So behalten Sie auch in großen
                Ordnern den Überblick.
              </p>
              <p>
                Mit <Kbd>↑</Kbd> <Kbd>↓</Kbd> oder <Kbd>j</Kbd> <Kbd>k</Kbd> wechseln Sie zur vorherigen oder nächsten
                Nachricht, mit <Kbd>Bild ↑</Kbd> <Kbd>Bild ↓</Kbd> blättern Sie seitenweise, und mit <Kbd>Pos1</Kbd>{' '}
                bzw. <Kbd>Ende</Kbd> springen Sie zur ersten oder letzten Nachricht.
              </p>
            </>
          ),
        },
        {
          id: 'reading-pane',
          title: 'Lesebereich',
          body: (
            <>
              <p>
                Der Lesebereich zeigt die ausgewählte Nachricht mit Absender, Empfängern, Datum und Anhängen.
                HTML-Mails werden bereinigt und abgeschottet ohne Skripte dargestellt.
              </p>
              <ul>
                <li>
                  <strong>Externe Bilder</strong> sind zum Schutz Ihrer Privatsphäre blockiert. Mit{' '}
                  <strong>Bilder laden</strong> erlauben Sie sie für die jeweilige Nachricht.
                </li>
                <li>
                  Die <strong>Internet-Kopfzeilen</strong> einer Nachricht zeigen Sie mit <Kbd>⌥⌘U</Kbd> bzw.{' '}
                  <Kbd>Ctrl+Alt+U</Kbd> an.
                </li>
                <li>
                  <strong>Angehängte Nachrichten</strong> öffnen Sie direkt in PST Viewer.
                </li>
                <li>
                  <strong>Termine, Kontakte und Aufgaben</strong> erscheinen mit ihren Details – bei Terminen etwa
                  Zeitpunkt und Ort.
                </li>
                <li>
                  <strong>S/MIME-signierte Nachrichten</strong> werden als digital signiert gekennzeichnet.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'shortcuts',
          title: 'Tastenkürzel',
          body: (
            <>
              <p>Alle Tastenkürzel der Desktop-App im Überblick:</p>
              <ShortcutTable locale={locale} />
            </>
          ),
        },
      ],
    },
    search: {
      title: 'Suche',
      description: 'Suchbereich, Vorschläge, Filter und die vollständige Suchsyntax.',
      sections: [
        {
          id: 'basics',
          title: 'Suchen beim Tippen',
          body: (
            <>
              <p>
                Drücken Sie <Kbd>⌘F</Kbd> bzw. <Kbd>Ctrl+F</Kbd> – oder einfach <Kbd>/</Kbd> – und beginnen Sie zu
                tippen. Die Ergebnisliste aktualisiert sich mit jedem Zeichen; Treffer werden in der Liste und in der
                geöffneten Nachricht hervorgehoben.
              </p>
              <p>
                Groß-/Kleinschreibung und Akzente spielen keine Rolle: „muller“ findet auch „Müller“. Mit{' '}
                <Kbd>Esc</Kbd> löschen Sie die Suche.
              </p>
              <Callout>
                Direkt nach dem Öffnen einer großen Datei wird der Volltextindex noch aufgebaut. Bis er fertig ist,
                können Treffer im Nachrichtentext fehlen.
              </Callout>
            </>
          ),
        },
        {
          id: 'scope',
          title: 'Suchbereich',
          body: (
            <>
              <p>Sie entscheiden, wo gesucht wird:</p>
              <ul>
                <li>
                  <strong>Alle Ordner</strong> – durchsucht die gesamte Datei.
                </li>
                <li>
                  <strong>Aktueller Ordner</strong> – durchsucht nur den gerade geöffneten Ordner.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'suggestions',
          title: 'Vorschläge',
          body: (
            <>
              <p>Schon während Sie tippen, schlägt PST Viewer passende Suchen vor:</p>
              <ul>
                <li>
                  den Begriff nur im <strong>Betreff</strong>, nur beim <strong>Absender</strong> oder nur im{' '}
                  <strong>Text</strong> suchen,
                </li>
                <li>
                  passende <strong>Absender</strong> – ein Klick sucht nach Nachrichten dieser Person,
                </li>
                <li>
                  passende <strong>Ordner</strong> – ein Klick öffnet den Ordner,
                </li>
                <li>
                  Ihre <strong>letzten Suchen</strong>.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: 'filters',
          title: 'Filter',
          body: (
            <>
              <p>
                Über die Schaltfläche <strong>Filter</strong> oder mit <Kbd>⌥⌘F</Kbd> bzw. <Kbd>Ctrl+Alt+F</Kbd> öffnen
                Sie den Filterbereich. Dort schränken Sie die Suche ein nach:
              </p>
              <ul>
                <li>
                  <strong>Suchen in:</strong> Betreff, Absender, Empfänger, Inhalt oder Anhangnamen
                </li>
                <li>
                  <strong>Zeitraum:</strong> Heute, 7 Tage, 30 Tage, 12 Monate oder ein eigener Zeitraum
                </li>
                <li>
                  <strong>Personen:</strong> Absender und Empfänger (Name oder Adresse)
                </li>
                <li>
                  <strong>Status:</strong> gelesen oder ungelesen, mit Anhang, wichtig, markiert
                </li>
                <li>
                  <strong>Anhangtyp:</strong> PDF, Bilder, Office, Archive, Kalender oder E-Mails
                </li>
                <li>
                  <strong>Elementtyp:</strong> E-Mails, Besprechungen, Termine, Kontakte, Aufgaben oder Notizen
                </li>
                <li>
                  <strong>Mindestgröße</strong>
                </li>
              </ul>
              <p>
                Aktive Filter erscheinen als <strong>Chips</strong> unter dem Suchfeld, zum Beispiel „Zeitraum: 12
                Monate“ oder „Anhang: PDF“. Mit dem × entfernen Sie einen einzelnen Filter, mit{' '}
                <strong>Alle zurücksetzen</strong> alle auf einmal.
              </p>
            </>
          ),
        },
        {
          id: 'query-syntax',
          title: 'Suchsyntax',
          body: (
            <>
              <p>
                Für gezielte Suchen kombinieren Sie Begriffe und Operatoren direkt im Suchfeld. Mehrere Begriffe müssen
                alle vorkommen. Deutsche und englische Operatoren funktionieren in beiden Sprachen –{' '}
                <code>von:anna</code> und <code>from:anna</code> bedeuten dasselbe.
              </p>
              <SyntaxTable locale={locale} />
            </>
          ),
        },
        {
          id: 'tips',
          title: 'Tipps',
          body: (
            <ul>
              <li>
                Operatoren lassen sich kombinieren: <code>von:anna hat:anhang nach:1.1.2024</code> findet Nachrichten
                von Anna mit Anhang ab dem 1. Januar 2024.
              </li>
              <li>
                Schreiben Sie den Wert direkt hinter den Doppelpunkt, ohne Leerzeichen. Werte mit Leerzeichen setzen
                Sie in Anführungszeichen: <code>von:&quot;anna müller&quot;</code>.
              </li>
              <li>
                Datumsangaben verstehen deutsche und internationale Schreibweisen: <code>1.3.2024</code>,{' '}
                <code>2024-03-01</code>, ganze Monate (<code>2024-06</code>) oder Jahre (<code>2023</code>).
              </li>
              <li>
                Statt <code>OR</code> können Sie auch <code>ODER</code> schreiben.
              </li>
              <li>
                Mit <code>-newsletter</code> blenden Sie störende Treffer aus.
              </li>
            </ul>
          ),
        },
      ],
    },
    attachments: {
      title: 'Anhänge',
      description: 'Anhänge in der Vorschau ansehen, sicher öffnen und speichern.',
      sections: [
        {
          id: 'preview',
          title: 'Vorschau ohne Speichern',
          body: (
            <>
              <p>
                Klicken Sie auf einen Anhang – oder wählen Sie ihn aus und drücken Sie <Kbd>Leertaste</Kbd> bzw.{' '}
                <Kbd>Enter</Kbd>. Die Vorschau öffnet sich direkt in PST Viewer, der Anhang muss dafür nicht gespeichert
                werden. Mit <Kbd>←</Kbd> <Kbd>→</Kbd> blättern Sie durch alle Anhänge der Nachricht.
              </p>
              <p>Eine Vorschau gibt es für:</p>
              <ul>
                <li>PDF-Dokumente</li>
                <li>Bilder</li>
                <li>Textdateien</li>
                <li>CSV-Dateien – als Tabelle</li>
                <li>HTML-Dateien – bereinigt und ohne Skripte</li>
                <li>Kalendereinladungen (.ics) – als Terminkarte</li>
                <li>Kontakte (.vcf) – als Kontaktkarte</li>
                <li>Audio und Video</li>
              </ul>
            </>
          ),
        },
        {
          id: 'open-in-app',
          title: 'In der Standard-App öffnen',
          body: (
            <p>
              Alle anderen Dateien – etwa Word- oder Excel-Dokumente – öffnen Sie mit{' '}
              <strong>In Standard-App öffnen</strong>. PST Viewer übergibt dabei eine{' '}
              <strong>schreibgeschützte, temporäre Kopie</strong>; die Datei in Ihrem Archiv bleibt unberührt. Die
              Kopie wird gelöscht, wenn Sie PST Viewer beenden.
            </p>
          ),
        },
        {
          id: 'blocked-types',
          title: 'Gesperrte Dateitypen',
          body: (
            <>
              <p>
                Dateitypen, die Programmcode ausführen können – zum Beispiel Programme und Skripte –, öffnet PST Viewer
                grundsätzlich nicht direkt. Solche Anhänge können Sie nur speichern.
              </p>
              <Callout tone="warning">Speichern Sie solche Dateien nur, wenn Sie dem Absender vertrauen.</Callout>
            </>
          ),
        },
        {
          id: 'save',
          title: 'Anhänge speichern',
          body: (
            <>
              <ul>
                <li>
                  <strong>Speichern unter …</strong> speichert einen einzelnen Anhang.
                </li>
                <li>
                  <strong>Alle speichern</strong> speichert alle Anhänge einer Nachricht in einen Ordner Ihrer Wahl.
                  Vorhandene Dateien werden dabei nicht überschrieben.
                </li>
              </ul>
              <p>Angehängte Nachrichten – etwa weitergeleitete E-Mails – öffnen Sie direkt in PST Viewer.</p>
            </>
          ),
        },
      ],
    },
    export: {
      title: 'Export & Drucken',
      description: 'Einzelne Nachrichten als PDF, EML oder Text exportieren und drucken.',
      sections: [
        {
          id: 'how-to',
          title: 'So exportieren Sie eine Nachricht',
          body: (
            <>
              <Steps>
                <li>Wählen Sie die Nachricht in der Liste aus.</li>
                <li>
                  Öffnen Sie das Menü <strong>Exportieren</strong>.
                </li>
                <li>Wählen Sie das Format und anschließend den Speicherort.</li>
              </Steps>
              <p>Exportiert wird jeweils die ausgewählte Nachricht. Die Originaldatei bleibt dabei unverändert.</p>
            </>
          ),
        },
        {
          id: 'pdf',
          title: 'Als PDF',
          body: (
            <p>
              Das PDF enthält die Kopfzeilen der Nachricht wie Absender, Empfänger, Datum und Betreff, eine Liste der
              Anhänge, eingebettete Bilder und Seitenzahlen – ideal zum Ablegen oder Weitergeben.
            </p>
          ),
        },
        {
          id: 'eml',
          title: 'Als EML',
          body: (
            <p>
              Eine EML-Datei ist eine Standard-E-Mail-Datei, die sich in jedem Mailprogramm öffnen lässt –
              einschließlich aller Anhänge.
            </p>
          ),
        },
        {
          id: 'text',
          title: 'Als Text',
          body: <p>Der reine Text der Nachricht – praktisch, um Inhalte weiterzuverarbeiten.</p>,
        },
        {
          id: 'print',
          title: 'Drucken',
          body: (
            <p>
              Mit <Kbd>⌘P</Kbd> bzw. <Kbd>Ctrl+P</Kbd> drucken Sie die ausgewählte Nachricht.
            </p>
          ),
        },
      ],
    },
    privacy: {
      title: 'Datenschutz & Sicherheit',
      description: 'Wie PST Viewer Ihre Daten und Ihr Gerät schützt.',
      sections: [
        {
          id: 'local',
          title: 'Alles bleibt lokal',
          body: (
            <p>
              PST Viewer verarbeitet Ihre Dateien ausschließlich auf Ihrem Gerät. Es gibt keinen Upload, keine Cloud,
              kein Tracking und keine Telemetrie. Sie brauchen kein Konto und müssen sich nirgends anmelden.
            </p>
          ),
        },
        {
          id: 'read-only',
          title: 'Ihre Dateien bleiben unverändert',
          body: (
            <p>
              Dateien werden nur lesend geöffnet und niemals verändert. Neue Dateien entstehen nur, wenn Sie selbst eine
              Nachricht exportieren oder einen Anhang speichern – oder als schreibgeschützte, temporäre Kopie, wenn Sie
              einen Anhang in einer anderen App öffnen. Diese Kopien werden beim Beenden gelöscht.
            </p>
          ),
        },
        {
          id: 'remote-images',
          title: 'Externe Bilder',
          body: (
            <p>
              Viele Newsletter und Werbe-Mails enthalten unsichtbare Bilder, über die der Absender erfährt, wann und wo
              eine Nachricht geöffnet wurde. Deshalb blockiert PST Viewer externe Bilder standardmäßig. Mit{' '}
              <strong>Bilder laden</strong> erlauben Sie sie gezielt für eine einzelne Nachricht.
            </p>
          ),
        },
        {
          id: 'html',
          title: 'Sichere Darstellung von HTML-Mails',
          body: (
            <p>
              HTML-Mails werden vor der Anzeige bereinigt und in einer abgeschotteten Umgebung dargestellt. Skripte in
              E-Mails werden nicht ausgeführt.
            </p>
          ),
        },
        {
          id: 'attachments',
          title: 'Anhänge',
          body: (
            <p>
              Anhänge werden in der Vorschau angezeigt oder als schreibgeschützte, temporäre Kopie in der passenden App
              geöffnet. Dateitypen, die Code ausführen können, öffnet PST Viewer nie direkt – sie lassen sich nur
              speichern.
            </p>
          ),
        },
        {
          id: 'website',
          title: 'Diese Website',
          body: (
            <p>
              Auch diese Website kommt ohne Cookies und ohne Tracking aus. Wenn Sie eine Darstellung (hell, dunkel oder
              System) wählen, wird diese Einstellung nur lokal in Ihrem Browser gespeichert. Details finden Sie in der{' '}
              <LegalLink locale={locale} id="privacy">
                Datenschutzerklärung
              </LegalLink>
              .
            </p>
          ),
        },
      ],
    },
    mobile: {
      title: 'Mobile Apps',
      description: 'PST Viewer für iPhone, iPad und Android.',
      sections: [
        {
          id: 'status',
          title: 'Aktueller Stand',
          body: (
            <p>
              Die Apps für iPhone, iPad und Android sind in Entwicklung. Sie erhalten denselben Funktionsumfang wie die
              Desktop-App für Mac und Windows.
            </p>
          ),
        },
        {
          id: 'availability',
          title: 'Verfügbarkeit',
          body: (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Gerät</th>
                    <th scope="col">Store</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>iPhone &amp; iPad</td>
                    <td>App Store</td>
                    <td>In Entwicklung</td>
                  </tr>
                  <tr>
                    <td>Android</td>
                    <td>Google Play</td>
                    <td>In Entwicklung</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: 'features',
          title: 'Funktionen',
          body: (
            <>
              <p>Auch unterwegs gilt, was PST Viewer auf dem Desktop ausmacht:</p>
              <ul>
                <li>PST-, MSG-, EML- und MBOX-Dateien öffnen</li>
                <li>Suche mit Vorschlägen, Filtern und Suchsyntax</li>
                <li>Vorschau für Anhänge</li>
                <li>Export als PDF, EML oder Text</li>
                <li>Streng schreibgeschützt und vollständig lokal</li>
              </ul>
            </>
          ),
        },
        {
          id: 'pricing',
          title: 'Preis',
          body: (
            <p>
              Wie auf dem Desktop: einmalig 4,99 € pro Store – ohne Abo, ohne Konto, ohne Werbung und ohne
              In-App-Käufe.
            </p>
          ),
        },
      ],
    },
    troubleshooting: {
      title: 'Fehlerbehebung & FAQ',
      description: 'Lösungen für häufige Fragen und Probleme.',
      sections: [
        {
          id: 'cannot-open',
          title: 'Eine Datei lässt sich nicht öffnen',
          body: (
            <ul>
              <li>Prüfen Sie, ob es sich um eine unterstützte Datei handelt: PST, MSG, EML oder MBOX.</li>
              <li>OST-Dateien (Offline-Datendateien von Outlook) werden derzeit nicht unterstützt.</li>
              <li>
                Liegt die Datei in einem Cloud-Ordner, stellen Sie sicher, dass sie vollständig auf Ihr Gerät geladen
                ist.
              </li>
            </ul>
          ),
        },
        {
          id: 'search-misses',
          title: 'Die Suche findet eine Nachricht nicht',
          body: (
            <ul>
              <li>
                Direkt nach dem Öffnen wird der Volltextindex noch aufgebaut – Treffer im Nachrichtentext können dann
                noch fehlen.
              </li>
              <li>
                Prüfen Sie den Suchbereich: Ist <strong>Aktueller Ordner</strong> statt <strong>Alle Ordner</strong>{' '}
                gewählt?
              </li>
              <li>Prüfen Sie die Filter-Chips unter dem Suchfeld und setzen Sie sie bei Bedarf zurück.</li>
              <li>
                Schreiben Sie Operatoren ohne Leerzeichen nach dem Doppelpunkt: <code>von:anna</code>. Mehr unter{' '}
                <DocLink locale={locale} id="search" hash="query-syntax">
                  Suchsyntax
                </DocLink>
                .
              </li>
            </ul>
          ),
        },
        {
          id: 'missing-images',
          title: 'In einer E-Mail fehlen Bilder',
          body: (
            <p>
              Externe Bilder werden zum Schutz Ihrer Privatsphäre blockiert. Wählen Sie <strong>Bilder laden</strong>,
              um sie für diese Nachricht anzuzeigen.
            </p>
          ),
        },
        {
          id: 'attachment-blocked',
          title: 'Ein Anhang lässt sich nicht öffnen',
          body: (
            <p>
              Dateitypen, die Code ausführen können, öffnet PST Viewer aus Sicherheitsgründen nicht direkt. Speichern
              Sie die Datei nur, wenn Sie dem Absender vertrauen. Für andere Dateien ohne Vorschau wählen Sie{' '}
              <strong>In Standard-App öffnen</strong>.
            </p>
          ),
        },
        {
          id: 'encrypted',
          title: 'Eine Nachricht ist verschlüsselt',
          body: (
            <p>
              Verschlüsselte S/MIME-Nachrichten kann PST Viewer nicht entschlüsseln, da der private Schlüssel nicht in
              der Datei enthalten ist. Digital signierte Nachrichten werden dagegen angezeigt.
            </p>
          ),
        },
        {
          id: 'file-changed',
          title: 'Verändert PST Viewer meine Datei?',
          body: (
            <p>
              Nein. Alle Dateien werden ausschließlich lesend geöffnet. Mehr dazu unter{' '}
              <DocLink locale={locale} id="getting-started" hash="read-only">
                Schreibgeschützt – versprochen
              </DocLink>
              .
            </p>
          ),
        },
      ],
    },
  },
}
