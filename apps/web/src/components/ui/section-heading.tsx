import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  /** Id of the heading, referenced by the section's `aria-labelledby`. */
  id: string
  eyebrow: string
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  tone?: 'default' | 'inverted'
  className?: string
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'center',
  tone = 'default',
  className,
}: SectionHeadingProps) {
  const inverted = tone === 'inverted'
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className={cn('text-sm font-semibold tracking-wide', inverted ? 'text-[#a9c4ff]' : 'text-accent')}>{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          'mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-5xl',
          inverted ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn('mt-4 text-lg leading-relaxed text-pretty', inverted ? 'text-white/75' : 'text-muted')}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
