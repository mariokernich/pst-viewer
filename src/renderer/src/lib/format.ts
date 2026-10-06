import { formatLocale as locale } from '@/i18n'

const cache = new Map<string, Intl.DateTimeFormat>()

function dtf(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale() + JSON.stringify(options)
  let format = cache.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale(), options)
    cache.set(key, format)
  }
  return format
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Compact date for message lists: time today, weekday this week, date otherwise. */
export function formatListDate(time: number, now = new Date()): string {
  if (!time) return ''
  const d = new Date(time)
  const today = startOfDay(now)
  const day = startOfDay(d)
  const diffDays = Math.round((today - day) / 86_400_000)
  if (diffDays === 0) return dtf({ hour: '2-digit', minute: '2-digit' }).format(d)
  if (diffDays === 1) return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(-1, 'day').replace(/^./, (c) => c.toUpperCase())
  if (diffDays > 1 && diffDays < 7) return dtf({ weekday: 'long' }).format(d)
  if (d.getFullYear() === now.getFullYear()) return dtf({ day: 'numeric', month: 'short' }).format(d)
  return dtf({ day: '2-digit', month: '2-digit', year: '2-digit' }).format(d)
}

/** Full date and time, e.g. "Montag, 22. September 2025 um 08:27". */
export function formatFullDate(time: number | null): string {
  if (!time) return ''
  return dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(time))
}

export function formatDate(time: number | null): string {
  if (!time) return ''
  return dtf({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(time))
}

export function formatShortDate(time: number | null): string {
  if (!time) return ''
  return dtf({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(time))
}

export function formatTime(time: number | null): string {
  if (!time) return ''
  return dtf({ hour: '2-digit', minute: '2-digit' }).format(new Date(time))
}

/** Appointment range, collapsing the date if start and end are on the same day. */
export function formatRange(start: number | null, end: number | null, allDay: boolean): string {
  if (!start) return ''
  if (allDay) {
    const last = end ? end - 1 : start
    if (!end || startOfDay(new Date(start)) === startOfDay(new Date(last))) return formatDate(start)
    return `${formatDate(start)} – ${formatDate(last)}`
  }
  if (!end) return formatFullDate(start)
  if (startOfDay(new Date(start)) === startOfDay(new Date(end))) return `${formatFullDate(start)} – ${formatTime(end)}`
  return `${formatFullDate(start)} – ${formatFullDate(end)}`
}

export function formatRelative(time: number, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const seconds = Math.round((time - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86_400 * 30) return rtf.format(Math.round(seconds / 86_400), 'day')
  if (abs < 86_400 * 365) return rtf.format(Math.round(seconds / (86_400 * 30)), 'month')
  return rtf.format(Math.round(seconds / (86_400 * 365)), 'year')
}

const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return new Intl.NumberFormat(locale(), {
    style: 'unit',
    unit: SIZE_UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 || value >= 100 ? 0 : 1
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(locale()).format(value)
}

/** Replaces the home directory with "~" for display. */
export function prettyPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~').replace(/^C:\\Users\\[^\\]+/i, '~')
}

export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx > 0 ? path.slice(0, idx) : path
}
