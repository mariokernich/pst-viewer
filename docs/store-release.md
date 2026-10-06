# Store release guide

PST Viewer is sold as a one-time purchase of **4,99 €** in four stores. There are no in-app purchases, subscriptions, ads, accounts or tracking.

| Store | App | Package | Identifier | Build |
| --- | --- | --- | --- | --- |
| Mac App Store | `apps/desktop` (Electron) | `.pkg` (universal) | `de.kernich.pstviewer` | `APPLE_TEAM_ID=… pnpm --filter @pst-viewer/desktop dist:mas` |
| Microsoft Store | `apps/desktop` (Electron) | `.appx`/MSIX (x64, arm64) | Partner Center identity | `pnpm --filter @pst-viewer/desktop dist:appx` (on Windows) |
| App Store (iPhone, iPad) | `apps/ios` (SwiftUI) | Xcode archive | `de.kernich.pstviewer` | Xcode → Product → Archive |
| Google Play | `apps/android` (Compose) | `.aab` | `de.kernich.pstviewer` | `./gradlew bundleRelease` |

The native apps need the Rust core first: `crates/core/scripts/build-ios.sh` and `crates/core/scripts/build-android.sh`.

## Decisions to make before the first submission

1. **One purchase for Mac and iPhone/iPad, or two?** The Mac app and the iOS app currently share the bundle id `de.kernich.pstviewer`. Apps with the same bundle id belong to one App Store Connect record and are a *universal purchase*: buying once unlocks both. If Mac and iOS shall be sold separately (4,99 € each), give the iOS app its own bundle id (e.g. `de.kernich.pstviewer.ios`) before creating the records — this cannot be changed later.
2. **Seller name.** Stores show the developer name publicly (individual: your legal name; company: the company name, needs a D-U-N-S number at Apple and Google).
3. **Legal pages.** The website's legal notice and privacy policy (`apps/web/src/content/legal.tsx`) still contain TODO markers. All stores require a privacy policy URL; the EU requires trader contact details (below).

## Accounts and fees

| Store | Account | Fee | Commission |
| --- | --- | --- | --- |
| Apple (Mac + iOS) | Apple Developer Program | 99 USD per year | 15 % with the App Store Small Business Program (apply once), otherwise 30 % |
| Google Play | Play Console developer account | 25 USD once | 15 % on the first 1 M USD per year |
| Microsoft Store | Partner Center (individual or company) | free for individual developers (since September 2025), 99 USD once for companies | 15 % for apps using Microsoft's commerce |

- **EU Digital Services Act:** Apple and Google publish the address, phone number and email of traders who sell in the EU. A paid app makes you a trader; use a business address if you do not want to publish your home address.
- **Taxes and payouts:** fill in the tax forms (W-8BEN for non-US sellers) and bank details in every store before the app can be paid. The stores are the merchant of record and handle VAT; prices are entered including VAT.
- **Google Play, new personal accounts:** personal developer accounts created after 13 November 2023 need a closed test with at least 12 testers opted in for 14 days before they can apply for production access. Organization accounts are exempt. Plan this in.

## Price

Set **4,99 €** as the base price in each store and let the store convert it for other countries (or set EUR prices explicitly):

- App Store Connect → Pricing and Availability → price 4,99 € (EU base country Germany).
- Play Console → Monetize → Products → App pricing → 4,99 €; the app must be marked as paid *before* the first release (a free app cannot become paid later).
- Partner Center → Pricing and availability → 4,99 € (price tier).

## Privacy and compliance answers

All apps work offline on the user's device. Nothing is collected, transmitted or shared.

| Question | Answer |
| --- | --- |
| Apple privacy "nutrition" label | Data Not Collected |
| Google Play Data safety | No data collected, no data shared; no encryption in transit needed (no data leaves the device) |
| Microsoft privacy policy | link to the website's privacy page |
| Privacy policy URL | `https://<domain>/en/privacy` and `/de/datenschutz` |
| Export compliance (Apple) | No non-exempt encryption (`ITSAppUsesNonExemptEncryption = NO` is set) |
| Age rating | 4+ (Apple), "Everyone" via IARC (Google, Microsoft); the app shows the user's own files |
| Network access | Only remote images the user allows for a single message, and links the user taps (system browser) |
| Ads, tracking, accounts | none |

## Review notes (paste into each store)

> PST Viewer is a read-only viewer for e-mail archives (Outlook .pst, .msg, .eml, MBOX). It never modifies the files and works offline. To test, open the attached sample mailbox "Demo-Postfach.mbox" (generated with fictional data) via "Open file". There is no login and no in-app purchase.

Generate the sample with `python3 tools/demo-data/make-demo-archive.py demo` and attach `demo/Demo-Postfach.mbox` (App Review Information → Attachment) or host it on the website.

