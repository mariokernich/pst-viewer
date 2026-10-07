# PST Viewer for iPhone and iPad

The native SwiftUI app of PST Viewer: a strictly read-only viewer for Outlook data files (`.pst`), Outlook items (`.msg`), e-mails (`.eml`, `.emlx`), MBOX mailboxes (Google Takeout with Gmail labels as folders, Apple Mail, Thunderbird) and folders of mail files. It has the same features as the [desktop app](../desktop) and uses the shared Rust core ([`crates/core`](../../crates/core)) for reading, searching and exporting.

- **Welcome screen** with recently opened files and folders (location, size, item count, missing files), opening via the file picker, *Open in* / Files and drag & drop on the iPad.
- **Mailbox**: folder tree with the localised Outlook folders and unread counts, message list grouped by date with avatars, search highlighting, paging and sorting, reading view; three columns on the iPad, a navigation stack on the iPhone.
- **Search** as you type in all folders or the current folder, suggestions (fields, senders, folders, recent searches, quick filters), all filters of the desktop app with removable chips, and the query syntax in German and English.
- **Reading view**: sanitised HTML in a locked-down web view (no JavaScript from the message, nothing stored, no network until *Load Images* is tapped for a message), plain text with links, inline images, appointment, contact and task details, internet headers, attached messages to any depth, previous/next message.
- **Attachments**: Quick Look for PDF, images, Office documents, text, audio and video from a read-only temporary copy; calendar invitations and contacts as cards, CSV as table, HTML sanitised; types that can run code are only saved. Share or save one or all attachments.
- **Export and print**: PDF (A4 or Letter with page numbers), `.eml` and plain text via the share sheet, printing via AirPrint.
- **Settings**: appearance, language (per-app language in the Settings app), privacy statement and open-source licences.
- German and English, light and dark mode, Dynamic Type, VoiceOver labels, iPad keyboard shortcuts and menu bar commands.

## Requirements

- Xcode 27 or newer (the app is built with the iOS 27 SDK and runs on iOS 17.0 or newer)
- For rebuilding the core: Rust via rustup with the targets `aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios` (see [`crates/core/README.md`](../../crates/core/README.md))

## Building

The core comes as local Swift package `PstViewerCore`: the XCFramework (`PstViewerCore/PstViewerCoreFFI.xcframework`) and the Swift bindings (`PstViewerCore/Sources/PstViewerCore/PstViewerCore.swift`) are generated and not checked in. Build them once after cloning and again after changing the core:

```bash
crates/core/scripts/build-ios.sh              # release build
PROFILE=dev crates/core/scripts/build-ios.sh  # debug build, faster
```

Open `apps/ios/PstViewer.xcodeproj` in Xcode and run the *PstViewer* scheme, or build from the command line:

```bash
xcodebuild -project apps/ios/PstViewer.xcodeproj -scheme PstViewer \
  -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -project apps/ios/PstViewer.xcodeproj -scheme PstViewer \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

Every file under `PstViewer/` is part of the app target (file-system synchronized group); `Config/Info.plist` declares the document types. Strings live in `PstViewer/Localizable.xcstrings` (English source, German translation); the document type names in `InfoPlist.xcstrings`. After changing the core's dependencies, regenerate the licence list with `apps/ios/scripts/generate-licenses.py`.

## Architecture

```
PstViewer/
  App/        entry point, root view (open URL, file importer, drops), menu commands, demo driver (debug)
  Models/     observable state: AppModel (window), OpeningModel, MailboxModel (folders, search,
              paging, selection), attachment preview, search suggestions, filter chips, toasts
  Services/   ArchiveConnection (core bridge), recent files with bookmarks, temporary files,
              web content rules, PDF rendering and printing, export documents, share/save transfers
  Support/    date/size formatting, people (initials, avatar colours), folder names, labels of core enums
  Views/      Welcome, Mailbox, Message, Attachments, Search, Settings, Shared
  Resources/  ThirdPartyLicenses.json
