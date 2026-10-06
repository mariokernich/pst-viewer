import type { ReactNode } from 'react'
import { Todo } from '@/components/legal/todo'
import type { Locale } from '@/lib/i18n'
import type { LegalId } from '@/lib/routes'

/**
 * Legal pages. These are PLACEHOLDERS: every <Todo> has to be completed (and
 * the texts reviewed) before the site goes live. The website facts stated
 * here – no cookies, no tracking, fonts served locally, theme stored in
 * localStorage – reflect the current implementation; keep them in sync.
 */

export interface LegalPage {
  title: string
  description: string
  placeholderNotice: string
  body: ReactNode
}

const legalDe: Record<LegalId, LegalPage> = {
  legalNotice: {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung von PST Viewer.',
    placeholderNotice:
      'Platzhalter: Die markierten Angaben müssen vor der Veröffentlichung ergänzt und rechtlich geprüft werden.',
    body: (
      <>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          Mario Kernich
          <br />
          <Todo>Straße und Hausnummer</Todo>
          <br />
          <Todo>PLZ und Ort</Todo>
          <br />
          <Todo>Land</Todo>
        </p>
        <h2>Kontakt</h2>
        <p>
          E-Mail: <Todo>E-Mail-Adresse</Todo>
          <br />
          Telefon: <Todo>Telefonnummer (optional)</Todo>
        </p>
        <h2>Umsatzsteuer-ID</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:{' '}
          <Todo>USt-IdNr. eintragen – oder diesen Abschnitt entfernen, falls keine vorhanden ist</Todo>
        </p>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          Mario Kernich, <Todo>Anschrift</Todo>
        </p>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>
          <Todo>
            Hinweis nach § 36 VSBG ergänzen, ob Sie bereit oder verpflichtet sind, an Streitbeilegungsverfahren vor
            einer Verbraucherschlichtungsstelle teilzunehmen
          </Todo>
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Datenschutzerklärung',
    description: 'Informationen zum Datenschutz auf dieser Website und in der App PST Viewer.',
    placeholderNotice:
      'Platzhalter: Die markierten Angaben müssen vor der Veröffentlichung ergänzt und rechtlich geprüft werden.',
    body: (
      <>
        <h2>1. Verantwortlicher</h2>
        <p>
          Mario Kernich
          <br />
          <Todo>Anschrift</Todo>
          <br />
          E-Mail: <Todo>E-Mail-Adresse</Todo>
        </p>
        <h2>2. Überblick</h2>
        <p>
          Diese Website informiert über die App PST Viewer. Sie setzt keine Cookies, verwendet keine Analyse- oder
          Tracking-Werkzeuge und bindet keine Inhalte von Drittanbietern ein. Schriften und alle übrigen Dateien werden
          direkt von unserem Server ausgeliefert.
        </p>
        <h2>3. Hosting und Server-Logdateien</h2>
        <p>
          Beim Aufruf der Website verarbeitet der Hosting-Anbieter technisch notwendige Daten (z. B. IP-Adresse,
          Zeitpunkt des Abrufs, aufgerufene Seite, Browsertyp), um die Website auszuliefern und ihre Sicherheit zu
          gewährleisten.
        </p>
        <p>
          <Todo>
            Hosting-Anbieter, Serverstandort, Speicherdauer der Logdateien, Rechtsgrundlage (z. B. Art. 6 Abs. 1 lit. f
            DSGVO) und ggf. Auftragsverarbeitungsvertrag ergänzen
          </Todo>
        </p>
        <h2>4. Keine Cookies, kein Tracking</h2>
        <p>
          Diese Website setzt keine Cookies und verwendet weder Analyse- noch Marketing-Dienste. Es werden keine
          Nutzungsprofile erstellt.
        </p>
        <h2>5. Lokale Speicherung der Darstellung</h2>
        <p>
          Wenn Sie die Darstellung (hell, dunkel oder System) wählen, speichert die Website diese Einstellung im lokalen
          Speicher Ihres Browsers (localStorage, Schlüssel „theme“). Die Einstellung verlässt Ihr Gerät nicht und wird
          nicht an uns übertragen. Sie können sie jederzeit über die Einstellungen Ihres Browsers löschen.
        </p>
        <h2>6. Kontakt</h2>
        <p>
          <Todo>
            Beschreiben, wie Anfragen (z. B. per E-Mail) verarbeitet werden: Zweck, Rechtsgrundlage und Speicherdauer
          </Todo>
        </p>
        <h2>7. Die App PST Viewer</h2>
        <p>
          Die App verarbeitet Ihre Dateien ausschließlich lokal auf Ihrem Gerät. Es werden keine Inhalte hochgeladen,
          keine Nutzungsdaten (Telemetrie) erhoben und kein Tracking eingesetzt. Externe Bilder in E-Mails werden
          standardmäßig blockiert.
        </p>
        <p>
          Käufe werden über den jeweiligen Store abgewickelt (Mac App Store, Microsoft Store, App Store, Google Play);
          dafür gelten die Datenschutzbestimmungen des jeweiligen Store-Betreibers.{' '}
          <Todo>Angaben zu den Stores prüfen und ggf. ergänzen</Todo>
        </p>
        <h2>8. Ihre Rechte</h2>
        <p>
          <Todo>
            Betroffenenrechte nach Art. 15 bis 21 DSGVO sowie das Beschwerderecht bei einer Aufsichtsbehörde nach Art.
            77 DSGVO ergänzen
          </Todo>
        </p>
        <h2>9. Stand</h2>
        <p>
          <Todo>Datum der letzten Aktualisierung</Todo>
        </p>
      </>
    ),
  },
}

const legalEn: Record<LegalId, LegalPage> = {
  legalNotice: {
    title: 'Legal notice',
    description: 'Provider information for PST Viewer.',
    placeholderNotice: 'Placeholder: the marked details must be completed and legally reviewed before going live.',
    body: (
      <>
        <h2>Information pursuant to Section 5 of the German Digital Services Act (DDG)</h2>
        <p>
          Mario Kernich
          <br />
          <Todo>Street and house number</Todo>
          <br />
          <Todo>Postcode and city</Todo>
          <br />
          <Todo>Country</Todo>
        </p>
        <h2>Contact</h2>
        <p>
          Email: <Todo>email address</Todo>
          <br />
          Phone: <Todo>phone number (optional)</Todo>
        </p>
        <h2>VAT ID</h2>
        <p>
          VAT identification number pursuant to Section 27a of the German VAT Act:{' '}
          <Todo>add the VAT ID – or remove this section if there is none</Todo>
        </p>
        <h2>Responsible for the content</h2>
        <p>
          Mario Kernich, <Todo>address</Todo>
        </p>
        <h2>Consumer dispute resolution</h2>
        <p>
          <Todo>
            add the statement required by Section 36 VSBG on whether you are willing or obliged to take part in dispute
            resolution proceedings before a consumer arbitration board
          </Todo>
        </p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy policy',
    description: 'Information about data protection on this website and in the PST Viewer app.',
    placeholderNotice: 'Placeholder: the marked details must be completed and legally reviewed before going live.',
    body: (
      <>
        <h2>1. Controller</h2>
        <p>
          Mario Kernich
          <br />
          <Todo>address</Todo>
          <br />
          Email: <Todo>email address</Todo>
        </p>
        <h2>2. Overview</h2>
        <p>
          This website provides information about the PST Viewer app. It sets no cookies, uses no analytics or tracking
          tools and embeds no third-party content. Fonts and all other files are served directly from our server.
        </p>
        <h2>3. Hosting and server log files</h2>
        <p>
          When you visit the website, the hosting provider processes technically necessary data (e.g. IP address, time
          of access, requested page, browser type) to deliver the website and keep it secure.
        </p>
        <p>
          <Todo>
            add the hosting provider, server location, log retention period, legal basis (e.g. Art. 6(1)(f) GDPR) and,
            if applicable, the data processing agreement
          </Todo>
        </p>
        <h2>4. No cookies, no tracking</h2>
        <p>This website sets no cookies and uses neither analytics nor marketing services. No usage profiles are created.</p>
        <h2>5. Local storage of the appearance</h2>
        <p>
          If you choose an appearance (light, dark or system), the website stores this setting in your browser’s local
          storage (localStorage, key “theme”). The setting never leaves your device and is not sent to us. You can delete
          it at any time in your browser settings.
        </p>
        <h2>6. Contact</h2>
        <p>
          <Todo>describe how enquiries (e.g. by email) are processed: purpose, legal basis and retention period</Todo>
        </p>
        <h2>7. The PST Viewer app</h2>
        <p>
          The app processes your files exclusively on your device. No content is uploaded, no usage data (telemetry) is
          collected and no tracking is used. Remote images in emails are blocked by default.
        </p>
        <p>
          Purchases are handled by the respective store (Mac App Store, Microsoft Store, App Store, Google Play); the
          privacy policy of the respective store operator applies. <Todo>review and complete the store information</Todo>
        </p>
        <h2>8. Your rights</h2>
        <p>
          <Todo>
            add the data subject rights under Art. 15 to 21 GDPR and the right to lodge a complaint with a supervisory
            authority under Art. 77 GDPR
          </Todo>
        </p>
        <h2>9. Last updated</h2>
        <p>
          <Todo>date of the last update</Todo>
        </p>
      </>
    ),
  },
}

export const legal: Record<Locale, Record<LegalId, LegalPage>> = { de: legalDe, en: legalEn }
