# PST Viewer

A fast, modern and strictly **read-only** desktop viewer for e-mail archives, built with Electron.

- **Formats**:
  - Outlook data files (`.pst`, ANSI and Unicode),
  - Outlook items (`.msg`) – mails, appointments and attached items,
  - single messages (`.eml`, `.emlx`),
  - MBOX mailboxes (`.mbox`, `.mbx` or no extension) from Google Takeout (Gmail labels become folders, read/starred state is kept), Thunderbird (read and flag state) and other mail clients,
  - folders: a directory tree of `.eml`/`.msg` files and Apple Mail exports (`*.mbox` bundles) is shown as a folder tree.
- **Welcome screen** with recently opened files and folders – reopen with one click, open a file (`⌘O`/`Ctrl+O`) or a folder (`⇧⌘O`/`Ctrl+Shift+O`) via dialog, or drag & drop.
- **Mailbox layout**: folder tree, virtualised message list grouped by date (Today, Yesterday, This week, …) and a reading pane.
- **Fast opening**: the message list is built from the folders' contents tables first (a 600 MB file with 2,300 items opens in about half a second); bodies, recipients and attachments are indexed in the background.
- **Search** across all folders or the current folder, as you type, with
  - suggestions (search only in subject/sender/body, matching senders and folders, recent searches, quick filters),
  - a filter panel (fields, date range, sender, recipient, read state, attachments, attachment type, importance, flag, item type, minimum size) and removable filter chips,
  - a query syntax (see below) in German and English,
  - accent and case insensitive matching (`muller` finds “Müller”), highlighted matches in the list, the header and the message body, and snippets around body matches.
