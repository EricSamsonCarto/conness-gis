import { useState, type ReactNode } from 'react'
import { settings } from '@user/settings'
import { ChevronIcon } from './icons'
import { useWidgetId } from './widgetContext'

export function InfoSection({
  title = 'Info',
  defaultOpen = false,
  children,
}: {
  title?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  // a project can hide a widget's info section (ui.hideWidgetInfo)
  const widgetId = useWidgetId()
  if (widgetId && settings.ui?.hideWidgetInfo?.includes(widgetId)) return null

  return (
    <div className="rounded bg-surface text-medium text-text">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 p-2.5 text-left font-semibold text-text"
      >
        <ChevronIcon
          size={12}
          className={'shrink-0 transition-transform ' + (open ? 'rotate-90' : '')}
        />
        {title}
      </button>
      {open && <div className="px-2.5 pb-2.5 leading-relaxed">{children}</div>}
    </div>
  )
}
