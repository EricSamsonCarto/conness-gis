import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { html, title } from '@user/info'
import { settings } from '@user/settings'
import { isInfoDismissed, setInfoDismissed } from '@/core/infoDismiss'
import { rem } from '@/core/theme/uiVars'

// theme colors for prose, the plugin's grays fail on dark panels
const text = 'var(--color-text)'
const border = 'var(--color-panelBorder)'
const PROSE_COLORS = Object.fromEntries(
  Object.entries({
    body: text, headings: text, lead: text, bold: text, counters: text, bullets: text,
    quotes: text, captions: text, kbd: text, code: text, links: 'var(--color-primary)',
    hr: border, 'quote-borders': border, 'th-borders': border, 'td-borders': border,
  }).map(([k, v]) => [`--tw-prose-${k}`, v]),
) as CSSProperties

interface InfoModalProps {
  open: boolean
  onClose: () => void
  showDismiss?: boolean
}

export function InfoModal({ open, onClose, showDismiss = false }: InfoModalProps) {
  // body mounts per open, so its state re-seeds each time
  if (!open) return null
  return <InfoModalBody onClose={onClose} showDismiss={showDismiss} />
}

function InfoModalBody({ onClose, showDismiss }: Omit<InfoModalProps, 'open'>) {
  const [dismissed, setDismissed] = useState(() => isInfoDismissed())

  const watermark = settings.ui?.info?.watermark !== false
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  const toggleDismiss = (next: boolean) => {
    setDismissed(next)
    setInfoDismissed(next)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // images in the text can still change its size
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (articleRef.current) observer.observe(articleRef.current)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About this app"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-lg border border-panelBorder bg-panelBg shadow-2xl"
        style={{ maxWidth: rem(settings.ui?.info?.width ?? 672), maxHeight: `${settings.ui?.info?.maxHeight ?? 80}dvh` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-panelBorder px-6 py-3 text-large">
          {title && <h1 className="m-0 min-w-0 flex-1 text-[1.5em] font-bold text-text">{title}</h1>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-text hover:bg-text/10 hover:text-strongText"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="kit-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <article
              ref={articleRef}
              className="prose max-w-none text-large! prose-headings:mt-0 prose-h1:border-b prose-h1:border-panelBorder prose-h1:pb-3 prose-h1:text-[1.5em] prose-h2:text-[1.25em]"
              style={PROSE_COLORS}
              // the project's own info.md, rendered at build with raw html escaped
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
          {/* more text below, phones hide scrollbars until scrolled */}
          {moreBelow && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-panelBg to-transparent" />
          )}
        </div>
        {(showDismiss || watermark) && (
          <div className="flex shrink-0 items-center gap-4 border-t border-panelBorder px-6 py-3">
            {showDismiss && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-large leading-none text-text">
                <input
                  type="checkbox"
                  checked={dismissed}
                  onChange={(e) => toggleDismiss(e.target.checked)}
                  className="m-0 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                />
                Don&apos;t show this again
              </label>
            )}
            {/* ml-auto keeps it right when the checkbox is off */}
            {watermark && (
              <a
                href="https://conness-gis.com"
                target="_blank"
                rel="noopener"
                className="ml-auto text-small text-text hover:text-strongText"
              >
                Made with Conness GIS
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
