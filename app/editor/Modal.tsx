import { useEffect, useRef, type ReactNode } from 'react'
import { button } from './ui'

// a text field or dropdown inside a Modal
export const modalInput =
  'mt-1.5 block w-full rounded-md border border-hairline bg-sheet px-3 py-2 text-base text-ink outline-none transition-colors focus:border-glacier focus:ring-3 focus:ring-glacier/20'

// native <dialog>: focus trap, Escape and backdrop come with showModal()
export function Modal({
  open,
  title,
  submitLabel,
  danger = false,
  error,
  onSubmit,
  onClose,
  children,
  cancelLabel = 'Cancel',
}: {
  open: boolean
  title: string
  submitLabel: string
  danger?: boolean
  error?: string | null
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
  // null means no Cancel, for a message with one button
  cancelLabel?: string | null
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-[420px] rounded-xl bg-sheet p-0 text-ink shadow-[0_24px_60px_-20px_rgb(29_43_51/0.5)] motion-safe:open:animate-[modal-in_160ms_ease-out]"
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <h2 id="modal-title" className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-lichen">{children}</div>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-alarm/8 px-3 py-2 text-sm text-alarm">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {cancelLabel !== null && (
            <button type="button" className={button.quiet} onClick={onClose}>
              {cancelLabel}
            </button>
          )}
          <button type="submit" className={danger ? button.danger : button.primary}>
            {submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
