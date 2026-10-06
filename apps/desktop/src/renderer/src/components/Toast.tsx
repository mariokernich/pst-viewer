import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { t } from '@/i18n'
import { useApp } from '@/store'

export function Toast() {
  const toast = useApp((s) => s.toast)
  const hide = useApp((s) => s.hideToast)
  if (!toast) return null
  const Icon = toast.tone === 'success' ? CircleCheck : toast.tone === 'error' ? CircleAlert : Info
  return (
    <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div key={toast.id} className="flex animate-slide-up items-center gap-2.5 rounded-2xl border border-line bg-surface-raised/95 py-2 pr-2 pl-3.5 shadow-popover backdrop-blur-xl">
        <Icon className={clsx('size-4.5 shrink-0', toast.tone === 'success' ? 'text-success' : toast.tone === 'error' ? 'text-danger' : 'text-accent')} strokeWidth={2.2} />
        <span className="text-[13px] font-medium">{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.run()
              hide()
            }}
            className="ml-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-accent hover:bg-accent/10"
          >
            {toast.action.label}
          </button>
        )}
        <button type="button" aria-label={t('close')} onClick={hide} className="flex size-7 items-center justify-center rounded-lg text-fg-subtle hover:bg-hover hover:text-fg">
          <X className="size-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
