import clsx from 'clsx'
import { ImageOff } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { bridge } from '@/api'
import { t } from '@/i18n'
import { highlightDocument, prepareHtml } from '@/lib/emailHtml'
import { Highlight } from './Highlight'
import { Button } from './ui/Button'

interface HtmlBodyProps {
  html: string
  inlineImages: Record<string, string>
  allowRemote: boolean
  onAllowRemote: () => void
  terms: readonly string[]
  /** Scroll container of the reading pane, used to reveal the first match. */
  scrollContainer: React.RefObject<HTMLElement | null>
  onHoverLink: (url: string | null) => void
}

/**
 * Renders an HTML mail inside a sandboxed iframe: scripts are disabled by the
 * sandbox, the content is sanitised and a strict CSP blocks remote content.
 */
export function HtmlBody({ html, inlineImages, allowRemote, onAllowRemote, terms, scrollContainer, onHoverLink }: HtmlBodyProps) {
  const prepared = useMemo(() => prepareHtml(html, inlineImages, allowRemote), [html, inlineImages, allowRemote])
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(120)

  useEffect(() => {
    const iframe = frame.current
    if (!iframe) return
    let observer: ResizeObserver | null = null
    const cleanups: (() => void)[] = []

    const onLoad = (): void => {
      const doc = iframe.contentDocument
      if (!doc?.documentElement) return

      const measure = (): void => {
        const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0)
        setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev))
      }
      measure()
      observer = new ResizeObserver(measure)
      observer.observe(doc.documentElement)
      if (doc.body) observer.observe(doc.body)
      doc.querySelectorAll('img').forEach((img) => {
        if (!img.complete) img.addEventListener('load', measure, { once: true })
      })

      const marks = highlightDocument(doc, terms)
      if (marks.length > 0) {
        marks[0].classList.add('pst-hl-current')
        requestAnimationFrame(() => {
          const container = scrollContainer.current
          if (!container) return
          const frameTop = iframe.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
          const markTop = marks[0].getBoundingClientRect().top
          if (markTop > container.clientHeight * 0.6) container.scrollTo({ top: frameTop + markTop - container.clientHeight / 3, behavior: 'smooth' })
        })
      }

      const onClick = (event: MouseEvent): void => {
        const anchor = (event.target as Element | null)?.closest?.('a')
        if (!anchor) return
        event.preventDefault()
        const href = anchor.getAttribute('href') ?? ''
        if (href.startsWith('#')) {
          const id = decodeURIComponent(href.slice(1))
          const target = doc.getElementById(id) ?? doc.getElementsByName(id)[0]
          target?.scrollIntoView({ behavior: 'smooth' })
          return
        }
        if (/^(https?:|mailto:)/i.test(href)) void bridge.openExternal(href)
      }
      const onOver = (event: MouseEvent): void => {
        const anchor = (event.target as Element | null)?.closest?.('a[href]')
        const href = anchor?.getAttribute('href') ?? ''
        onHoverLink(/^(https?:|mailto:)/i.test(href) ? href : null)
      }
      const onLeave = (): void => onHoverLink(null)
      // Forward keyboard shortcuts (arrow navigation etc.) to the app.
      const onKey = (event: KeyboardEvent): void => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: event.key, code: event.code, metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey }))
      }
      doc.addEventListener('click', onClick)
      doc.addEventListener('mouseover', onOver)
      doc.addEventListener('mouseleave', onLeave)
      doc.addEventListener('keydown', onKey)
      cleanups.push(() => {
        doc.removeEventListener('click', onClick)
        doc.removeEventListener('mouseover', onOver)
        doc.removeEventListener('mouseleave', onLeave)
        doc.removeEventListener('keydown', onKey)
      })
    }

    iframe.addEventListener('load', onLoad)
    return () => {
      iframe.removeEventListener('load', onLoad)
      observer?.disconnect()
      cleanups.forEach((fn) => fn())
      onHoverLink(null)
    }
  }, [prepared, terms, scrollContainer, onHoverLink])

  return (
    <>
      {prepared.hasRemote && !allowRemote && (
        <div className="mx-8 mb-3 flex animate-fade-in items-center gap-3 rounded-xl border border-line bg-surface-sunken px-3.5 py-2.5">
          <ImageOff className="size-4 shrink-0 text-fg-muted" strokeWidth={2} />
          <span className="flex-1 text-[12.5px] text-fg-muted">{t('remoteBlocked')}</span>
          <Button size="sm" onClick={onAllowRemote}>
            {t('loadRemote')}
          </Button>
        </div>
      )}
      <div className="mx-8 mb-8 overflow-hidden rounded-xl bg-paper shadow-card">
        <iframe
          ref={frame}
          title={t('viewHtml')}
          sandbox="allow-same-origin"
          srcDoc={prepared.doc}
          style={{ height }}
          className="block w-full border-0 bg-paper"
        />
      </div>
    </>
  )
}

const URL_PATTERN = /\b(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|mailto:[^\s<>"')\]]+|[\w.+-]+@[\w-]+\.[\w.-]+\w)/gi

/** Plain text body with clickable links, quote styling and highlighting. */
export function TextBody({ text, terms, onHoverLink }: { text: string; terms: readonly string[]; onHoverLink: (url: string | null) => void }) {
  const lines = useMemo(() => text.split('\n'), [text])
  return (
    <div className="selectable mx-8 mb-10 font-sans text-[14px] leading-[1.6] break-words whitespace-pre-wrap">
      {lines.map((line, i) => {
        const quoted = /^\s*>/.test(line)
        return (
          <div key={i} className={clsx(quoted && 'border-l-2 border-line-strong pl-3 text-fg-muted')}>
            {line ? <Linkified text={line} terms={terms} onHoverLink={onHoverLink} /> : '​'}
          </div>
        )
      })}
    </div>
  )
}

function Linkified({ text, terms, onHoverLink }: { text: string; terms: readonly string[]; onHoverLink: (url: string | null) => void }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(<Highlight key={`t${index}`} text={text.slice(last, index)} terms={terms} />)
    const raw = match[0]
    const href = raw.includes('@') && !raw.startsWith('mailto:') && !raw.includes('/') ? `mailto:${raw}` : raw.startsWith('www.') ? `https://${raw}` : raw
    parts.push(
      <a
        key={`l${index}`}
        href={href}
        onClick={(event) => {
          event.preventDefault()
          void bridge.openExternal(href)
        }}
        onMouseEnter={() => onHoverLink(href)}
        onMouseLeave={() => onHoverLink(null)}
        className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        <Highlight text={raw} terms={terms} />
      </a>
    )
    last = index + raw.length
  }
  if (last < text.length) parts.push(<Highlight key="end" text={text.slice(last)} terms={terms} />)
  return <Fragment>{parts}</Fragment>
}
