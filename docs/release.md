# Releases

PST Viewer is released from the `main` branch of [mariokernich/pst-viewer](https://github.com/mariokernich/pst-viewer) with three GitHub workflows:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`ci.yml`](../.github/workflows/ci.yml) | pull requests, pushes to `main` | lint, type check, tests and builds of the desktop app and website; `cargo fmt`, `clippy` and tests of the Rust core |
| [`release.yml`](../.github/workflows/release.yml) | pushes to `main` | [release-please](https://github.com/googleapis/release-please) keeps a release pull request up to date; merging it creates the tag and GitHub release and attaches the downloads |
| [`pages.yml`](../.github/workflows/pages.yml) | pushes to `main` that change the website or screenshots | builds `apps/web` as static site and deploys it to <https://mariokernich.github.io/pst-viewer/> |

## How a release happens

1. Commits on `main` follow [Conventional Commits](https://www.conventionalcommits.org/): `fix: …` raises the patch version, `feat: …` the minor version, `feat!: …` or a `BREAKING CHANGE:` footer the major version. `docs:`, `chore:`, `ci:`, `refactor:`, `test:` do not trigger a release on their own.
2. After every push, release-please opens or updates the pull request **"chore(main): release x.y.z"** with the changelog and the new version in all apps:
   - `package.json`, `apps/desktop/package.json`, `apps/web/package.json`
   - `Cargo.toml` (workspace version of the Rust crates)
   - `apps/android/app/build.gradle.kts` (`versionName`; `versionCode` is derived from it)
   - `apps/ios/Version.xcconfig` (`MARKETING_VERSION`)
   - `CHANGELOG.md`, `version.txt`, `.release-please-manifest.json`
3. Merging that pull request tags `vx.y.z`, publishes the GitHub release and builds the downloads, which are attached a few minutes later:

| Asset | Built on |
| --- | --- |
| `PST-Viewer-mac-arm64.dmg`, `PST-Viewer-mac-x64.dmg` | macOS |
| `PST-Viewer-windows-x64-setup.exe`, `PST-Viewer-windows-arm64-setup.exe` | Windows |
| `PST-Viewer-linux-x86_64.AppImage`, `PST-Viewer-linux-amd64.deb` | Linux |
| `PST-Viewer-android.apk` | Linux (only with a signing key, see below) |

The names carry no version, so `https://github.com/mariokernich/pst-viewer/releases/latest/download/<asset>` always points to the newest build (the website uses these links). The first release is `1.0.0` (`initial-version` in `release-please-config.json`).

`Cargo.lock` still lists the previous version of the workspace crates after a release; the next `cargo build` updates it, commit it with the next change.

## One-time repository settings

- **Settings → Actions → General → Workflow permissions:** "Read and write permissions" and **"Allow GitHub Actions to create and approve pull requests"** (release-please needs both).
- **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- Pull requests created by release-please with the default `GITHUB_TOKEN` do not start other workflows, so CI does not run on the release pull request itself. That is fine, because it only changes version numbers; use a personal access token as `token` for release-please if you want checks there.

## Secrets (Settings → Secrets and variables → Actions)

All of them are optional. Without them the desktop builds are unsigned and the APK is skipped.

### Android (required for the APK)

The APK must always be signed with the same key, otherwise users cannot install updates. Create the key once and keep a backup outside the repository:

```bash
keytool -genkeypair -v -keystore pst-viewer-release.jks -alias pst-viewer -keyalg RSA -keysize 4096 -validity 10000
```

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -i pst-viewer-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `pst-viewer` |
| `ANDROID_KEY_PASSWORD` | key password |

Google Play uses its own app signing; the upload key can be the same key or a separate one (see [store-release.md](store-release.md)).

### macOS signing and notarization

Without signing, macOS shows "cannot be opened because the developer cannot be verified"; users open the app once with right-click → Open (or System Settings → Privacy & Security → Open Anyway). With an Apple Developer account:

| Secret | Value |
| --- | --- |
| `MAC_CERTIFICATE` | *Developer ID Application* certificate as base64-encoded `.p12` |
| `MAC_CERTIFICATE_PASSWORD` | password of the `.p12` |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | for notarization (app-specific password from appleid.apple.com) |

### Windows signing

Without signing, SmartScreen warns ("Windows protected your PC" → More info → Run anyway). With a code signing certificate:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE` | certificate as base64-encoded `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | password of the `.pfx` |

Free alternatives for open-source projects exist (e.g. SignPath Foundation); they need a separate integration.

## iPhone and iPad

iOS apps cannot be installed from GitHub Releases. They are distributed through the App Store (and TestFlight) only, see [store-release.md](store-release.md); developers can build and run the app from source with Xcode ([apps/ios/README.md](../apps/ios/README.md)).

## Building locally

```bash
pnpm --filter @pst-viewer/desktop dist:mac     # or dist:win, dist:linux → apps/desktop/dist
cd apps/android && ./gradlew assembleRelease   # signed with keystore.properties, see apps/android/README.md
```
