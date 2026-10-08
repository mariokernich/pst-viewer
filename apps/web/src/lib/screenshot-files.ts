import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withBasePath } from './site'

/**
 * Reads `public/screenshots/manifest.json`, written by
 * `scripts/copy-screenshots.mjs`. Runs at build time only (server components).
 */

export interface ScreenshotImage {
  width: number
  height: number
  /** URL of the largest file (with base path). */
  src: string
  /** `srcset` with every generated width (with base path). */
  srcSet: string
}

interface ManifestEntry {
  width: number
  height: number
  variants: Array<{ width: number; file: string }>
}

let manifest: Record<string, ManifestEntry> | undefined

function readManifest(): Record<string, ManifestEntry> {
  if (!manifest) {
    try {
      manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/screenshots/manifest.json'), 'utf8'))
    } catch {
      manifest = {}
    }
  }
  return manifest ?? {}
}

/** The generated files of a screenshot, or `null` if it does not exist (placeholder). */
export function screenshotImage(name: string): ScreenshotImage | null {
  const entry = readManifest()[name]
  if (!entry || entry.variants.length === 0) return null
  const variants = [...entry.variants].sort((a, b) => a.width - b.width)
  const url = (file: string) => withBasePath(`/screenshots/${file}`)
  const largest = variants[variants.length - 1]!
  return {
    width: entry.width,
    height: entry.height,
    src: url(largest.file),
    srcSet: variants.map((variant) => `${url(variant.file)} ${variant.width}w`).join(', '),
  }
}
