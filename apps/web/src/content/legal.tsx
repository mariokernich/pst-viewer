import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import type { LegalId } from '@/lib/routes'

/**
 * Legal pages (legal notice and privacy policy). The website facts stated
 * here – hosted on GitHub Pages, no cookies, no tracking, fonts served with
 * the site, theme stored in localStorage – reflect the current
 * implementation; keep them in sync and update `lastUpdated` with every
 * change. PST Viewer is free and open source, so there is nothing about sales
 * or payments.
 */

const githubPrivacyStatement =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement'

export interface LegalPage {
  title: string
  description: string
  body: ReactNode
}

const owner = {
  name: 'Mario Kernich',
  street: 'Veiter Berg 1',
  city: '97294 Unterpleichfeld',
  email: 'mario@kernich.de',
  phone: '+49 1511 0573779',
}

const lastUpdated = { de: 'Oktober 2026', en: 'October 2026' }

function Address({ country }: { country: string }) {
  return (
    <>
      {owner.name}
      <br />
      {owner.street}
      <br />
      {owner.city}
      <br />
      {country}
    </>
  )
}

const mail = <a href={`mailto:${owner.email}`}>{owner.email}</a>
const phone = <a href={`tel:${owner.phone.replace(/\s/g, '')}`}>{owner.phone}</a>

const legalDe: Record<LegalId, LegalPage> = {
  legalNotice: {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung von PST Viewer.',
    body: (
      <>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          <Address country="Deutschland" />
        </p>
        <h2>Kontakt</h2>
        <p>
          E-Mail: {mail}
          <br />
          Telefon: {phone}
        </p>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          {owner.name}, {owner.street}, {owner.city}
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
    body: (
      <>
        <h2>1. Verantwortlicher</h2>
        <p>
          <Address country="Deutschland" />
          <br />
          E-Mail: {mail}
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
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in einer sicheren und
          zuverlässigen Bereitstellung der Website. Die Übermittlung in die USA stützt sich auf den
          Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework (Art. 45 DSGVO), unter dem GitHub
          zertifiziert ist. Wir selbst haben keinen Zugriff auf diese Logdateien; wie lange GitHub sie speichert, ergibt
          sich aus der Datenschutzerklärung von GitHub.
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
          Wenn Sie uns per E-Mail oder Telefon kontaktieren, verarbeiten wir Ihre Angaben (z. B. Name, E-Mail-Adresse,
          Inhalt der Anfrage) ausschließlich, um Ihre Anfrage zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
          DSGVO, soweit die Anfrage auf einen Vertrag oder vorvertragliche Maßnahmen zielt, im Übrigen Art. 6 Abs. 1 lit.
          f DSGVO (berechtigtes Interesse an der Beantwortung). Wir löschen die Daten, sobald die Anfrage erledigt ist und
          keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Beiträge in Issues oder Pull Requests auf GitHub sind
          öffentlich; dafür gilt die Datenschutzerklärung von GitHub.
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
          Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
          Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage von
          Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Wenden Sie sich dazu an {mail}.
        </p>
        <p>
          Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel beim
          für uns zuständigen Bayerischen Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.
        </p>
        <h2>10. Stand</h2>
        <p>{lastUpdated.de}</p>
      </>
    ),
  },
}

const legalEn: Record<LegalId, LegalPage> = {
  legalNotice: {
    title: 'Legal notice',
    description: 'Provider information for PST Viewer.',
    body: (
      <>
        <h2>Information pursuant to Section 5 of the German Digital Services Act (DDG)</h2>
        <p>
          <Address country="Germany" />
        </p>
        <h2>Contact</h2>
        <p>
          Email: {mail}
          <br />
          Phone: {phone}
        </p>
        <h2>Responsible for the content pursuant to Section 18(2) of the German Interstate Media Treaty (MStV)</h2>
        <p>
          {owner.name}, {owner.street}, {owner.city}, Germany
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
    body: (
      <>
        <h2>1. Controller</h2>
        <p>
          <Address country="Germany" />
          <br />
          Email: {mail}
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
          The legal basis is Art. 6(1)(f) GDPR; our legitimate interest is the secure and reliable provision of the
          website. The transfer to the USA is based on the European Commission’s adequacy decision for the EU-US Data
          Privacy Framework (Art. 45 GDPR), under which GitHub is certified. We have no access to these log files
          ourselves; how long GitHub keeps them is described in GitHub’s privacy statement.
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
          If you contact us by email or phone, we process your details (e.g. name, email address, content of the enquiry)
          only to answer your enquiry. The legal basis is Art. 6(1)(b) GDPR where the enquiry relates to a contract or
          pre-contractual measures, otherwise Art. 6(1)(f) GDPR (legitimate interest in answering). We delete the data
          once the enquiry has been dealt with, unless statutory retention obligations apply. Contributions to issues or
          pull requests on GitHub are public; GitHub’s privacy statement applies to them.
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
          You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of
          processing (Art. 18), data portability (Art. 20) and to object to processing based on Art. 6(1)(f) GDPR (Art.
          21). To exercise these rights, write to {mail}.
        </p>
        <p>
          You also have the right to lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), for
          example the Bavarian Data Protection Authority responsible for us (Bayerisches Landesamt für
          Datenschutzaufsicht, Promenade 18, 91522 Ansbach, Germany).
        </p>
        <h2>10. Last updated</h2>
        <p>{lastUpdated.en}</p>
      </>
    ),
  },
}

export const legal: Record<Locale, Record<LegalId, LegalPage>> = { de: legalDe, en: legalEn }