Trademarks: the app name does not contain "Outlook". Use "Outlook" only descriptively in the description ("opens Outlook data files (.pst)"), never in keywords, and keep the trademark notice of the website.

## Mac App Store

1. developer.apple.com → Identifiers: App ID `de.kernich.pstviewer` (no capabilities needed). Certificates: *Apple Distribution* and *Mac Installer Distribution* in the keychain. Profiles: *Mac App Store* distribution profile for the App ID → save as `apps/desktop/build/embedded.provisionprofile` (git-ignored).
2. `APPLE_TEAM_ID=ABCDE12345 pnpm --filter @pst-viewer/desktop dist:mas` builds `dist/mas-universal/PST Viewer-<version>-universal.pkg`, signed with the installer certificate.
3. Test the sandboxed build before uploading (build once with a *Mac Development* profile and `type: development`): open a PST via the dialog, reopen it from the recent files after a restart, open a file by drag & drop and reopen it (the app asks for access again), save an attachment, export PDF/EML/text, preview attachments, load remote images.
4. Upload with the Transporter app, then select the build in App Store Connect.

Sandbox notes: the app may read files the user picked (open dialog, drag & drop, Finder) and write files the user saves. Recent files are reopened through security-scoped bookmarks; entries without a bookmark (opened by drag & drop or from Finder) ask the user to confirm the file once. The PST worker is restarted for every opened file, so it inherits the sandbox access of the main process.

## Microsoft Store

1. Partner Center → Apps and games → New product → MSIX or PWA app → reserve the name "PST Viewer".
2. Product management → Product identity: copy *Package/Identity/Name* and *Package/Identity/Publisher*.
3. On Windows: `set MS_STORE_IDENTITY_NAME=…`, `set MS_STORE_PUBLISHER=CN=…`, `pnpm --filter @pst-viewer/desktop dist:appx`. The store signs the package; local test installs need a self-signed certificate.
4. Submission: pricing 4,99 €, properties (category *Productivity*, privacy policy URL), age rating questionnaire, store listings (de-DE, en-US) with screenshots (at least 1366 × 768), upload the `.appx` files for x64 and arm64.

## App Store (iPhone, iPad)

1. Xcode → `apps/ios/PstViewer.xcodeproj` → target PstViewer → Signing & Capabilities → select the team (automatic signing). Bundle id see "Decisions" above.
2. Build the core (`crates/core/scripts/build-ios.sh`), then Product → Archive → Distribute App → App Store Connect.
3. App Store Connect: app record, pricing 4,99 €, privacy label, age rating, screenshots, review notes; test with TestFlight first.

## Google Play

