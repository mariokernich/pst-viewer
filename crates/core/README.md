# pst-viewer-core

The read-only mail archive engine of the iOS and Android apps, written in Rust and exposed to Swift and Kotlin with [UniFFI](https://mozilla.github.io/uniffi-rs/). It is a port of the desktop app's worker (`apps/desktop/src/worker`), so all apps list, search and display messages the same way.

## What it does

- **Formats**: Outlook data files (`.pst`, ANSI and Unicode) via Microsoft's [`outlook-pst`](https://github.com/microsoft/outlook-pst-rs) crate (vendored with three small patches, see `crates/vendor/outlook-pst/PATCHES.md`), Outlook items (`.msg`), single messages (`.eml`, Apple Mail `.emlx`), MBOX (Google Takeout labels as folders, Thunderbird/Apple Mail read and flag state, mboxrd) and folders of mail files including Apple Mail mailboxes.
- **Item list** from the PST contents tables (a 600 MB file lists 2,300 items in ~60 ms); bodies, recipients and attachments are indexed in the background on the archive's worker thread, which answers requests between two items.
- **Search** with the same query language as the desktop app (`von:anna hat:anhang nach:1.3.2024 größer:5mb -newsletter "exakte phrase" angebot ODER offer`), filters, sorting, date groups and snippets; accent and case insensitive.
- **Reading**: message details (HTML, text or de-encapsulated RTF bodies, recipients, attachments, inline images, internet headers, appointments, contacts, tasks, S/MIME signed messages), attached messages to any depth.
- **Display**: sanitised, CSP-locked HTML documents for WebViews (ammonia, remote images blocked until allowed).
- **Export**: `.eml` (MIME messages unchanged, Outlook items rebuilt with attachments and original headers), print/PDF documents and plain text; attachments as files (attached items as `.eml`).
- **Attachment previews**: iCalendar and vCard parsing, preview types, unsafe file types.

Archives are only opened for reading; PST files are handed to `outlook-pst` through `read_from` with a read-only handle, so the crate never holds a writable one. The only files the core writes are the ones the user saves (`saveAttachment`, `saveEml`).

## API (excerpt)

```swift
let session = try ArchiveSession.open(path: url.path, listener: listener, cancel: token)   // blocks: call off the main thread
let info = try session.info()                       // store, folders (flat, depth first), senders, contentIndexed
let result = try session.search(request: request)   // first page, groups, highlight terms
let more = try session.page(token: result.token, offset: 100, limit: 100)
let detail = try session.message(messageRef: MessageRef(id: id, path: []))
let doc = prepareMailDocument(html: detail.html!, inlineImages: detail.inlineImages, allowRemote: false, extraCss: css)
let file = try session.attachment(messageRef: ref, index: 0)                    // data in memory, e.g. for previews
let meta = try session.saveAttachment(messageRef: ref, index: 0, path: url.path)  // written by the core, attached items as .eml
let size = try session.saveEml(messageRef: ref, path: url.path)
```

The archive's unread total is `info.store.unreadCount` (messages in several folders or Gmail labels are counted once); each `AttachmentInfo` says whether it may be opened (`canOpen`) and how it is previewed (`previewKind`).

Android opens content URIs with `ArchiveSession.openWithAccess(root, access, listener, cancel)`: the app implements `FileAccess` (list a document tree, open a document as file descriptor), so large archives are read in place instead of being copied. To save, it passes the descriptor of a document the user created (`saveAttachmentFd`, `saveEmlFd`, opened with mode `"wt"`); the core takes ownership and closes it, also when saving fails.

All session methods block until the worker thread answers; call them from a background queue/coroutine. Listener callbacks arrive on the worker thread.

## Building

Requirements: Rust (rustup) with the targets `aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios` for iOS and `aarch64-linux-android armv7-linux-androideabi x86_64-linux-android` plus the Android NDK and `cargo-ndk` for Android.

```bash
cargo test -p pst-viewer-core                                   # unit and integration tests
PST_TEST_FILE=~/Downloads/archive.pst cargo test --release -p pst-viewer-core --test pst -- --nocapture
crates/core/scripts/build-ios.sh                                # XCFramework + Swift bindings for apps/ios
crates/core/scripts/build-android.sh                            # .so libraries + Kotlin bindings for apps/android
```

The bindings are generated in library mode from the compiled crate (`crates/uniffi-bindgen`); names are configured in `uniffi.toml`.

## Layout

```
src/session.rs   ArchiveSession: worker thread, jobs, background indexing, snippets
src/pst.rs       PST files (folders, contents tables, messages, attachments)
src/local.rs     EML/EMLX/MSG/MBOX files and folders; headers.rs, mbox.rs, msg.rs, mime.rs
src/mapi.rs      MAPI properties shared by PST and MSG (senders, named properties, bodies)
src/rtf.rs       compressed RTF and HTML/text de-encapsulation
src/search.rs    filters, sorting, date groups; query.rs, text.rs, time.rs
src/detail.rs    reading pane data; eml.rs (export), export.rs (print/PDF/text), html.rs (sanitising)
src/ical.rs      iCalendar/vCard previews; files.rs (file names, preview types)
tests/           integration tests with fixtures built in memory, and a test against a real PST
```
