import Link from 'next/link'
import type { ComponentProps } from 'react'

export type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string }

/**
 * Internal link. URLs with a fragment (`/de#pricing`) are rendered as plain
 * anchors: on the same page the browser scrolls natively (respecting
 * `scroll-padding-top` and reduced motion), from other pages it loads the
 * prerendered page. Everything else uses client-side navigation.
 */
export function AppLink({ href, ...props }: AppLinkProps) {
  if (href.includes('#')) return <a href={href} {...props} />
  return <Link href={href} {...props} />
}
