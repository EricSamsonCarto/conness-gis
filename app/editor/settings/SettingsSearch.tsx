import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { placedWidgetIds } from '@/core/widgets/placedWidgets'
import type { Settings } from '@/core/types'
import { useEditor } from '../edits/editorContext'
import { buildIndex, search, type SearchResult } from './searchIndex'
import { WIDGET_SECTIONS } from './widgetSchemas'

type Layer = { id: string; name?: string; type: string }

// names and keys, not descriptions. `/` or ⌘K focuses it
export function SettingsSearch() {
  const { files, reveal } = useEditor()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)

  const layers = files.layers?.layers as Layer[] | undefined
  const index = useMemo(() => buildIndex(layers ?? [], WIDGET_SECTIONS), [layers])
  const placed = placedWidgetIds(files.settings as unknown as Settings)
  const results = open ? search(index, query, placed) : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element).closest('input, textarea, select, [contenteditable]')
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  function pick(result: SearchResult) {
    reveal(result)
    setOpen(false)
    input.current?.blur()
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (results.length ? (i + step + results.length) % results.length : 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      pick(results[active])
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      input.current?.blur()
    }
  }

  const optionId = (i: number) => `settings-search-${i}`

  return (
    <div ref={root} className="relative col-span-2">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search settings and layers"
        aria-expanded={open && query.trim() !== ''}
        aria-controls="settings-search-results"
        aria-activedescendant={results[active] ? optionId(active) : undefined}
        placeholder="Search settings and layers (/)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="block w-full rounded-md border border-line bg-field py-1.5 pr-8 pl-2.5 text-[13px] text-white outline-none placeholder:text-fg-subtle focus:border-glacier focus:ring-3 focus:ring-glacier/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            input.current?.focus()
          }}
          className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] leading-none text-ink hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-glacier-light"
        >
          ×
        </button>
      )}
      {open && query.trim() !== '' && (
        <ul
          id="settings-search-results"
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.5)]"
        >
          {results.length === 0 && <li className="px-3 py-2 text-[13px] text-fg-subtle">No settings or layers match.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.kind}:${r.target}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // pointerdown, since the input's blur would close the list first
              onPointerDown={(e) => {
                e.preventDefault()
                pick(r)
              }}
              onPointerEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-line' : ''} ${r.notPlaced ? 'opacity-50' : ''}`}
            >
              <span className="block truncate text-[13px] text-white">{r.label}</span>
              <span className="block truncate text-[11px] text-fg-subtle">
                {r.where}
                {r.notPlaced && ' · Not placed'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
