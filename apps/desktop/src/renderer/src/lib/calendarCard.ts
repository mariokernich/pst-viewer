/**
 * Minimal iCalendar (RFC 5545) and vCard (RFC 6350) parsing for attachment
 * previews. Only what is needed to show an event or contact card.
 */

interface Property {
  name: string
  params: Record<string, string>
  value: string
}

function unfold(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter((line) => line.trim() !== '')
}

function parseLine(line: string): Property | null {
  // NAME;PARAM=VALUE;PARAM="VALUE":value - colons inside quoted params are allowed.
  let inQuotes = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === ':' && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const [rawName, ...rawParams] = line.slice(0, colon).split(';')
  const params: Record<string, string> = {}
  for (const p of rawParams) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
    else params.TYPE = params.TYPE ? `${params.TYPE},${p}` : p
  }
  // Group prefixes ("item1.EMAIL") are not relevant for display.
  const name = rawName.replace(/^[^.]+\./, '').toUpperCase()
  return { name, params, value: line.slice(colon + 1) }
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

/** Splits a file into components (VEVENT, VCARD, …) with their properties. */
function components(text: string, type: string): Property[][] {
  const result: Property[][] = []
  let current: Property[] | null = null
  let depth = 0
  for (const line of unfold(text)) {
    const prop = parseLine(line)
    if (!prop) continue
    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === type) {
      current = []
      depth = 0
      continue
    }
    if (!current) continue
    if (prop.name === 'BEGIN') depth++
    else if (prop.name === 'END' && prop.value.toUpperCase() === type && depth === 0) {
      result.push(current)
      current = null
    } else if (prop.name === 'END') depth--
    else if (depth === 0) current.push(prop)
  }
  return result
}

const get = (props: Property[], name: string): Property | undefined => props.find((p) => p.name === name)
const all = (props: Property[], name: string): Property[] => props.filter((p) => p.name === name)

// -----------------------------------------------------------------------------
// iCalendar

export interface CalendarTime {
  time: number
  allDay: boolean
  /** Time zone name if the time is given in a named zone. */
  zone?: string
}

export interface CalendarPerson {
  name: string
  email: string
  status?: string
}

export interface CalendarEvent {
  summary: string
  location: string
  description: string
  start: CalendarTime | null
  end: CalendarTime | null
  organizer: CalendarPerson | null
  attendees: CalendarPerson[]
  recurring: boolean
  url: string
}

export interface Calendar {
  method: string
  events: CalendarEvent[]
}

function parseTime(prop: Property | undefined): CalendarTime | null {
  if (!prop) return null
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(prop.value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, utc] = m
  if (h === undefined) return { time: new Date(Number(y), Number(mo) - 1, Number(d)).getTime(), allDay: true }
  const parts = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)] as const
  if (utc) return { time: Date.UTC(...parts), allDay: false }
  // Times in a named zone are shown as local times of that zone.
  return { time: new Date(...parts).getTime(), allDay: false, zone: prop.params.TZID }
}

function person(prop: Property): CalendarPerson {
  return {
    name: prop.params.CN ?? '',
    email: prop.value.replace(/^mailto:/i, ''),
    status: prop.params.PARTSTAT
  }
}

export function parseCalendar(text: string): Calendar {
  const calendar = components(text, 'VCALENDAR')[0] ?? []
  const events = components(text, 'VEVENT').map<CalendarEvent>((props) => ({
    summary: unescapeText(get(props, 'SUMMARY')?.value ?? ''),
    location: unescapeText(get(props, 'LOCATION')?.value ?? ''),
    description: unescapeText(get(props, 'DESCRIPTION')?.value ?? ''),
    start: parseTime(get(props, 'DTSTART')),
    end: parseTime(get(props, 'DTEND')),
    organizer: get(props, 'ORGANIZER') ? person(get(props, 'ORGANIZER')!) : null,
    attendees: all(props, 'ATTENDEE').map(person),
    recurring: !!get(props, 'RRULE'),
    url: get(props, 'URL')?.value ?? ''
  }))
  return { method: (get(calendar, 'METHOD')?.value ?? '').toUpperCase(), events }
}

// -----------------------------------------------------------------------------
// vCard

export interface ContactCardField {
  kind: 'email' | 'phone' | 'address' | 'url' | 'birthday' | 'note'
  label: string
  value: string
}

export interface ContactCard {
  name: string
  organization: string
  title: string
  photo: string | null
  fields: ContactCardField[]
}

function typeLabel(prop: Property): string {
  return (prop.params.TYPE ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !['internet', 'pref', 'voice', 'x400'].includes(t))
    .join(', ')
}

export function parseContacts(text: string): ContactCard[] {
  return components(text, 'VCARD').map((props) => {
    const n = (get(props, 'N')?.value ?? '').split(';').map(unescapeText)
    const name = unescapeText(get(props, 'FN')?.value ?? '') || [n[3], n[1], n[2], n[0], n[4]].filter(Boolean).join(' ')
    const fields: ContactCardField[] = [
      ...all(props, 'EMAIL').map((p) => ({ kind: 'email' as const, label: typeLabel(p), value: p.value })),
      ...all(props, 'TEL').map((p) => ({ kind: 'phone' as const, label: typeLabel(p), value: p.value.replace(/^tel:/i, '') })),
      ...all(props, 'ADR').map((p) => {
        const [, , street, city, region, zip, country] = p.value.split(';').map(unescapeText)
        return { kind: 'address' as const, label: typeLabel(p), value: [street, [zip, city].filter(Boolean).join(' '), region, country].filter(Boolean).join('\n') }
      }),
      ...all(props, 'URL').map((p) => ({ kind: 'url' as const, label: typeLabel(p), value: p.value })),
      ...all(props, 'BDAY').map((p) => ({ kind: 'birthday' as const, label: '', value: p.value })),
      ...all(props, 'NOTE').map((p) => ({ kind: 'note' as const, label: '', value: unescapeText(p.value) }))
    ].filter((f) => f.value.trim() !== '')
    const photo = get(props, 'PHOTO')
    let photoUrl: string | null = null
    if (photo) {
      const encoding = (photo.params.ENCODING ?? '').toLowerCase()
      const type = (photo.params.TYPE ?? 'jpeg').toLowerCase().replace(/^image\//, '')
      // Only embedded photos are shown; remote photo URLs are never loaded.
      if (photo.value.startsWith('data:image/')) photoUrl = photo.value
      else if (encoding === 'b' || encoding === 'base64') photoUrl = `data:image/${type};base64,${photo.value.replace(/\s+/g, '')}`
    }
    return {
      name,
      organization: unescapeText((get(props, 'ORG')?.value ?? '').split(';').filter(Boolean).join(', ')),
      title: unescapeText(get(props, 'TITLE')?.value ?? ''),
      photo: photoUrl,
      fields
    }
  })
}
