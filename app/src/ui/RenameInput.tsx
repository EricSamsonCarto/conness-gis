import { useRef, useState } from 'react'

// empty name cancels, so a row never ends up nameless
export function RenameInput({
  initial,
  onCommit,
  onCancel,
  ariaLabel = 'Rename',
}: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState(initial)
  // some browsers fire blur after unmount on Enter or Escape, finish once
  const done = useRef(false)

  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    const name = draft.trim()
    if (commit && name) onCommit(name)
    else onCancel()
  }

  return (
    <input
      type="text"
      value={draft}
      autoFocus
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      className="min-w-0 flex-1 rounded border border-primary bg-panelBg px-1.5 py-0.5 text-large text-text outline-none focus:ring-2 focus:ring-primary/15"
    />
  )
}
