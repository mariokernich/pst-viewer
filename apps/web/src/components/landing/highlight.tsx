import { Fragment } from 'react'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Marks every occurrence of `terms` in `text` like the app's search highlight. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return text
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="hl">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}
