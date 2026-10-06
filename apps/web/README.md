# PST Viewer – Website

Landing page and documentation in German and English, built with Next.js 16 (App Router), React 19 and Tailwind CSS 4.

- `/de` and `/en` with localized slugs (`/de/impressum` ↔ `/en/legal-notice`, `/de/docs/suche` ↔ `/en/docs/search`); `/` redirects by `Accept-Language` (`src/proxy.ts`).
- Light, dark and system theme (next-themes, stored in `localStorage` only after a choice).
- Every page is prerendered (SSG); only the locale redirect runs per request. No cookies, no tracking, fonts are self-hosted.
- SEO: canonical and hreflang links, sitemap, robots.txt, Open Graph images per locale, JSON-LD `SoftwareApplication`.

## Development

```bash
pnpm install                              # in the repository root
pnpm --filter @pst-viewer/web dev         # http://localhost:3000
pnpm --filter @pst-viewer/web typecheck
pnpm --filter @pst-viewer/web lint
pnpm --filter @pst-viewer/web build
```

## Structure

```
src/app/            routes ([locale] pages, docs, legal pages, OG images, sitemap, robots)
src/content/        all copy: landing page, docs and legal pages per language
src/components/     landing sections, layout, docs shell, screenshots, theme
src/lib/            i18n, route registry (localized slugs), site config, metadata helpers
public/screenshots/ app screenshots (placeholders until real ones exist)
```

## Before going live

- **Site URL:** set `NEXT_PUBLIC_SITE_URL` for production builds (otherwise links point to `https://www.example.com`).
- **Store links:** `src/lib/site.ts` – the four store URLs are `#`; iOS and Android are marked "in development". Replace the generic store buttons with the official badges (Apple, Google, Microsoft) once the apps are listed.
- **Screenshots:** `src/lib/screenshots.ts` – every `src` is `null` and renders a placeholder of the right size; put the files into `public/screenshots/`.
- **Legal pages:** `src/content/legal.tsx` contains visible TODO markers (address, contact, VAT ID, consumer dispute statement, hosting). Have them reviewed legally.
- **JSON-LD:** add iOS and Android to `operatingSystem` when the mobile apps are released.
- **Hosting:** works with `next start` or Vercel. A purely static host (`output: 'export'`) cannot run the locale redirect and the security headers of `next.config.ts`; configure both on the host instead.
