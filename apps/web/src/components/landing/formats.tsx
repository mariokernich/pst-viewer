import { landing } from '@/content/landing'
import type { Locale } from '@/lib/i18n'

/** A small document glyph with the file extension. */
function FileGlyph({ ext }: { ext: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-brand-ink relative grid h-14 w-11 shrink-0 place-items-end justify-center rounded-lg pb-2 text-[10px] font-bold tracking-wide text-white shadow-[0_6px_16px_-6px_rgb(61_90_255/0.6)] [clip-path:polygon(0_0,68%_0,100%_24%,100%_100%,0_100%)]"
    >
      <span className="absolute top-0 right-0 h-[24%] w-[32%] rounded-bl-md bg-white/35" />
      {ext}
    </span>
  )
}

export function Formats({ locale }: { locale: Locale }) {
  const t = landing[locale].formats
  return (
    <section aria-labelledby="formats-title" className="border-y border-line bg-background-subtle">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 id="formats-title" className="text-center text-sm font-semibold text-muted">
          {t.label}
        </h2>
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {t.items.map((item) => (
            <li key={item.ext} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-soft">
              <FileGlyph ext={item.ext} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  <span className="sr-only">{item.ext}: </span>
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
