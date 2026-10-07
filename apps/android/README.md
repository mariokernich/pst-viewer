# PST Viewer for Android

The native Android app of PST Viewer for phones, tablets and foldables: a strictly read-only viewer for Outlook data files (`.pst`), Outlook items (`.msg`), e-mails (`.eml`, `.emlx`), MBOX mailboxes (Google Takeout with Gmail labels as folders, Apple Mail, Thunderbird) and folders of mail files. It has the features of the [desktop app](../desktop) and uses the shared Rust core ([`crates/core`](../../crates/core)) for reading, searching and exporting.

- **Welcome screen** with recently opened files and folders (location, size, item count, missing files), the system file and folder pickers, and *Open with* / *Share* from other apps.
- **Opening** with progress (items, folder, phase) and cancel; errors explained in the welcome screen.
- **Mailbox**: folder tree with the localised Outlook folders, unread counts (the archive's unread total counts each message once, also with Gmail labels), store card with full-text index progress, message list grouped by date with avatars, search highlighting, paging and sorting. One pane with a navigation drawer on phones and narrow tablets, list and message side by side from 840 dp, folders | list | message from 1200 dp (`material3-adaptive`).
- **Search** as you type in all folders or the current folder, suggestions (fields, senders, folders, recent searches, quick filters), every filter of the desktop app in a bottom sheet (with a date range picker), removable chips, and the query syntax in German and English.
- **Reading view**: sanitised HTML in a locked-down WebView (no JavaScript, no file or content access, no network until *Load images* is tapped for that message), plain text with links and quote bars, search matches highlighted, inline images, appointment, task and contact cards, internet headers, attached messages to any depth, previous/next message.
- **Attachments**: previews for PDF (zoomable), images (also SVG), text, CSV, HTML, calendar invitations, contacts, audio and video; *Open with* another app and *Share* from a read-only temporary copy that is removed again; types that could run code can only be saved. Save one or all attachments (the core writes them straight into the documents the user picked).
- **Export and print**: PDF (A4, Letter in the Americas, subject and page numbers in the footer), `.eml` and plain text into a document the user creates, *Share as PDF*, printing through the Android print framework.
- **Settings**: theme (system, light, dark), dynamic colour (Android 12+), language (also in the system's per-app language settings), privacy statement, search syntax, open-source licences, clearing the recent files.
- German and English, light and dark theme, edge-to-edge, predictive back, TalkBack labels, font scaling (also in mail bodies), hardware keyboard shortcuts.

## Requirements

- JDK 17 or newer (the one bundled with Android Studio works) and the Android SDK with platform 37 (`local.properties` with `sdk.dir`, or `ANDROID_HOME`)
- For the Rust core: Rust via rustup with the targets `aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`, the Android NDK (newest in the SDK, or `ANDROID_NDK_HOME`) and `cargo install cargo-ndk` (see [`crates/core/README.md`](../../crates/core/README.md))
- Android Studio (current stable) to work on the app; it opens `apps/android` as Gradle project

## Building

The core's libraries (`app/src/main/jniLibs/<abi>/libpst_viewer_core.so`) and Kotlin bindings (`app/src/generated/kotlin`) are generated and not checked in. Gradle builds them before every build with `crates/core/scripts/build-android.sh` (task `buildRustCore`, hooked before `preBuild`):

```bash
cd apps/android
./gradlew assembleDebug                      # builds the core (release profile) and the debug APK
./gradlew assembleDebug -PrustProfile=dev    # unoptimised core, builds faster
./gradlew assembleDebug -PskipRustCore=true  # keeps the core that is already in place
./gradlew assembleRelease                    # minified (R8) and resource-shrunk release APK
./gradlew bundleRelease                      # App Bundle for Google Play
./gradlew lint test                          # Android Lint and unit tests
./gradlew installDebug                       # install on the running emulator or device
```

The core is built for `arm64-v8a`, `armeabi-v7a` and `x86_64` (the app's `abiFilters`), linked for 16 KB pages. JNA comes as AAR with its own `libjnidispatch.so` (also 16 KB aligned).

Two members of the core are renamed for Kotlin in `crates/core/uniffi.toml`, because they would clash with `AutoCloseable.close()` and `Throwable.message`: `ArchiveSession.closeArchive()` and the `reason` of the `CoreException` variants.

Strings live in `app/src/main/res/values/strings.xml` (English) and `values-de/strings.xml` (German); their wording follows the desktop app's `i18n.ts`. `generateLocaleConfig` derives the per-app language list from the resources. After changing the core's dependencies, regenerate the licence list `app/src/main/res/raw/rust_licenses.json` with `python3 apps/android/scripts/generate-rust-licenses.py`.

## Architecture

```
app/src/main/kotlin/
  android/print/           PdfWriter: drives a PrintDocumentAdapter into a file (PDF export)
  de/kernich/pstviewer/
    PstViewerApp.kt        Application and AppContainer (settings, recent files, temp files, renderer)
    MainActivity.kt        edge-to-edge Compose activity, VIEW/SEND intents
    data/                  archive sources (SAF documents and trees), FileAccess for the core,
                           open archives, recent files, settings, temp files, WebView lock-down,
                           export documents and PDF rendering/printing
    ui/                    navigation (Navigation 3), MainViewModel (opening, exports, saving),
                           theme, welcome, mailbox, search, message, attachments, settings
    util/                  formatting (ICU), people (initials, avatar colours), folder names,
                           labels of core enums, text decoding and CSV, HTML highlighting
app/src/test/kotlin/       unit tests (JUnit)
app/src/generated/kotlin/  UniFFI bindings of the core (generated)
```

- **Core bridge**: every `ArchiveSession` call blocks until the archive's worker thread answers, so `OpenArchive.call` runs them on `Dispatchers.IO`. Listener callbacks arrive on the worker thread and are passed on as `StateFlow`s (`ProgressRelay`).
- **Files** are read in place through the Storage Access Framework: `SafFileAccess` implements the core's `FileAccess` (lists a document tree, opens a document as detached file descriptor), so archives of any size are never copied. Picked documents and trees keep a persistable read permission while they are in the recent files; the list (names, sizes, locations and URIs, never mail content) is stored in shared preferences and excluded from backups and device transfers.
- **State** follows the desktop app's store: debounced search, silent refreshes while bodies are indexed, results paged in blocks of 100 as rows appear, a small detail cache, remote images allowed per message, the folder on screen indexed first (`prioritizeFolder`).
- **Navigation**: Navigation 3 with the back stack in `MainViewModel`; the mailbox is a `NavigableListDetailPaneScaffold` with the folders in a permanent pane (large widths) or a drawer. Each opened archive gets its own entries and view models.
- **Mail content** is sanitised by the core (`prepareMailDocument`, CSP locked) and shown in a WebView without JavaScript, file/content access or storage, with safe browsing on, `blockNetworkLoads` and `shouldInterceptRequest` blocking every request but `data:` until the user allows remote images for the message (then only `http(s)` GET). Links open in other apps (`http`, `https`, `mailto`, `tel`). WebView metrics are opted out. HTML mails keep their colours on a white card, plain text follows the theme.
- **Temporary files**: previews that need a file (PDF, audio, video) and copies for *Open with* / *Share* are written by the core into `cache/previews/<uuid>/`, made read-only and served by the app's `FileProvider`; they are deleted when the preview closes or the archive is closed. PDFs for *Share as PDF* go to `cache/exports/`. Both folders are cleared at every start.
- **Saving** goes through `ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT_TREE`: the core writes attachments and `.eml` files directly into the descriptor (`saveAttachmentFd`, `saveEmlFd`, mode `"wt"`); a document that could not be written completely is removed again.
- **PDF export** renders the core's print document (`buildPrintDocument`) in an off-screen WebView and writes it with `createPrintDocumentAdapter` (page size and footer via CSS `@page` rules). Printing hands the same document to the `PrintManager`.

## Testing

```bash
./gradlew test lint
python3 tools/demo-data/make-demo-archive.py /tmp/demo        # fictional demo mailbox (from the repo root)
adb push /tmp/demo/Demo-Postfach.mbox /tmp/demo/Demo-Ordner /sdcard/Download/
```

Open the files through *Open file …* / *Open folder …* (Storage Access Framework). Debug builds can also open a file from the app's own storage directly, which is handy for screenshots:

```bash
adb push /tmp/demo/Demo-Postfach.mbox /data/local/tmp/
adb shell run-as de.kernich.pstviewer cp /data/local/tmp/Demo-Postfach.mbox files/
adb shell am start -n de.kernich.pstviewer/.MainActivity \
  -e demoOpen /data/data/de.kernich.pstviewer/files/Demo-Postfach.mbox
adb shell cmd locale set-app-locales de.kernich.pstviewer --locales de-DE   # German
adb shell cmd uimode night yes                                              # dark theme
```

Things to check on a phone and a tablet AVD (e.g. `avdmanager create avd -n tablet -d pixel_tablet -k "system-images;android-37.1;google_apis_playstore_ps16k;arm64-v8a"`): opening and cancelling a large archive, search with filters, the reading view with remote images blocked, attachment previews, saving (single and *Save all*), PDF/EML/text export, printing, dark theme, German, font scaling and TalkBack. On tablets with a hardware keyboard: `Ctrl+F` or `/` search, `Ctrl+Alt+F` filters, `J`/`K` or arrow keys move through the list, `Enter` opens a message, `Ctrl+O` / `Ctrl+Shift+O` open a file / folder, `Ctrl+Shift+S` hides the folders, `Ctrl+Shift+W` closes the archive, `←`/`→` step through attachment previews.

## Signing

Release builds are signed with the key given by environment variables (CI) or an untracked `apps/android/keystore.properties`; without either they fall back to the debug key, so that `assembleRelease` works locally. Never commit keys or passwords (`keystore.properties`, `*.jks` and `*.keystore` are ignored).

```properties
# apps/android/keystore.properties
storeFile=/path/to/upload-key.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

Environment variables: `PST_VIEWER_KEYSTORE`, `PST_VIEWER_KEYSTORE_PASSWORD`, `PST_VIEWER_KEY_ALIAS`, `PST_VIEWER_KEY_PASSWORD`. Use Play App Signing and keep the upload key outside the repository.

## Google Play notes

- One-time purchase (paid app) without in-app purchases, ads, accounts, analytics, crash reporting or Firebase.
- **Data safety**: no data collected, no data shared. Mail stays on the device; the only network access is loading remote images the user allows for one message (WebView), links open in other apps. The `INTERNET` permission exists only for those images.
- Target API 37, minimum API 26. Native code is built for 16 KB pages (`-z max-page-size=16384`) and stored uncompressed and aligned in the APK/AAB, as Google Play requires for Android 15+ devices; `zipalign -c -P 16 -v 4 app-release.apk` verifies it.
- Upload an App Bundle (`bundleRelease`); Play delivers only the device's ABI. R8 keeps JNA and the generated bindings (`app/proguard-rules.pro`); upload `app/build/outputs/mapping/release/mapping.txt` for readable stack traces.
- Backups are off (`allowBackup=false`, data extraction rules exclude everything): the recent files' URI permissions do not move to other devices.
- Open-source licences are shown in the app (Settings → Open-source licences), including Microsoft's outlook-pst (MIT), JNA (used under Apache-2.0) and all Rust crates of the core.
- Supply chain: Gradle, plugins and libraries are pinned (`gradle/libs.versions.toml`, wrapper with `distributionSha256Sum`) and only updated to releases that are at least 24 hours old.

## Known limitations

- Material 3 Expressive components are not used yet: `MaterialExpressiveTheme` is still internal in the stable `material3` release.
- Encrypted S/MIME messages cannot be decrypted (the archive does not contain the private key).
- Outlook for Mac archives (`.olm`) are not supported.
- Searching for a person from an attached message is not offered (the search runs on the archive, not on the attached message).
- Search matches in a message body are highlighted, but the view does not scroll to the first match like the desktop app.
