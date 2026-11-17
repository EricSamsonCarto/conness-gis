import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean }

// outside click or Escape closes, arrows move between items
export function ProjectMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  // before paint, open upward when it doesn't fit below
  // the list remounts on every open, so the styles reset with it
  useLayoutEffect(() => {
    const menu = list.current
    if (!open || !menu || !trigger.current) return
    const { top, bottom } = trigger.current.getBoundingClientRect()
    const below = window.innerHeight - bottom
    if (menu.offsetHeight + 8 > below && top > below) {
      Object.assign(menu.style, { top: 'auto', bottom: '100%', marginTop: '0', marginBottom: '0.25rem' })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent) {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') buttons[(at + 1) % buttons.length]?.focus()
    else if (e.key === 'ArrowUp') buttons[(at - 1 + buttons.length) % buttons.length]?.focus()
    else if (e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') e.preventDefault()
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-md text-lichen transition-colors hover:bg-granite hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glacier aria-expanded:bg-granite aria-expanded:text-ink"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          role="menu"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-hairline bg-sheet py-1.5 shadow-[0_12px_32px_-12px_rgb(29_43_51/0.35)] motion-safe:animate-[menu-in_120ms_ease-out]"
        >
          {items.map((item) => (
            <li key={item.label} role="none" className={item.danger ? 'mt-1.5 border-t border-hairline pt-1.5' : ''}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={`block w-full px-3.5 py-2 text-left text-sm outline-none focus-visible:bg-granite hover:bg-granite ${item.danger ? 'text-alarm' : 'text-ink'}`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
