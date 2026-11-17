import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { controlFor, schemaInfo } from './schemaInfo'
import { livePath } from '../preview/liveAreas'
import { formatValue, useEditor } from '../edits/editorContext'

const WIDTH = 240

// on click, not hover, so it stays put while being read
// `text` replaces the schema's description
export function InfoLabel({
  path,
  label,
  show = true,
  id,
  text,
}: {
  path: string
  label: string
  show?: boolean
  id?: string
  text?: string
}) {
  const { files } = useEditor()
  const found = schemaInfo(path, files)
  // a text field's default is what an empty field means
  const textField = controlFor(path, files).kind === 'text'
  const info = text ? { ...found, description: text } : found
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const tipId = `about-${useId()}`

  useLayoutEffect(() => {
    const el = tip.current
    if (!anchor || !el) return
    const below = window.innerHeight - anchor.bottom
    const up = el.offsetHeight + 12 > below && anchor.top > below
    el.style.top = up ? `${anchor.top - el.offsetHeight - 6}px` : `${anchor.bottom + 6}px`
    el.style.left = `${Math.max(8, Math.min(anchor.left - 12, window.innerWidth - WIDTH - 8))}px`
    el.style.visibility = 'visible'
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    const close = (e: Event) => {
      const target = e.target as Node
      if (tip.current?.contains(target) || button.current?.contains(target)) return
      setAnchor(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAnchor(null)
    const onScroll = (e: Event) => !tip.current?.contains(e.target as Node) && setAnchor(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor])

  if (!show || !info.description) {
    return (
      <span id={id} className="min-w-0 truncate">
        {label}
      </span>
    )
  }
  const def =
    info.default !== undefined ? formatValue(info.default) : info.defaultText ? info.defaultText.replace(/`/g, '') : null

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        data-keep-panel
        aria-expanded={anchor !== null}
        aria-describedby={anchor ? tipId : undefined}
        onClick={() => setAnchor(anchor ? null : button.current!.getBoundingClientRect())}
        className="min-w-0 cursor-help truncate text-left underline decoration-fg-faint decoration-dotted underline-offset-4 hover:decoration-fg-subtle focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-glacier-light aria-expanded:text-larch aria-expanded:decoration-larch"
      >
        {label}
      </button>
      {anchor &&
        createPortal(
          <div
            ref={tip}
            id={tipId}
            role="tooltip"
            style={{ width: WIDTH, visibility: 'hidden' }}
            className="fixed z-50 rounded-lg border border-white/25 bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-fg-muted shadow-[0_2px_6px_rgb(0_0_0/0.35),0_18px_44px_-6px_rgb(0_0_0/0.7)]"
          >
            <p className="font-semibold text-white">{label}</p>
            <p className="mt-1">{info.description.replace(/`/g, '')}</p>
            {def !== null && (
              <p className="mt-1.5 text-fg-subtle">{textField ? `Leave empty to use the default: ${def}` : `Default: ${def}`}</p>
            )}
            {!livePath(path) && <p className="mt-1.5 text-fg-subtle">Shows in the preview after Refresh Settings.</p>}
            {info.see && (
              <a href={info.see} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-glacier-light hover:underline">
                Docs
              </a>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
