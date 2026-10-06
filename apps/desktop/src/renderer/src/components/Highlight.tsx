import { Fragment, memo } from 'react'
import { findMatches } from '@shared/text'

/** Renders text with search term matches wrapped in <mark>. */
export const Highlight = memo(function Highlight({ text, terms }: { text: string; terms: readonly string[] }) {
  if (!text || terms.length === 0) return <>{text}</>
  const ranges = findMatches(text, terms)
  if (ranges.length === 0) return <>{text}</>
  const parts: React.ReactNode[] = []
  let last = 0
  ranges.forEach((range, i) => {
    if (range.start > last) parts.push(<Fragment key={`t${i}`}>{text.slice(last, range.start)}</Fragment>)
    parts.push(
      <mark key={`m${i}`} className="hl">
        {text.slice(range.start, range.end)}
      </mark>
    )
    last = range.end
  })
  if (last < text.length) parts.push(<Fragment key="end">{text.slice(last)}</Fragment>)
  return <>{parts}</>
})
