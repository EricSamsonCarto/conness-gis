import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

// children are ItemRowLabel (or RenameInput), then IconButtons
// `active` keeps the hover look, like while editing
export function ItemRow({
  active = false,
  className = '',
  ...props
}: { active?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`kit-row-hover flex items-center gap-2 border-b border-panelBorder px-3 py-2 text-large text-strongText ${active ? 'kit-row-hover-active' : ''} ${className}`}
      {...props}
    />
  )
}

// the main click target, its color dot matches the item on the map
export function ItemRowLabel({
  color,
  className = '',
  children,
  ...props
}: { color?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${className}`}
      {...props}
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/15"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
  )
}
