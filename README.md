# PST Viewer

Read-only viewer for Outlook data files and mail archives – fast search, previews and exports, on every device.

This monorepo contains all parts of the product:

| Path | What | Stack |
| --- | --- | --- |
| [`apps/desktop`](apps/desktop) | Desktop app for macOS, Windows and Linux (Mac App Store, Microsoft Store) | Electron, React, TypeScript |
| [`apps/ios`](apps/ios) | iPhone and iPad app | SwiftUI |
| [`apps/android`](apps/android) | Android app (phones, tablets, foldables) | Kotlin, Jetpack Compose |
| [`crates/core`](crates/core) | Shared engine of the mobile apps: PST/MSG/EML/MBOX reading, search, export | Rust, UniFFI |
| [`apps/web`](apps/web) | Website with landing page and documentation (DE/EN) | Next.js |
| [`crates/vendor/outlook-pst`](crates/vendor/outlook-pst) | Microsoft's PST crate with three small patches ([PATCHES.md](crates/vendor/outlook-pst/PATCHES.md)) | Rust |
| [`tools/demo-data`](tools/demo-data) | Generator for a fictional demo mailbox (tests, screenshots) | Python |
| [`docs/store-release.md`](docs/store-release.md) | Release guide for the four stores, listing texts | |

All apps open archives strictly read-only, work offline and collect no data. The desktop app has its own TypeScript engine (`apps/desktop/src/worker`); the Rust core is a port of it, so search syntax, filters and results behave the same everywhere.

## Getting started

Requirements: Node.js 22+, pnpm 12 (`corepack enable`); for the mobile apps additionally Rust (rustup), Xcode and Android Studio with the NDK (see the app READMEs).

```bash
pnpm install
pnpm dev          # desktop app with hot reload
pnpm dev:web      # website on http://localhost:3000
pnpm build        # build all JavaScript apps
pnpm test         # run all JavaScript tests

cargo test -p pst-viewer-core            # Rust core tests
crates/core/scripts/build-ios.sh         # core for the iOS app (XCFramework + Swift bindings)
crates/core/scripts/build-android.sh     # core for the Android app (.so libraries + Kotlin bindings)
```

The JavaScript workspaces are managed with [pnpm](https://pnpm.io) and [Turborepo](https://turborepo.com); the Rust crates form a Cargo workspace; the native apps use Xcode and Gradle.

Dependencies must have been published for at least 24 hours before they are added (pnpm's `minimumReleaseAge`; the same rule is applied to crates, Swift packages and Maven artifacts).