- **Reading pane**: sanitised HTML in a sandboxed iframe, plain text with clickable links, inline images, remote images blocked until you allow them, attached messages (Outlook items and `.eml`) in an overlay, internet headers, appointment/contact/task details, S/MIME signed messages.
- **Attachments without downloading**: click an attachment for a Quick Look style preview – PDF (Chromium's PDF viewer), images, text, CSV as a table, HTML (sanitised), calendar invitations (`.ics`) as an event card, contacts (`.vcf`) as a contact card, audio and video. Step through all attachments with ← →. Everything else opens in its default app (or macOS Quick Look) as a read-only temporary copy. Attachments can of course also be saved (one, all, attached messages as `.eml`).
- **Export single messages** as PDF (header, attachment list, inline images, page numbers), as `.eml` (opens in any mail client, includes attachments and original internet headers) or as plain text, and print them (`⌘P`).
- Light and dark mode, system accent colour, macOS vibrancy / Windows 11 Mica, German and English UI (switchable under *View → Language*), keyboard navigation.

## Read-only guarantee

Archives are opened with the read-only flag (`fs.openSync(path, 'r')`) or read with `fs.readFile` inside a separate utility process; the app has no code path that writes to them. The only things written to disk are:

- the app settings (`settings.json` in the user data folder: window size, theme, language and the list of recent files – paths and item counts only, never mail content),
- attachments and exports you explicitly save via a save dialog (existing files are never overwritten when saving all attachments),
- read-only temporary copies of attachments you preview or open (in the system temp folder; deleted when the app quits, stale copies on the next start).

## Security

- Renderer runs with `contextIsolation`, `sandbox` and without Node integration; the preload exposes a minimal typed API (`src/shared/api.ts`). IPC calls are only accepted from the app's own frame and validate their arguments.
- Mail HTML is sanitised with DOMPurify, rendered in an iframe with `sandbox="allow-same-origin"` (no scripts) and a strict per-document Content Security Policy.
- All network access is blocked by the main process, except remote images of the message you allowed explicitly. Links open in the default browser (`http`, `https` and `mailto` only); links that do not come from the app itself (e.g. inside a PDF) ask first.
- Attachment previews are served from read-only temporary copies through a private `pst-preview:` protocol (unguessable per-file tokens, no active content except Chromium's PDF viewer). File types that can run code (`.exe`, `.app`, scripts, disk images, HTML, …) are never opened directly – only saved on request. On macOS the copies carry the quarantine flag.
- PDF export and printing render the sanitised message in a hidden window without JavaScript, in a separate in-memory session with the network blocked.
- Permissions, downloads, webviews and navigation are denied; packaged builds enable Electron fuses (no `RunAsNode`, no `NODE_OPTIONS`, no inspector, ASAR integrity, load app only from ASAR).

## Search syntax

| Example | Meaning |
| --- | --- |
| `invoice 2024` | all terms must match |
| `"kind regards"` | exact phrase |
| `offer OR quote` | either term (`ODER` works too) |
| `-newsletter` | exclude a term |
| `from:anna` / `von:anna` | sender name or address |
| `to:bob` / `an:bob` | recipients (To, Cc, Bcc) |
| `subject:…` / `betreff:…` | subject only |
| `body:…` / `inhalt:…` | message body only |
| `attachment:pdf` / `anhang:pdf` | attachment file name |
| `has:attachment` / `hat:anhang` | messages with attachments |
| `is:unread`, `is:read`, `is:important`, `is:flagged`, `is:signed` (`ist:ungelesen`, …) | status |
| `after:2024-03-01`, `before:2024-06`, `until:31.12.2024`, `date:2023` (`nach:`, `vor:`, `bis:`, `datum:`) | date range |
| `larger:5mb`, `smaller:100kb` (`größer:`, `kleiner:`) | size |
| `type:appointment` (`typ:termin`, `mail`, `kontakt`, `aufgabe`, `notiz`) | item type |
| `folder:archive` (`ordner:archiv`) | folders with this name |

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘O` / `Ctrl+O` | open a file |
| `⇧⌘O` / `Ctrl+Shift+O` | open a folder |
| `⌘F` / `Ctrl+F` or `/` | search |
| `⌥⌘F` / `Ctrl+Alt+F` | filter panel |
| `↑` `↓` (`j` `k`), `PageUp` `PageDown`, `Home` `End` | navigate messages |
| `Esc` | clear the search |
| `⌃⌘S` / `Ctrl+Shift+S` | toggle the sidebar |
| `⌥⌘U` / `Ctrl+Alt+U` | internet headers |
| `⌘P` / `Ctrl+P` | print the message |
| `Space` / `Enter` on an attachment, `←` `→` in the preview | preview attachments |
| `⇧⌘W` / `Ctrl+Shift+W` | close the file |

## Development

Requirements: Node.js 22 or newer and pnpm (see the repository root). Run the commands in this folder, or from the root with `pnpm --filter @pst-viewer/desktop <script>`.

```bash
pnpm install         # once, in the repository root
pnpm dev             # start with hot reload
pnpm typecheck
pnpm test            # unit tests (EML, MSG and MBOX fixtures are built in memory)
PST_TEST_FILE=~/Downloads/sample.pst pnpm test   # plus integration tests against a real PST
pnpm build           # production build into out/
pnpm dist:mac        # package (dmg) into dist/; also dist:win, dist:linux
pnpm icons           # re-render build/icon.png from build/icon.svg
```

Unsigned local macOS builds work out of the box (`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm dist:mac` skips looking for a signing identity). For distribution configure a Developer ID certificate and notarization for electron-builder.

## Architecture

```
src/
  main/       Electron main process: window, menu, security, IPC, recent files, settings
  preload/    contextBridge API (window.pstViewer)
  worker/     utility process: archive parsing, indexing, search, attachments, exports
  renderer/   React 19 UI (Tailwind CSS 4, zustand, TanStack Virtual)
  shared/     types, API contract, query parser, text folding – used by all layers
tests/        unit and integration tests (Vitest)
```

- The **worker** runs in an Electron `utilityProcess`, one per opened file. Every format implements the `Archive` interface (`src/worker/archive.ts`):
  - `PstIndex` (`indexer.ts`) builds the item list from the folders' contents tables of a PST file (pst-extractor),
  - `LocalArchive` (`localArchive.ts`) lists `.eml`/`.msg` files, MBOX mailboxes (`mbox.ts` scans message boundaries in 8 MB chunks and keeps byte offsets, so even multi-GB files are not loaded into memory) and directory trees, reading only the headers at first (`headers.ts`).

  Afterwards every message is opened in the background to index body text, recipients and attachments. The worker yields regularly so UI requests are answered while indexing; the renderer refreshes the visible results as the index fills.
- Search runs in memory in the worker: folded (lower-case, accent-free) text fields, a small query language (`src/shared/query.ts`), sorting and date grouping. Results are paged to the renderer and displayed in a virtualised list.
- Message details are loaded on demand; MIME messages (`.eml`, MBOX, S/MIME signed and attached messages) are parsed with postal-mime, `.msg` files with msgreader, RTF bodies are de-encapsulated with rtf-stream-parser. `.eml` exports of MIME messages are the original bytes; Outlook items are composed with nodemailer's MIME builder (nothing is ever sent).

## Known limitations

- Encrypted S/MIME messages cannot be decrypted (the PST does not contain the private key).
- Offline storage files (`.ost`) of newer Outlook versions use a compressed format that pst-extractor cannot read.
- Outlook for Mac archives (`.olm`) are not supported yet.
- Messages are exported as `.eml`, not as Outlook `.msg` files.
- Tested on macOS; the Windows and Linux builds are configured but not yet tested.
