# PST Viewer

Read-only viewer for Outlook data files and mail archives – fast search, previews and exports, on every device.

This monorepo contains all parts of the product:

| Path | What | Stack |
| --- | --- | --- |
| [`apps/desktop`](apps/desktop) | Desktop app for macOS, Windows and Linux | Electron, React, TypeScript |
| [`apps/web`](apps/web) | Website with landing page and documentation (DE/EN) | Next.js |
| [`apps/ios`](apps/ios) | iPhone and iPad app | SwiftUI |
| [`apps/android`](apps/android) | Android app | Kotlin, Jetpack Compose |
| [`crates/core`](crates/core) | Shared reading, search and export core for the mobile apps | Rust, UniFFI |

## Getting started

Requirements: Node.js 22+, pnpm 12 (`corepack enable`), for the mobile apps additionally Xcode, Android Studio and Rust (see the app READMEs).

```bash
pnpm install
pnpm dev          # desktop app with hot reload
pnpm dev:web      # website on http://localhost:3000
pnpm build        # build all JavaScript apps
pnpm test         # run all tests
```

The JavaScript workspaces are managed with [pnpm](https://pnpm.io) and [Turborepo](https://turborepo.com); the native apps use their platform build tools (Xcode, Gradle, Cargo).
