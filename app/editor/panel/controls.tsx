import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { isColorName } from '../colorNames'
import { THEME_COLOR_NAMES } from '../settings/settingsMap'
import { HexColorPicker } from 'react-colorful'

// `undefined` means unset, shown as the dimmed default. writing it
// removes the key. units belong in the setting's description

const field =
  'rounded-md border border-line bg-field px-2.5 py-1.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-glacier focus:ring-3 focus:ring-glacier/40'

// a color field's width, dropdowns among colors match it

type Base = { labelledBy: string }

export function Switch({
  value,
  fallback,
  onChange,
  labelledBy,
  onLight = false,
}: Base & { value?: boolean; fallback?: boolean; onChange: (v: boolean) => void; onLight?: boolean }) {
  const on = value ?? fallback ?? false
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glacier-light ${
        // on a white dialog the sidebar's off track would vanish
        on ? 'bg-glacier' : onLight ? 'bg-hairline' : 'bg-line'
      } ${value === undefined ? 'opacity-55' : ''}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// the default option is marked, and unset shows it selected, dimmed
export function Select({
  value,
  options,
  labelOf,
  fallback,
  onChange,
  labelledBy,
  emptyLabel,
}: Base & {
  value?: string
  options: string[]
  labelOf: (option: string) => string
  fallback?: unknown
  onChange: (v: string) => void
  // shown when nothing is picked and there's no default
  emptyLabel?: string
}) {
  const shown = value ?? (typeof fallback === 'string' ? fallback : '')
  return (
    <select
      aria-labelledby={labelledBy}
      value={shown}
      onChange={(e) => onChange(e.target.value)}
      // native selects ignore line-height, so this matches the text fields
      // min-w-0, or a dropdown is as wide as its longest option
      className={`${field} h-[calc(1.5em+0.75rem+2px)] min-w-0 truncate w-full ${value === undefined ? 'text-fg-subtle' : ''}`}
    >
      {shown === '' && <option value="">{emptyLabel ?? '—'}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {labelOf(o)}
          {o === fallback ? ' (default)' : ''}
        </option>
      ))}
    </select>
  )
}

export type ContentOption = { value: string; label: string }

// a value no longer in the list still shows, so a stale reference is
// visible rather than silently swapped
export function ContentSelect({
  value,
  options,
  fallback,
  missingLabel = (v) => `${v} (not found)`,
  loading = false,
  loadingText = 'Reading…',
  error,
  emptyLabel,
  onChange,
  labelledBy,
}: Base & {
  value?: string
  options: ContentOption[]
  emptyLabel?: string
  fallback?: string
  missingLabel?: (value: string) => string
  loading?: boolean
  loadingText?: string
  error?: string
  onChange: (v: string) => void
}) {
  if (loading) return <span className="text-fg-subtle">{loadingText}</span>
  if (error && value === undefined) {
    return (
      <span className="truncate text-problem" title={error}>
        {error}
      </span>
    )
  }
  const known = options.some((o) => o.value === value)
  const all = value !== undefined && !known ? [{ value, label: missingLabel(value) }, ...options] : options
  const labels = Object.fromEntries(all.map((o) => [o.value, o.label]))
  return (
    <Select
      labelledBy={labelledBy}
      value={value}
      options={all.map((o) => o.value)}
      labelOf={(v) => labels[v] ?? v}
      fallback={fallback}
      emptyLabel={emptyLabel}
      onChange={onChange}
    />
  )
}

// an empty box steps from its default, not from the browser's 0
export function NumberField({
  value,
  fallback,
  onChange,
  labelledBy,
  min,
  max,
  step,
  disabled,
}: Base & {
  value?: number
  fallback?: unknown
  onChange: (v: number | undefined) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  // the last press was on the spinner arrows, not in the text
  const spinner = useRef(false)
  const base = value === undefined && typeof fallback === 'number' ? fallback : undefined
  const stepFrom = (from: number, dir: number) =>
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, from + dir * (step ?? 1))))
  return (
    <input
      type="number"
      aria-labelledby={labelledBy}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={value ?? ''}
      placeholder={typeof fallback === 'number' ? String(fallback) : ''}
      onPointerDown={(e) => {
        spinner.current = e.nativeEvent.offsetX > e.currentTarget.clientWidth - 20
      }}
      onKeyDown={(e) => {
        spinner.current = false
        if (base === undefined || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
        e.preventDefault()
        stepFrom(base, e.key === 'ArrowUp' ? 1 : -1)
      }}
      onChange={(e) => {
        const text = e.target.value
        // from empty the browser lands on +step, or -step or min going down
        if (base !== undefined && spinner.current && text !== '') return stepFrom(base, Number(text) > 0 ? 1 : -1)
        onChange(text === '' ? undefined : Number(text))
      }}
      className={`${field} w-20 px-1.5 text-right disabled:opacity-50`}
    />
  )
}

