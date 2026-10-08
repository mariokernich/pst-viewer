import { defaultLocale, locales, preferredLocale } from './i18n'
import { basePath } from './site'

/**
 * Runs in the browser as an inline script on the root page (`/`), before any
 * bundle has loaded: picks the language from `navigator.languages` and
 * replaces the location with `/<locale>/` (keeping query and hash, without a
 * history entry). Self-contained so it can be serialized with `toString()`.
 */
function redirectToPreferredLocale(
  supported: readonly string[],
  fallback: string,
  base: string,
  pick: (languages: readonly string[], supported: readonly string[], fallback: string) => string,
) {
  const root = document.documentElement
  try {
    const languages = navigator.languages && navigator.languages.length > 0 ? navigator.languages : [navigator.language || '']
    // Hide the language chooser while the next page loads; show it again if that takes long.
    root.style.visibility = 'hidden'
    setTimeout(() => {
      root.style.visibility = ''
    }, 2500)
    location.replace(`${base}/${pick(languages, supported, fallback)}/${location.search}${location.hash}`)
  } catch {
    root.style.visibility = ''
  }
}

/** Source of the inline redirect script, with the locale configuration baked in. */
export function rootRedirectScript(): string {
  const args = [JSON.stringify(locales), JSON.stringify(defaultLocale), JSON.stringify(basePath), preferredLocale.toString()]
  return `(${redirectToPreferredLocale.toString()})(${args.join(',')})`
}
