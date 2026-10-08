/**
 * Copies the product screenshots from the repository's `docs/screenshots/`
 * folder into `public/screenshots/` (git-ignored), so the binaries exist only
 * once in git. Runs before `next dev` and `next build`.
 *
 * Each PNG is converted into WebP files in a few widths for responsive
 * `srcset`s (a static host has no image optimizer). If `sharp` is not
 * available, the PNG is copied as is. `manifest.json` lists the real pixel
 * size and the generated files; `src/lib/screenshot-files.ts` reads it, and
 * screenshots without an entry render as placeholders.
 */
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(webDir, '../../docs/screenshots')
const targetDir = join(webDir, 'public/screenshots')
const manifestPath = join(targetDir, 'manifest.json')

/** Widths of the generated WebP files (plus the original width). */
const WIDTHS = [640, 1080, 1600, 2400]
const WEBP_QUALITY = 82

/** Width and height from the IHDR chunk of a PNG file. */
function pngSize(buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

async function loadSharp() {
  try {
    return (await import('sharp')).default
  } catch {
    return null
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(targetDir, { recursive: true })

  const sources = (await exists(sourceDir))
    ? (await readdir(sourceDir)).filter((file) => extname(file).toLowerCase() === '.png').sort()
    : []

  const previous = (await readJson(manifestPath)) ?? {}
  const sharp = sources.length > 0 ? await loadSharp() : null
  const manifest = {}

  for (const file of sources) {
    const name = file.slice(0, -extname(file).length)
    const sourcePath = join(sourceDir, file)
    const { size, mtimeMs } = await stat(sourcePath)
    const buffer = await readFile(sourcePath)
    const dimensions = pngSize(buffer)
    if (!dimensions) {
      console.warn(`[screenshots] Skipping ${file}: not a valid PNG file.`)
      continue
    }

    // Unchanged since the last run (and all files still there): keep the generated files.
    const cached = previous[name]
    if (
      cached?.source?.size === size &&
      cached?.source?.mtimeMs === mtimeMs &&
      cached.webp === Boolean(sharp) &&
      (await Promise.all(cached.variants.map((variant) => exists(join(targetDir, variant.file))))).every(Boolean)
    ) {
      manifest[name] = cached
      continue
    }

    const variants = []
    if (sharp) {
      const widths = [...new Set([...WIDTHS.filter((width) => width < dimensions.width), dimensions.width])]
      for (const width of widths) {
        const output = `${name}-${width}.webp`
        await sharp(buffer).resize({ width }).webp({ quality: WEBP_QUALITY }).toFile(join(targetDir, output))
        variants.push({ width, file: output })
      }
    } else {
      await copyFile(sourcePath, join(targetDir, file))
      variants.push({ width: dimensions.width, file })
    }

    manifest[name] = { ...dimensions, webp: Boolean(sharp), variants, source: { size, mtimeMs } }
    console.log(`[screenshots] ${file} (${dimensions.width}×${dimensions.height}) → ${variants.length} file(s)`)
  }

  // Remove files that no longer belong to any screenshot.
  const keep = new Set(['manifest.json', ...Object.values(manifest).flatMap((entry) => entry.variants.map((v) => v.file))])
  for (const file of await readdir(targetDir)) {
    if (!keep.has(file)) await rm(join(targetDir, file), { recursive: true, force: true })
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (sources.length === 0) {
    console.log(`[screenshots] No PNG files in ${sourceDir} – the site shows placeholders.`)
  } else if (!sharp) {
    console.warn('[screenshots] sharp is not available – copied the PNG files without resizing.')
  }
}

main().catch((error) => {
  // Never break the build because of screenshots: placeholders are rendered instead.
  console.error('[screenshots] Failed to prepare the screenshots:', error)
  process.exitCode = 0
})
