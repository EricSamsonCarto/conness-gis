import type { ReactNode } from 'react'
import { DialogFrame } from './DialogFrame'

export interface Choice {
  id: string
  label: string
  // short line under the label
  description?: string
}

// render inside the widget's `relative` root, like ConfirmDialog
export function ChoiceDialog({
  open,
  title,
  message,
  choices,
  onChoose,
  onCancel,
}: {
  open: boolean
  title: string
  message?: ReactNode
  choices: Choice[]
  onChoose: (id: string) => void
  onCancel: () => void
}) {
  return (
    <DialogFrame open={open} title={title} message={message} onCancel={onCancel}>
      <div className="mt-3 flex flex-col gap-1.5">
        {choices.map((c, i) => (
          <button
            key={c.id}
            type="button"
            autoFocus={i === 0}
            onClick={() => onChoose(c.id)}
            className="rounded border border-panelBorder px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/10"
          >
            <span className="block text-large font-medium text-strongText">{c.label}</span>
            {c.description && <span className="block text-medium text-text">{c.description}</span>}
          </button>
        ))}
      </div>
    </DialogFrame>
  )
}
