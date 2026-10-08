import Link from 'next/link'
import type { ComponentProps } from 'react'
import { withBasePath } from '@/lib/site'

export type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string }

/**
 * Link for internal and external URLs.
 *
 * - External URLs (`https://…`) are plain anchors.
 * - Internal URLs with a fragment (`/de/#download`) are plain anchors too: on
 *   the same page the browser scrolls natively (respecting
 *   `scroll-padding-top` and reduced motion), from other pages it loads the
 *   prerendered page. They need the base path added by hand.
 * - Everything else uses client-side navigation (`next/link` adds the base path).
 */
export function AppLink({ href, ...props }: AppLinkProps) {
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return <a href={href} {...props} />
  if (href.includes('#')) return <a href={withBasePath(href)} {...props} />
  return <Link href={href} {...props} />
}