PstViewerTests/  unit tests and core integration tests (Swift Testing)
```

- **Core bridge**: every `ArchiveSession` call blocks until the archive's worker thread answers, so `ArchiveConnection` runs the calls on a private serial queue and exposes them as `async` functions. Archives are opened through an `NSFileCoordinator`, so iCloud Drive placeholders are downloaded first. Listener callbacks arrive on the worker thread and are handed to the main actor (`ArchiveEvents`).
- **State** follows the desktop app's store (`apps/desktop/src/renderer/src/store.ts`): debounced search, silent refreshes while bodies are indexed, results paged in blocks of 100 as rows appear, a small detail cache, remote images allowed per message.
- **Files**: files are opened in place. Security-scoped bookmarks of recent files are stored in `Application Support/RecentFiles.json` (names, sizes, locations and bookmarks only, never mail content); the security scope stays open while an archive is open. Copies the system hands to the app (*Open in*, some drops) live in `Documents/Inbox` and are deleted with their recents entry.
- **Mail content** is sanitised by the core (`prepareMailDocument`, CSP-locked) and shown in a `WKWebView` with content JavaScript disabled, a non-persistent data store and a content rule list that blocks every `http`, `https`, `ws` and `ftp` load until the user allows remote images for that message. Links open in the system browser (`http`, `https`, `mailto`, `tel`); long-pressing a link shows its address instead of a web preview. The app's own scripts (search highlighting, scaling fixed-width newsletters to the screen) run in a separate script world.
- **Attachments** for Quick Look are written read-only (`0444`) to `tmp/Files/<uuid>/` and deleted when the preview closes; leftovers are removed at launch. Exports are produced only when a share or save destination asks for them.
- **PDF** export renders the core's print document (`buildPrintDocument`) in an off-screen web view and paginates it with `UIPrintPageRenderer` (A4, Letter in the Americas, subject and page numbers in the footer).

## Testing with launch arguments

Debug builds accept launch arguments that drive the UI into a state, for screenshots and manual tests on the simulator (`simctl launch` passes everything after the bundle identifier to the app):

| Argument | Effect |
| --- | --- |
| `-demoOpen <path>` | opens a file or folder |
| `-demoFolder <name>` | selects a folder by (display) name |
| `-demoSearch <text>` | searches for the text |
| `-demoUnread`, `-demoAttachments` | sets these filters |
| `-demoSelect <row>` | selects the message in this row |
| `-demoAttached` | opens the first attached message of the selected one |
| `-demoAttachment <index>` | previews this attachment of the selected message |
| `-demoRemote` | loads the remote images of the selected message |
| `-demoTextBody` | shows the text instead of the HTML body |
| `-demoHeaders`, `-demoFilters`, `-demoSyntax`, `-demoSettings` | opens these sheets |
| `-demoExportPreview` | renders the selected message as PDF and shows it in Quick Look |
| `-demoPrint` | opens the print dialog for the selected message |
| `-demoOpening` | shows the opening progress with sample values |
| `-demoSuggest` | focuses the search field to show suggestions (iOS 18+) |
| `-demoSidebar` | starts with the folders on the iPhone |
| `-demoColumns all` | shows all three columns on the iPad |

```bash
python3 tools/demo-data/make-demo-archive.py /tmp/demo          # fictional demo mailbox
xcrun simctl install booted <DerivedData>/Build/Products/Debug-iphonesimulator/PstViewer.app
xcrun simctl launch booted de.kernich.pstviewer -AppleLanguages "(de)" \
  -demoOpen /tmp/demo/Demo-Postfach.mbox -demoSelect 0
xcrun simctl io booted screenshot welcome.png
```

## App Store notes

- One-time purchase without in-app purchases, ads, accounts, analytics or crash reporting SDKs. Privacy nutrition label: **Data Not Collected**.
- The only network access is loading remote images the user allows for a message; links open in the system browser. No entitlements beyond the defaults are needed, no usage descriptions are required.
- `ITSAppUsesNonExemptEncryption` is `NO` (`Config/Info.plist`); the app contains no encryption.
- `PstViewer/PrivacyInfo.xcprivacy` declares no tracking and no collected data, plus the reasons for the required-reason APIs: user defaults (`CA92.1`), file metadata of user-picked files and container files (`3B52.1`, `C617.1`, used by the core) and elapsed-time measurement (`35F9.1`).
- The app is a *Viewer* for its document types (`LSHandlerRank` *Alternate*) and opens files in place (`LSSupportsOpeningDocumentsInPlace`).
- Open-source licences are shown in the app (Settings → Open-Source Licences), including Microsoft's outlook-pst (MIT) and all Rust crates of the core.

## Known limitations

- Encrypted S/MIME messages cannot be decrypted (the archive does not contain the private key).
- Outlook for Mac archives (`.olm`) are not supported.
- Plain text bodies are shown with clickable links but without the desktop's styling of quoted lines.
