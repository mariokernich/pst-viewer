import type { ReactNode } from 'react'
import { Todo } from '@/components/legal/todo'
import type { Locale } from '@/lib/i18n'
import type { LegalId } from '@/lib/routes'

/**
 * Legal pages. These are PLACEHOLDERS: every <Todo> has to be completed (and
 * the texts reviewed) before the site goes live. The website facts stated
 * here – hosted on GitHub Pages, no cookies, no tracking, fonts served with
 * the site, theme stored in localStorage – reflect the current
 * implementation; keep them in sync. PST Viewer is free and open source, so
 * there is nothing about sales or payments.
 */

const githubPrivacyStatement =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement'

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
        <h2>Open-Source-Projekt</h2>
        <p>
          PST Viewer ist ein kostenloses Open-Source-Projekt unter der MIT-Lizenz. Der Quellcode wird öffentlich auf
          GitHub entwickelt: <a href="https://github.com/mariokernich/pst-viewer">github.com/mariokernich/pst-viewer</a>
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
          Diese Website informiert über die kostenlose Open-Source-App PST Viewer. Sie setzt keine Cookies, verwendet
          keine Analyse- oder Tracking-Werkzeuge und bindet keine Inhalte von Drittanbietern ein. Schriften, Bilder und
          alle übrigen Dateien werden zusammen mit der Website über GitHub Pages ausgeliefert.
        </p>
        <h2>3. Hosting über GitHub Pages und Server-Logdateien</h2>
        <p>
          Diese Website wird über GitHub Pages bereitgestellt, einen Dienst der GitHub, Inc., 88 Colin P. Kelly Jr.
          Street, San Francisco, CA 94107, USA. Beim Aufruf der Website verarbeitet GitHub technisch notwendige Daten –
          insbesondere Ihre IP-Adresse, Zeitpunkt des Abrufs, aufgerufene Seite und Browsertyp – in Server-Logdateien, um
          die Website auszuliefern und ihre Sicherheit zu gewährleisten. Dabei können Daten in die USA übermittelt
          werden. Einzelheiten finden Sie in der{' '}
          <a href={githubPrivacyStatement}>Datenschutzerklärung von GitHub</a>.
        </p>
        <p>
          <Todo>
            Rechtsgrundlage (z. B. Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse an einer sicheren und
            zuverlässigen Bereitstellung), Grundlage der Übermittlung in die USA (z. B. EU-US Data Privacy Framework)
            und Speicherdauer der Logdateien prüfen und ergänzen
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
        <h2>7. Links zu GitHub</h2>
        <p>
          Downloads, Quellcode, Releases und Issues liegen auf GitHub. Wenn Sie einem dieser Links folgen, verlassen Sie
          diese Website; für die Verarbeitung Ihrer Daten durch GitHub gilt dann die{' '}
          <a href={githubPrivacyStatement}>Datenschutzerklärung von GitHub</a>.
        </p>
        <h2>8. Die App PST Viewer</h2>
        <p>
          Die App verarbeitet Ihre Dateien ausschließlich lokal auf Ihrem Gerät. Es werden keine Inhalte hochgeladen,
          keine Nutzungsdaten (Telemetrie) erhoben und kein Tracking eingesetzt. Externe Bilder in E-Mails werden
          standardmäßig blockiert und nur geladen, wenn Sie es für eine Nachricht erlauben.
        </p>
        <p>
          Laden Sie die App künftig über einen Store herunter (Mac App Store, Microsoft Store, App Store, Google Play),
          gelten für den Download die Datenschutzbestimmungen des jeweiligen Store-Betreibers.
        </p>
        <h2>9. Ihre Rechte</h2>
        <p>
          <Todo>
            Betroffenenrechte nach Art. 15 bis 21 DSGVO sowie das Beschwerderecht bei einer Aufsichtsbehörde nach Art.
            77 DSGVO ergänzen
          </Todo>
        </p>
        <h2>10. Stand</h2>
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
        <h2>Open source project</h2>
        <p>
          PST Viewer is a free open source project under the MIT license. The source code is developed in public on
          GitHub: <a href="https://github.com/mariokernich/pst-viewer">github.com/mariokernich/pst-viewer</a>
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
          This website provides information about the free open source app PST Viewer. It sets no cookies, uses no
          analytics or tracking tools and embeds no third-party content. Fonts, images and all other files are served
          together with the website via GitHub Pages.
        </p>
        <h2>3. Hosting on GitHub Pages and server log files</h2>
        <p>
          This website is hosted on GitHub Pages, a service of GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
          Francisco, CA 94107, USA. When you visit the website, GitHub processes technically necessary data – in
          particular your IP address, time of access, requested page and browser type – in server log files to deliver
          the website and keep it secure. This may involve a transfer of data to the USA. For details, see the{' '}
          <a href={githubPrivacyStatement}>GitHub General Privacy Statement</a>.
        </p>
        <p>
          <Todo>
            review and add the legal basis (e.g. Art. 6(1)(f) GDPR, legitimate interest in a secure and reliable
            website), the basis for the transfer to the USA (e.g. the EU-US Data Privacy Framework) and the log retention
            period
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
        <h2>7. Links to GitHub</h2>
        <p>
          Downloads, source code, releases and issues are hosted on GitHub. When you follow one of these links, you leave
          this website, and the <a href={githubPrivacyStatement}>GitHub General Privacy Statement</a> applies to the
          processing of your data by GitHub.
        </p>
        <h2>8. The PST Viewer app</h2>
        <p>
          The app processes your files exclusively on your device. No content is uploaded, no usage data (telemetry) is
          collected and no tracking is used. Remote images in emails are blocked by default and only loaded if you allow
          them for a message.
        </p>
        <p>
          If you download the app from a store in the future (Mac App Store, Microsoft Store, App Store, Google Play),
          the privacy policy of the respective store operator applies to that download.
        </p>
        <h2>9. Your rights</h2>
        <p>
          <Todo>
            add the data subject rights under Art. 15 to 21 GDPR and the right to lodge a complaint with a supervisory
            authority under Art. 77 GDPR
          </Todo>
        </p>
        <h2>10. Last updated</h2>
        <p>
          <Todo>date of the last update</Todo>
        </p>
      </>
    ),
  },
}

export const legal: Record<Locale, Record<LegalId, LegalPage>> = { de: legalDe, en: legalEn }
