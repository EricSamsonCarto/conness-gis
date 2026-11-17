import type { ReactNode } from 'react'
import { DialogFrame } from './DialogFrame'

// render inside the widget's `relative` root, it dims that widget only
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // 'danger': red confirm for delete/overwrite
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmClass =
    variant === 'danger'
      ? 'bg-danger text-white hover:bg-dangerHover'
      : 'bg-primary text-white hover:opacity-90'

  return (
    <DialogFrame
      open={open}
      title={title}
      message={message}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      actions={
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className={'rounded px-3 py-1 text-dialogButton font-medium ' + confirmClass}
        >
          {confirmLabel}
        </button>
      }
    />
  )
}
