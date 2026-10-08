# Contributing to PST Viewer

Thanks for helping! Bug reports, ideas, translations and pull requests are welcome.

## Privacy first

Mail archives are private. **Never attach real mailboxes, `.pst`/`.msg`/`.eml` files or screenshots with real mail** to issues or pull requests. To reproduce a problem, use the fictional demo data (`python3 tools/demo-data/make-demo-archive.py --lang en demo`) or a small file you created yourself. Test fixtures in the repository are generated in code or contain only made-up content.

## Development

See [Building from source](README.md#building-from-source) and the READMEs of the apps. Before opening a pull request:

```bash
pnpm lint && pnpm typecheck && pnpm test     # desktop app and website
cargo fmt --all && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
```

For the native apps, build and test in Xcode (`apps/ios`) or with `./gradlew assembleDebug lint test` (`apps/android`).

Principles that every change must keep:

- **Read-only:** archives are opened for reading only; the apps write files only where the user saves something.
- **Offline and private:** no telemetry, analytics, accounts or network access beyond remote images the user allows for one message.
- **Same behaviour everywhere:** the desktop worker (`apps/desktop/src/worker`) and the Rust core (`crates/core`) implement the same search syntax and results; change both when you change one.
- **Two languages:** user-facing text exists in English and German.
- Dependencies must have been published for at least 24 hours (supply-chain policy).

## Commit messages

Commits on `main` follow [Conventional Commits](https://www.conventionalcommits.org/), because releases and the changelog are generated from them (see [docs/release.md](docs/release.md)):

```
feat: search in attachment names
fix(android): keep the scroll position after rotation
docs: explain the MBOX label mapping
```

`feat` raises the minor version, `fix` the patch version, `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer the major version.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
