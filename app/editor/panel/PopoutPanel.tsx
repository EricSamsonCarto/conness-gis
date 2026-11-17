import { useEffect, useLayoutEffect, useRef } from 'react'
import { useEditor, valueAt } from '../edits/editorContext'
import { Block, PanelButton, PanelSection } from './parts'
import { CustomScreen } from './screens'

// 80% of the sidebar each way, so it never covers the preview
export function PopoutPanel() {
  const { panel, backPanel, closePanel, files, resetValue } = useEditor()
  const screen = panel.at(-1)
  // each screen's scroll position, so Back returns to where it was
  const body = useRef<HTMLDivElement>(null)
  const scrolls = useRef(new Map<string, number>())
  const depth = panel.length
  const lastDepth = useRef(depth)
  const screenKey = screen?.panel
  useLayoutEffect(() => {
    const el = body.current
    if (!el || screenKey === undefined) return
    const back = depth < lastDepth.current
    lastDepth.current = depth
    el.scrollTop = back ? (scrolls.current.get(screenKey) ?? 0) : 0
  }, [screenKey, depth])

  useEffect(() => {
    if (!screen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [screen, closePanel])

  if (!screen) return null

  return (
    <>
      <div aria-hidden="true" onClick={closePanel} className="absolute inset-0 z-30 bg-black/50" />
      <div
        role="dialog"
        aria-label={screen.title ?? screen.label}
        className="absolute inset-[10%] z-40 flex flex-col border border-white bg-surface-raised text-fg-muted [color-scheme:dark] shadow-[6px_6px_24px_-8px_rgb(29_43_51/0.55)] motion-safe:animate-[menu-in_120ms_ease-out]"
      >
        <header className="flex items-center gap-1 border-b border-white bg-surface px-2 py-2.5">
          {panel.length > 1 && (
            <button
              type="button"
              aria-label="Back"
              onClick={backPanel}
              className="flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-field hover:text-white focus-visible:outline-2 focus-visible:outline-glacier-light"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M10 3.5 5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h2 className={`min-w-0 flex-1 truncate font-display text-base font-bold text-fg ${panel.length > 1 ? '' : 'pl-2'}`}>
            {screen.title ?? screen.label}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={closePanel}
            className="flex size-7 items-center justify-center rounded-md text-lg leading-none text-fg-subtle hover:bg-field hover:text-white focus-visible:outline-2 focus-visible:outline-glacier-light"
          >
            ×
          </button>
        </header>
        <div
          ref={body}
          onScroll={(e) => screen && scrolls.current.set(screen.panel, e.currentTarget.scrollTop)}
          className="scroll-visible min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto"
        >
          {screen.resetAll && (
            <Block>
              <PanelButton
                kind="secondary"
                disabled={!screen.resetAll.paths.some((p) => valueAt(files, p) !== undefined)}
                onClick={() => screen.resetAll!.paths.forEach(resetValue)}
              >
                {screen.resetAll.label}
              </PanelButton>
            </Block>
          )}
          {screen.screen ? (
            <CustomScreen entry={screen} />
          ) : (
            screen.sections.map((section, i) => <PanelSection key={section.name ?? i} section={section} nested />)
          )}
        </div>
      </div>
    </>
  )
}
