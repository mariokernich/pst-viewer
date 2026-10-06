import { FileText, Mail, Printer, Share, Type } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MessageDetail } from '@shared/types'
import { t } from '@/i18n'
import { useApp } from '@/store'
import { IconButton } from './ui/Button'
import { Spinner } from './ui/Controls'
import { Menu, type MenuEntry } from './ui/Overlay'

/** Export and print actions for a single message. */
export function ExportMenu({ detail }: { detail: MessageDetail }) {
  const exporting = useApp((s) => s.exporting)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const { exportMessage, printMessage } = useApp.getState()

  const items: MenuEntry[] = [
    { heading: t('exportMenu') },
    { label: t('exportPdf'), icon: FileText, onSelect: () => void exportMessage(detail, 'pdf') },
    { label: t('exportEml'), icon: Mail, onSelect: () => void exportMessage(detail, 'eml') },
    { label: t('exportText'), icon: Type, onSelect: () => void exportMessage(detail, 'txt') },
    'separator',
    { label: t('print'), icon: Printer, onSelect: () => void printMessage(detail) }
  ]

  return (
    <>
      {exporting ? (
        <span className="flex size-8 items-center justify-center text-fg-muted" title={t('preparingExport')} role="status">
          <Spinner />
        </span>
      ) : (
        <IconButton ref={anchor} icon={Share} label={t('exportMenu')} active={open} onClick={() => setOpen((o) => !o)} />
      )}
      <Menu open={open} onClose={() => setOpen(false)} anchor={anchor} items={items} placement="bottom-end" label={t('exportMenu')} />
    </>
  )
}
