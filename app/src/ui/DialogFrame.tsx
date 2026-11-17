import { useEffect, type ReactNode } from 'react'

// render inside the widget's `relative` root, only Cancel or Escape dismiss
export function DialogFrame({
  open,
  title,
  message,
  cancelLabel = 'Cancel',
  onCancel,
  children,
  actions,
}: {
  open: boolean
  title: string
  message?: ReactNode
  cancelLabel?: string
  onCancel: () => void
  children?: ReactNode
  actions?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-6"
    >
      {/* sticky, so it stays in view in a long scrolled list */}
      <div className="sticky top-6 w-full max-w-[260px] rounded-lg border border-panelBorder bg-panelBg p-3 shadow-xl">
        <p className="text-large font-semibold text-strongText">{title}</p>
        {message && <p className="mt-1 text-medium leading-relaxed text-text">{message}</p>}
        {children}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-panelBorder bg-panelBg px-3 py-1 text-dialogButton font-medium text-text hover:bg-text/10"
          >
            {cancelLabel}
          </button>
          {actions}
        </div>
      </div>
    </div>
  )
}
