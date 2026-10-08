# PST Viewer – Website

Landing page and documentation in German and English, built with Next.js 16 (App Router), React 19 and Tailwind CSS 4. Exported as a fully static site and hosted on GitHub Pages at <https://mariokernich.github.io/pst-viewer/>.

- `/de/` and `/en/` with localized slugs (`/de/impressum/` ↔ `/en/legal-notice/`, `/de/docs/suche/` ↔ `/en/docs/search/`).
- `/` is a static page that picks the language in the browser (`navigator.languages`, English as fallback) and redirects with `location.replace`; without JavaScript it shows a language chooser. The 404 page forwards URLs without a language prefix (`/docs/search/`) to the matching page.
- Downloads link to the latest GitHub release (`releases/latest/download/<asset>`, see `src/lib/site.ts`); the visitor's platform is detected in the browser to highlight the matching build (progressive enhancement).
- Light, dark and system theme (next-themes, stored in `localStorage` only after a choice).
- No cookies, no tracking, fonts are self-hosted.
- SEO: canonical and hreflang links, sitemap, robots.txt, Open Graph images per locale, JSON-LD `SoftwareApplication`.

## Development

```bash
pnpm install                              # in the repository root
pnpm --filter @pst-viewer/web dev         # http://localhost:3000
pnpm --filter @pst-viewer/web typecheck
pnpm --filter @pst-viewer/web lint
pnpm --filter @pst-viewer/web build       # static export into out/
```

Production build for GitHub Pages:

```bash
NEXT_PUBLIC_SITE_URL=https://mariokernich.github.io/pst-viewer \
NEXT_PUBLIC_BASE_PATH=/pst-viewer \
pnpm --filter @pst-viewer/web build
```

- `NEXT_PUBLIC_SITE_URL` – public URL including the base path; used for canonical/hreflang URLs, sitemap, Open Graph and JSON-LD.
- `NEXT_PUBLIC_BASE_PATH` – path prefix of the project page; empty by default, so `dev` serves at `/`.

To check the export locally, serve `out/` under the same prefix (e.g. map `/pst-viewer/*` to `out/*`); opening the HTML files directly does not work.

## Screenshots

The PNG screenshots (fictional demo data) live once in the repository's `docs/screenshots/` folder. `scripts/copy-screenshots.mjs` runs before `dev` and `build`, converts them into WebP files in several widths (with `sharp`) and writes them plus a `manifest.json` with the real pixel sizes into `public/screenshots/` (git-ignored). `src/lib/screenshots.ts` maps them per locale; a missing file renders a placeholder, so the build never breaks.

## Structure

```
src/app/            routes ([locale] pages, docs, legal pages, root redirect, OG images, sitemap, robots)
src/content/        all copy: landing page, docs and legal pages per language
src/components/     landing sections, downloads, layout, docs shell, screenshots, theme
src/lib/            i18n, route registry (localized slugs), site config (GitHub links, downloads, stores), metadata helpers
scripts/            copy-screenshots.mjs
```

## Notes

- GitHub Pages cannot set custom HTTP headers (no CSP, `X-Frame-Options` etc.), and `robots.txt` is only honoured at the domain root, so `/pst-viewer/robots.txt` is informational; submit the sitemap in Google Search Console instead.
- **Stores:** `src/lib/site.ts` – the four store entries are marked unavailable ("coming soon"). Set `available: true` and the URL once an app is listed, and replace the generic store buttons with the official badges.
- **Legal pages:** `src/content/legal.tsx` contains visible TODO markers (address, contact, VAT ID, legal basis and retention of the GitHub Pages logs). Have them reviewed legally.
- **JSON-LD:** add iOS/iPadOS to `operatingSystem` when the iPhone & iPad app is released.