1. Create the app in Play Console as **paid app** (a free app cannot become paid later), default language German.
2. Signing: enroll in Play App Signing; create an upload key (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`) and configure it as described in `apps/android/README.md` (never commit the keystore or passwords).
3. `./gradlew bundleRelease` in `apps/android` → upload `app/build/outputs/bundle/release/app-release.aab` to a closed test track first (12 testers for 14 days for new personal accounts), then apply for production access.
4. App content: privacy policy, ads (none), app access (no login), content rating (IARC), target audience (adults), data safety (no data collected), news app (no).

## Screenshots

Use the fictional demo mailbox (`tools/demo-data/make-demo-archive.py`) for every screenshot. Never show real mail.

| Store | Required sizes (portrait unless noted) |
| --- | --- |
| App Store, iPhone | 6.9" display: 1320 × 2868 (or 1290 × 2796) |
| App Store, iPad | 13" display: 2064 × 2752 (or 2048 × 2732) |
| Mac App Store | 2880 × 1800, 2560 × 1600, 1440 × 900 or 1280 × 800 (landscape) |
| Google Play | phone: 2–8 screenshots, 16:9 or 9:16, min. 1080 px recommended; 7" and 10" tablets; feature graphic 1024 × 500 |
| Microsoft Store | at least 1366 × 768 (landscape), up to 10 |

Suggested set (same order everywhere): 1. mailbox with folders, list and an HTML mail; 2. search with filter chips and highlighted results; 3. attachment preview (PDF); 4. export menu / PDF export; 5. welcome screen with recent files; 6. dark mode.

## Store listing

### German

**Name:** PST Viewer
**Untertitel (App Store, 30 Zeichen):** E-Mail-Archive sicher lesen
**Kurzbeschreibung (Google Play, 80 Zeichen):** PST-, MSG-, EML- und MBOX-Dateien öffnen, durchsuchen und lesen – ohne Outlook.
**Werbetext (App Store, 170 Zeichen):** Alte Mail-Archive in Sekunden öffnen und durchsuchen – streng schreibgeschützt, ohne Konto, ohne Abo, ohne Tracking. Einmal kaufen, für immer nutzen.
**Schlüsselwörter (App Store, 100 Zeichen):** pst,msg,eml,mbox,e-mail,archiv,postfach,mailarchiv,takeout,thunderbird,anhang,viewer

**Beschreibung:**

PST Viewer öffnet E-Mail-Archive schnell, sicher und ausschließlich lesend – ganz ohne Outlook.

FORMATE
• Outlook-Datendateien (.pst) – auch große Archive mit mehreren Gigabyte
• Outlook-Elemente (.msg), E-Mails (.eml, .emlx)
• MBOX-Postfächer aus Gmail/Google Takeout (Labels werden zu Ordnern), Apple Mail und Thunderbird
• Ordner mit E-Mail-Dateien

SUCHEN UND FINDEN
• Volltextsuche während der Eingabe – in allen Ordnern oder nur im aktuellen
• Filter für Zeitraum, Absender, Empfänger, Anhänge, Anhangtyp, ungelesen, wichtig, markiert und mehr
• Suchsyntax auf Deutsch und Englisch, z. B. von:anna hat:anhang nach:1.3.2024
• „muller“ findet auch „Müller“; Treffer werden hervorgehoben

LESEN
• Vertraute Ansicht mit Ordnern, nach Datum gruppierter Liste und Lesebereich
• HTML-Mails sicher dargestellt, externe Bilder bleiben blockiert, bis Sie sie erlauben
• Termine, Kontakte und Aufgaben übersichtlich; digital signierte Nachrichten
• Angehängte Nachrichten direkt öffnen

ANHÄNGE UND EXPORT
• Vorschau für PDF, Bilder, Text, Tabellen, Kalender- und Kontaktdateien
• Anhänge einzeln oder alle auf einmal speichern
• Nachrichten als PDF, als E-Mail-Datei (.eml) oder als Text exportieren und drucken

DATENSCHUTZ
• Alles bleibt auf Ihrem Gerät: kein Upload, keine Cloud, kein Tracking
• Ihre Dateien werden niemals verändert
• Kein Konto, kein Abo, keine Werbung – einmal kaufen, dauerhaft nutzen

Microsoft und Outlook sind Marken der Microsoft-Unternehmensgruppe. PST Viewer ist ein unabhängiges Produkt und steht in keiner Verbindung zu Microsoft.

### English

**Name:** PST Viewer
**Subtitle (App Store, 30 characters):** Read email archives safely
**Short description (Google Play, 80 characters):** Open, search and read PST, MSG, EML and MBOX files – no Outlook needed.
**Promotional text (App Store, 170 characters):** Open and search old mail archives in seconds – strictly read-only, no account, no subscription, no tracking. Buy once, use forever.
**Keywords (App Store, 100 characters):** pst,msg,eml,mbox,email,archive,mailbox,mail archive,takeout,thunderbird,attachment,viewer

**Description:**

PST Viewer opens email archives quickly, safely and strictly read-only – no Outlook required.

FORMATS
• Outlook data files (.pst) – even large archives of several gigabytes
• Outlook items (.msg), emails (.eml, .emlx)
• MBOX mailboxes from Gmail/Google Takeout (labels become folders), Apple Mail and Thunderbird
• Folders of mail files

SEARCH AND FIND
• Full-text search as you type – in all folders or just the current one
• Filters for date range, sender, recipient, attachments, attachment type, unread, important, flagged and more
• Search syntax in English and German, e.g. from:anna has:attachment after:2024-03-01
• "muller" also finds "Müller"; matches are highlighted

READ
• Familiar layout with folders, a list grouped by date and a reading pane
• HTML emails shown safely; remote images stay blocked until you allow them
• Appointments, contacts and tasks at a glance; digitally signed messages
• Open attached messages directly

ATTACHMENTS AND EXPORT
• Preview PDFs, images, text, tables, calendar and contact files
• Save attachments one by one or all at once
• Export messages as PDF, email file (.eml) or text, and print them

PRIVACY
• Everything stays on your device: no upload, no cloud, no tracking
• Your files are never modified
• No account, no subscription, no ads – buy once, use forever

Microsoft and Outlook are trademarks of the Microsoft group of companies. PST Viewer is an independent product and is not affiliated with Microsoft.

## Release checklist

- [ ] Version numbers: `apps/desktop/package.json`, iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`, Android `versionName`/`versionCode`
- [ ] Tests: `pnpm test`, `cargo test -p pst-viewer-core`, iOS and Android builds
- [ ] Website: legal pages completed, store links in `apps/web/src/lib/site.ts`, real screenshots
- [ ] Sandboxed Mac build tested (see above)
- [ ] Screenshots and listing texts in all stores (de + en)
- [ ] Price 4,99 €, privacy answers, age rating, review notes with the demo mailbox
