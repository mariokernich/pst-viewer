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
- **Secret `RELEASE_PLEASE_TOKEN`:** a fine-grained personal access token for this repository with *Contents* and *Pull requests* read/write. With it, the release pull request is opened by you, so its squash commit is authored by you (with the default `GITHUB_TOKEN` it would be `github-actions[bot]`), and CI runs on it. Merge release pull requests with **Squash and merge**.

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

The GitHub downloads for macOS are signed with a *Developer ID Application* certificate and notarized with the App Store Connect API key (see the App Store section below), so Gatekeeper opens them without a warning.

| Secret | Value |
| --- | --- |
| `MAC_CERTIFICATE` | *Developer ID Application* certificate with private key as base64-encoded `.p12` |
| `MAC_CERTIFICATE_PASSWORD` | password of the `.p12` |
| `APP_STORE_CONNECT_API_KEY`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` | used for notarization (`notarytool`) |

Without `MAC_CERTIFICATE` the builds are unsigned; users then open the app once with right-click → Open (or System Settings → Privacy & Security → Open Anyway).

### Windows signing

Without signing, SmartScreen warns ("Windows protected your PC" → More info → Run anyway). With a code signing certificate:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE` | certificate as base64-encoded `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | password of the `.pfx` |

Free alternatives for open-source projects exist (e.g. SignPath Foundation); they need a separate integration.

## App Store (iPhone, iPad, Mac)

iOS apps cannot be installed from GitHub Releases; they are distributed through the App Store and TestFlight, see [store-release.md](store-release.md). Developers can build and run the app from source with Xcode ([apps/ios/README.md](../apps/ios/README.md)).

The job `app-store` of the release workflow builds the iPhone/iPad app and the Mac App Store package on a macOS runner, signs them and uploads them to App Store Connect, where they appear in TestFlight after processing. Submitting a version for review stays manual: select the build on the version page and click *Add for Review*. The build number is `<run number>.<attempt>`; the version comes from release-please.

| Secret | Value |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY` | API key (`.p8`) as base64; App Store Connect → Users and Access → Integrations, role Developer |
| `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` | key ID and issuer ID of that key |
| `APPLE_DISTRIBUTION_P12`, `APPLE_DISTRIBUTION_P12_PASSWORD` | *Apple Distribution* certificate with private key as base64 `.p12` |
| `MAC_INSTALLER_P12`, `MAC_INSTALLER_P12_PASSWORD` | *Mac Installer Distribution* certificate with private key as base64 `.p12` |
| `IOS_PROVISIONING_PROFILE` | App Store profile "PST Viewer iOS App Store CI" for `de.kernich.pstviewer` (base64) |
| `MAC_PROVISIONING_PROFILE` | Mac App Store profile "PST Viewer Mac App Store CI" (base64) |

The profiles must contain the certificate of `APPLE_DISTRIBUTION_P12`. Certificates and profiles expire after one year: renew them in the developer portal and update the secrets. To export a `.p12` for the secrets from a key and a certificate:

```bash
openssl x509 -inform der -in apple-distribution.cer -out apple-distribution.pem
openssl pkcs12 -export -inkey apple-distribution.key -in apple-distribution.pem -out apple-distribution.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
```

The same script uploads from a Mac with the identities in the keychain (iOS signs automatically through Xcode when `IOS_PROFILE_NAME` is not set):

```bash
ASC_KEY_ID=… ASC_ISSUER_ID=… BUILD_NUMBER=5 tools/app-store/upload.sh ios   # or mac
```

## Building locally

```bash
pnpm --filter @pst-viewer/desktop dist:mac     # or dist:win, dist:linux → apps/desktop/dist
cd apps/android && ./gradlew assembleRelease   # signed with keystore.properties, see apps/android/README.md
```
