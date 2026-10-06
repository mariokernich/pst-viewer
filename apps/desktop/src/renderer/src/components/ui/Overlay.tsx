import clsx from 'clsx'
import { Check, type LucideIcon, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchor: RefObject<HTMLElement | null>
  placement?: 'bottom-start' | 'bottom-end'
  className?: string
  children: ReactNode
  /** Elements that count as "inside" for outside-click detection. */
  ignore?: RefObject<HTMLElement | null>[]
  label?: string
}

/** Floating panel anchored to an element. Closes on outside click and Escape. */
export function Popover({ open, onClose, anchor, placement = 'bottom-start', className, children, ignore = [], label }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; maxHeight: number } | null>(null)

  const place = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect()
    if (!rect) return
    const top = rect.bottom + 6
    const maxHeight = window.innerHeight - top - 12
    if (placement === 'bottom-end') setPos({ top, right: Math.max(8, window.innerWidth - rect.right), maxHeight })
    else setPos({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)), maxHeight })
  }, [anchor, placement])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return
      if (ignore.some((r) => r.current?.contains(target))) return
      onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // Also prevent the default action, e.g. a search field clearing itself.
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, anchor, ignore])

  if (!open || !pos) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      style={{ top: pos.top, left: pos.left, right: pos.right, maxHeight: pos.maxHeight }}
      className={clsx(
        'fixed z-50 animate-pop-in overflow-auto rounded-2xl border border-line bg-surface-raised/95 shadow-popover backdrop-blur-xl backdrop-saturate-150',
        className
      )}
    >
      {children}
    </div>,
    document.body
  )
}

export interface MenuItem {
  label: string
  icon?: LucideIcon
  checked?: boolean
  disabled?: boolean
  onSelect: () => void
}

export type MenuEntry = MenuItem | 'separator' | { heading: string }

interface MenuProps {
  open: boolean
  onClose: () => void
  anchor: RefObject<HTMLElement | null>
  items: MenuEntry[]
  placement?: 'bottom-start' | 'bottom-end'
  label: string
}

/** Keyboard accessible dropdown menu. */
export function Menu({ open, onClose, anchor, items, placement = 'bottom-end', label }: MenuProps) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus())
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])]
    const idx = nodes.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      nodes[(idx + 1) % nodes.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      nodes[(idx - 1 + nodes.length) % nodes.length]?.focus()
    } else if (event.key === 'Tab') {
      event.preventDefault()
    }
  }

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} placement={placement} className="min-w-[220px] p-1.5" label={label}>
      <div ref={list} role="menu" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          if (item === 'separator') return <div key={i} role="separator" className="mx-2 my-1 h-px bg-line" />
          if ('heading' in item)
            return (
              <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-fg-muted">
                {item.heading}
              </div>
            )
          const Icon = item.icon
          return (
            <button
              key={i}
              type="button"
              role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
              aria-checked={item.checked}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect()
                onClose()
              }}
              className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] outline-none hover:bg-accent hover:text-accent-fg focus-visible:bg-accent focus-visible:text-accent-fg disabled:opacity-40"
            >
              <span className="flex size-4 items-center justify-center">
                {item.checked ? <Check className="size-3.5" strokeWidth={2.4} /> : Icon ? <Icon className="size-4" strokeWidth={1.8} /> : null}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </Popover>
  )
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  className?: string
  actions?: ReactNode
  closeLabel: string
  onKeyDown?: (event: React.KeyboardEvent<HTMLDialogElement>) => void
}

/** Modal dialog based on the native <dialog> element (focus trap, Escape, top layer). */
export function Dialog({ open, onClose, title, children, className, actions, closeLabel, onKeyDown }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Focus the content instead of the first button (no stray focus ring on "close").
      dialog.querySelector<HTMLElement>('[data-dialog-body]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      onKeyDown={onKeyDown}
      className={clsx(
        'm-auto max-h-[86vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised p-0 text-fg shadow-popover backdrop:bg-black/25 backdrop:backdrop-blur-[2px] open:flex open:animate-pop-in',
        className
      )}
    >
      {open && (
        <>
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line pr-2 pl-5">
            <h2 className="flex-1 truncate text-[14px] font-semibold">{title}</h2>
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </header>
          <div data-dialog-body tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-none">
            {children}
          </div>
        </>
      )}
    </dialog>
  )
}
