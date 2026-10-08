import type { NextConfig } from 'next'

/**
 * The site is a fully static export (`out/`), hosted on GitHub Pages as a
 * project page under `/pst-viewer`. The base path comes from
 * `NEXT_PUBLIC_BASE_PATH` (empty by default, so `pnpm dev` serves at `/`).
 *
 * GitHub Pages cannot set custom HTTP headers, so there is no `headers()`
 * config (it is not supported by `output: 'export'` either). The previous
 * security headers (nosniff, referrer policy, frame options, permissions
 * policy) would have to be configured on another host or a CDN in front.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '')

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // `/en/docs/` is written as `en/docs/index.html`, which every static host serves without rewrites.
  trailingSlash: true,
  // There is no image optimization server on a static host; screenshots are pre-sized by
  // `scripts/copy-screenshots.mjs` instead.
  images: { unoptimized: true },
  poweredByHeader: false,
}

export default nextConfig
