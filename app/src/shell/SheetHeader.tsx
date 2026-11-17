import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

interface SheetHeaderProps {
  title?: string
  titleClass: string
  titleStyle?: CSSProperties
  divider: boolean
  onClose: () => void
  closeLabel: string
  onDragStart: (e: ReactPointerEvent) => void
  // buttons left of the close (the popup's actions), 28 px like it
  actions?: ReactNode
}

// the whole row drags, equal outer columns keep the grab bar centered
export function SheetHeader({ title, titleClass, titleStyle, divider, onClose, closeLabel, onDragStart, actions }: SheetHeaderProps) {
  return (
    <div
      onPointerDown={onDragStart}
      className={
        'grid shrink-0 cursor-row-resize touch-none select-none grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-1.5 ' +
        (divider ? 'border-b border-panelBorder' : '')
      }
    >
      <span className={`min-w-0 truncate ${titleClass}`} style={titleStyle} title={title}>
        {title}
      </span>
      <div role="separator" aria-label="Resize sheet" className="h-1.5 w-10 rounded-full bg-text/35" />
      <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-0.5 justify-self-end">
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-text hover:bg-text/10 hover:text-strongText"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