export function Slider({
  value,
  fallback,
  onChange,
  labelledBy,
}: Base & { value?: number; fallback?: unknown; onChange: (v: number) => void }) {
  const shown = value ?? (typeof fallback === 'number' ? fallback : 0)
  return (
    <span className="flex w-32 shrink-0 items-center gap-2">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        aria-labelledby={labelledBy}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`min-w-0 flex-1 accent-glacier ${value === undefined ? 'opacity-55' : ''}`}
      />
      <span className={`w-8 text-right text-[11px] tabular-nums ${value === undefined ? 'text-fg-subtle' : 'text-fg'}`}>
        {shown.toFixed(2)}
      </span>
    </span>
  )
}

export function TextField({
  value,
  fallback,
  onChange,
  labelledBy,
}: Base & { value?: string; fallback?: string; onChange: (v: string | undefined) => void }) {
  return (
    <input
      aria-labelledby={labelledBy}
      value={value ?? ''}
      placeholder={fallback}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      className={`${field} w-full`}
    />
  )
}

// the text stays as typed while focused, so a trailing comma survives
export function TextListField({
  value,
  fallback,
  onChange,
  labelledBy,
}: Base & { value?: string[]; fallback?: string[]; onChange: (v: string[] | undefined) => void }) {
  const joined = value?.join(', ') ?? ''
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    if (text === null) return
    const words = text.split(',').map((w) => w.trim()).filter(Boolean)
    setText(null)
    onChange(words.length > 0 ? words : undefined)
  }
  return (
    <input
      aria-labelledby={labelledBy}
      value={text ?? joined}
      placeholder={fallback?.join(', ')}
      onFocus={() => setText(joined)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
      className={`${field} w-full`}
    />
  )
}

// a number, or a word in its place like "auto", ticked beside the box
export function NumberOrWord({
  value,
  fallback,
  words,
  onChange,
  labelledBy,
}: Base & {
  value?: number | string
  fallback?: unknown
  words: string[]
  onChange: (v: number | string | undefined) => void
}) {
  const word = words[0]
  const isWord = value === word
  return (
    <span className="flex shrink-0 items-center gap-2">
      <label className="flex items-center gap-1 text-[11px] text-fg-subtle">
        <input
          type="checkbox"
          checked={isWord || (value === undefined && fallback === word)}
          onChange={(e) => onChange(e.target.checked ? word : undefined)}
          className="accent-glacier"
        />
        {word.charAt(0).toUpperCase() + word.slice(1)}
      </label>
      <NumberField
        labelledBy={labelledBy}
        value={typeof value === 'number' ? value : undefined}
        fallback={isWord ? undefined : fallback}
        disabled={isWord}
        onChange={onChange}
      />
    </span>
  )
}

