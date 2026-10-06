/** Initials for an avatar: "Anna Müller" -> "AM", "info@shop.de" -> "I". */
export function initials(name: string, email = ''): string {
  const source = (name || email).replace(/["'(<].*$/, '').trim()
  if (!source) return '?'
  if (!name && email) return email[0].toUpperCase()
  // "Müller, Anna" -> "AM"
  const parts = source.includes(',')
    ? source
        .split(',')
        .map((p) => p.trim())
        .reverse()
    : source.split(/\s+/)
  const letters = parts
    .filter((p) => /\p{L}/u.test(p))
    .map((p) => (p.match(/\p{L}/u) ?? [''])[0].toUpperCase())
  if (letters.length === 0) return source[0].toUpperCase()
  return letters.length === 1 ? letters[0] : letters[0] + letters[letters.length - 1]
}

const HUES = [211, 262, 330, 14, 32, 145, 172, 190, 238, 290]

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** A stable, pleasant gradient for a person. */
export function avatarGradient(key: string): string {
  const hue = HUES[hash(key.toLowerCase()) % HUES.length]
  return `linear-gradient(135deg, hsl(${hue} 75% 62%), hsl(${(hue + 25) % 360} 70% 48%))`
}

export function displayAddress(name: string, email: string): string {
  if (name && email && name !== email) return `${name} <${email}>`
  return name || email
}