// order is the order they were picked. unticking the last box resets,
// since an empty list means the default anyway
export function MultiSelect({
  value,
  options,
  labelOf,
  fallback,
  fallbackText,
  onChange,
  labelledBy,
}: Base & {
  value?: string[]
  options: string[]
  labelOf: (option: string) => string
  fallback: string[]
  fallbackText?: string
  onChange: (v: string[] | undefined) => void
}) {
  const { open, setOpen, root, pop: list } = usePopover()
  const picked = value ?? fallback
  const summary = value === undefined ? (fallbackText ?? picked.map(labelOf).join(', ')) : value.map(labelOf).join(', ')
  const toggle = (o: string) => {
    const next = picked.includes(o) ? picked.filter((v) => v !== o) : [...picked, o]
    onChange(next.length === 0 ? undefined : next)
  }
  return (
    <div ref={root} className="relative w-full">
      <button
        type="button"
        aria-labelledby={labelledBy}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex w-full items-center gap-1 text-left ${value === undefined ? 'text-fg-subtle' : ''}`}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span aria-hidden="true" className="text-[11px] text-fg-subtle">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            role="group"
            data-keep-panel
            aria-labelledby={labelledBy}
            style={{ visibility: 'hidden' }}
            className={`${popoverClass} py-1`}
          >
            {options.map((o) => {
              return (
                <label key={o} className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] whitespace-nowrap hover:bg-field">
                  <input
                    type="checkbox"
                    checked={picked.includes(o)}
                    onChange={() => toggle(o)}
                    className={`accent-glacier ${value === undefined ? 'opacity-55' : ''}`}
                  />
                  {labelOf(o)}
                </label>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

// editor.css lists the full palette, so typed names get colors too
const HUES = [
  'slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose',
]
const SHADES = ['100', '200', '400', '500', '600', '700', '900']

// rendered into the page body, so no panel edge clips it
// scrolling the panel behind it closes it too
function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = pop.current
    const box = root.current?.getBoundingClientRect()
    if (!open || !el || !box) return
    const below = window.innerHeight - box.bottom
    const up = el.offsetHeight + 8 > below && box.top > below
    el.style.minWidth = `${box.width}px`
    el.style.top = `${up ? box.top - el.offsetHeight - 4 : box.bottom + 4}px`
    el.style.left = `${Math.max(8, Math.min(box.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8))}px`
    el.style.visibility = 'visible'
  }, [open])
  useEffect(() => {
    if (!open) return
    const inside = (target: EventTarget | null) =>
      root.current?.contains(target as Node) || pop.current?.contains(target as Node)
    const onPointer = (e: PointerEvent) => !inside(e.target) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onScroll = (e: Event) => !inside(e.target) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])
  return { open, setOpen, root, pop }
}

// data-keep-panel, a click in a popover keeps the pop-out open
const popoverClass =
  'fixed z-50 rounded-md border border-white/25 bg-surface text-fg-muted [color-scheme:dark] shadow-[0_2px_6px_rgb(0_0_0/0.35),0_18px_44px_-6px_rgb(0_0_0/0.7)]'

// the picker works in hex, so a named or rgba color starts it at black
export function MapColorField({
  value,
  fallback,
  onChange,
  labelledBy,
}: Base & { value?: string; fallback?: unknown; onChange: (v: string | undefined) => void }) {
  const { open, setOpen, root, pop } = usePopover()
  const shown = value ?? (typeof fallback === 'string' ? fallback : '')
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(shown)
  const hex = /^#[0-9a-f]{6}$/i.test(shown) ? shown : short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : '#000000'
  return (
    <div ref={root} className="flex w-full min-w-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Pick a color"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`size-[calc(1.5em+0.75rem+2px)] shrink-0 rounded border border-line p-1 focus-visible:outline-2 focus-visible:outline-glacier-light ${value === undefined ? 'opacity-55' : ''}`}
      >
        <span className="block size-full rounded-sm" style={{ background: shown || 'transparent' }} />
      </button>
      <TextField labelledBy={labelledBy} value={value} fallback={typeof fallback === 'string' ? fallback : undefined} onChange={onChange} />
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            data-keep-panel
            aria-labelledby={labelledBy}
            style={{ visibility: 'hidden' }}
            className={`${popoverClass} p-2`}
          >
            <HexColorPicker color={hex} onChange={onChange} />
          </div>,
          document.body,
        )}
    </div>
  )
}

// a Tailwind color name like "blue-900", picked or typed
export function ColorPicker({
  value,
  fallback,
  onChange,
  labelledBy,
}: Base & { value?: string; fallback?: unknown; onChange: (v: string) => void }) {
  const { open, setOpen, root, pop } = usePopover()
  const [badName, setBadName] = useState<string | null>(null)
  const shown = value ?? (typeof fallback === 'string' ? fallback : '')
  const pick = (name: string) => {
    setBadName(null)
    onChange(name)
    setOpen(false)
  }
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-labelledby={labelledBy}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${field} flex w-full items-center gap-2 ${value === undefined ? 'text-fg-subtle' : ''}`}
      >
        <span
          aria-hidden="true"
          className={`size-4 rounded border border-line ${value === undefined ? 'opacity-55' : ''}`}
          style={{ background: shown ? `var(--color-${shown})` : 'transparent' }}
        />
        <span className="min-w-0 flex-1 truncate text-left">{shown || '—'}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            data-keep-panel
            aria-labelledby={labelledBy}
            style={{ visibility: 'hidden' }}
            className={`${popoverClass} p-2`}
          >
            <div className="grid grid-flow-col grid-rows-7 gap-0.5">
              {HUES.flatMap((hue) =>
                SHADES.map((shade) => {
                  const name = `${hue}-${shade}`
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={name === shown}
                      onClick={() => pick(name)}
                      className="size-3 rounded-[2px] outline-offset-1 hover:outline-2 hover:outline-white aria-pressed:outline-2 aria-pressed:outline-white"
                      style={{ background: `var(--color-${name})` }}
                    />
                  )
                }),
              )}
            </div>
            <div className="mt-2 flex gap-1.5">
              {['white', 'black'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  aria-pressed={name === shown}
                  className="flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-[11px] text-fg-muted hover:border-fg-subtle aria-pressed:border-white"
                >
                  <span aria-hidden="true" className="size-3 rounded-sm border border-line" style={{ background: name }} />
                  {name}
                </button>
              ))}
            </div>
            <input
              aria-label="Color name"
              placeholder="or type a name, e.g. blue-950"
              defaultValue={value ?? ''}
              aria-invalid={badName !== null}
              aria-describedby={badName !== null ? `${labelledBy}-bad-color` : undefined}
              onChange={() => setBadName(null)}
              onKeyDown={(e) => {
                const text = e.currentTarget.value.trim()
                if (e.key !== 'Enter' || !text) return
                // a name that isn't a color would blank it silently, so it's never written
                if (isColorName(text, THEME_COLOR_NAMES)) pick(text)
                else setBadName(text)
              }}
              className={`${field} mt-2 w-full text-[11px] ${badName !== null ? 'border-problem' : ''}`}
            />
            {badName !== null && (
              <p id={`${labelledBy}-bad-color`} role="alert" className="mt-1.5 max-w-[15rem] text-[11px] leading-snug text-problem">
                &apos;{badName}&apos; isn&apos;t a color. Use a palette name (blue-700, white, black) or another color&apos;s
                name (primary, text). Names are case-sensitive.
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

// two or four numbers in a row, Use current view goes under it
function NumberRow({
  values,
  names,
  onChange,
  labelledBy,
}: Base & { values: (number | undefined)[]; names: string[]; onChange: (v: number[] | undefined) => void }) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-1">
      {names.map((name, i) => (
        <input
          key={name}
          type="number"
          step="any"
          aria-label={name}
          placeholder={name}
          value={values[i] ?? ''}
          onChange={(e) => {
            const next = values.map((v, j) => (j === i ? (e.target.value === '' ? undefined : Number(e.target.value)) : v))
            onChange(next.every((v) => v === undefined) ? undefined : (next.map((v) => v ?? 0) as number[]))
          }}
          className={`${field} w-full px-1.5 text-right`}
        />
      ))}
    </div>
  )
}

export function LngLatField({
  value,
  onChange,
  labelledBy,
}: Base & { value?: [number, number]; onChange: (v: [number, number] | undefined) => void }) {
  return (
    <NumberRow
      labelledBy={labelledBy}
      names={['Longitude', 'Latitude']}
      values={value ?? []}
      onChange={(v) => onChange(v as [number, number] | undefined)}
    />
  )
}

export function BoundsField({
  value,
  onChange,
  labelledBy,
}: Base & {
  value?: [[number, number], [number, number]]
  onChange: (v: [[number, number], [number, number]] | undefined) => void
}) {
  const flat = value ? [value[0][0], value[0][1], value[1][0], value[1][1]] : []
  return (
    <NumberRow
      labelledBy={labelledBy}
      names={['West', 'South', 'East', 'North']}
      values={flat}
      onChange={(v) => onChange(v ? [[v[0], v[1]], [v[2], v[3]]] : undefined)}
    />
  )
}

// removes the key so the default applies again, not on switches
export function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={`Reset ${label} to its default`}
      onClick={onClick}
      className="shrink-0 text-[11px] text-fg-subtle opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 hover:text-fg focus-visible:opacity-100"
    >
      Reset
    </button>
  )
}

// a small button beside a value (Rename, Choose file)
export function InlineButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-fg-muted hover:border-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-glacier-light ${className}`}
    />
  )
}
