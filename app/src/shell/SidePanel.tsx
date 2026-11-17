import { useMemo, useState } from 'react'
import { settings } from '@user/settings'
import { iconForSurface, resolveWidget } from '@/core/widgets/registry'
import type { ResolvedWidgetConfig } from '@/core/widget-types'
import type { ShellSide } from '@/core/types'
import { rem } from '@/core/theme/uiVars'
import { WidgetIcon } from './WidgetIcon'
import { WidgetBoundary } from './WidgetBoundary'
import { useSettingsVersion, useStore } from '@/core/store'

// shared so strip arrow and panel header borders align
const HEADER_HEIGHT_PX = 36

// ui.layout.sideRailOpenOnLoad, if it names a widget in the side panel
function openOnLoad(resolved: ResolvedWidgetConfig[]): string | null {
  const id = settings.ui?.layout?.sideRailOpenOnLoad
  if (!id) return null
  if (resolved.some((r) => r.manifest.id === id)) return id
  console.warn(`[conness-gis] ui.layout.sideRailOpenOnLoad: "${id}" isn't placed in the side panel, so the panel starts closed.`)
  return null
}

export function SidePanel({ side = 'left' }: { side?: ShellSide }) {
  const onRight = side === 'right'
  // read while drawing, so the editor's live changes show
  const STRIP_WIDTH_PX = settings.ui?.layout?.sideRailStripWidth ?? 48
  const chevronSize = rem(settings.ui?.layout?.sideRailChevronSize ?? 16)
  const PANEL_WIDTH_PX = settings.ui?.layout?.sideRailPanelWidth ?? 288
  const settingsVersion = useSettingsVersion()
  const resolved = useMemo<ResolvedWidgetConfig[]>(
    () =>
      settings.sidePanelWidgets.map((placement) =>
        resolveWidget(placement, 'side-panel'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsVersion],
  )
  // in the store, so the editor's preview can bring it back after a reload
  const [initial] = useState(() => openOnLoad(resolved))
  const chosen = useStore((s) => s.sideRailWidgetId)
  const activeId = chosen === undefined ? initial : chosen
  const setActiveId = useStore((s) => s.setSideRailWidget)
  const [lastActiveId, setLastActiveId] = useState<string>(
    activeId ?? resolved[0]?.manifest.id ?? '',
  )

  if (resolved.length === 0) return null

  const active = resolved.find((r) => r.manifest.id === activeId) ?? null
  const isExpanded = active !== null

  const toggle = (id: string) => {
    if (activeId === id) {
      setActiveId(null)
    } else {
      setActiveId(id)
      setLastActiveId(id)
    }
  }

  const toggleExpand = () => {
    if (isExpanded) {
      setActiveId(null)
    } else {
      setActiveId(lastActiveId)
    }
  }

  // animate width so the map gets pushed, not overlaid
  const wrapperWidth = active ? PANEL_WIDTH_PX + STRIP_WIDTH_PX : STRIP_WIDTH_PX

  return (
    <div
      className="relative shrink-0 overflow-hidden transition-[width] duration-200"
      style={{ width: wrapperWidth }}
    >
      <aside
        className={
          'absolute top-0 bottom-0 z-10 flex flex-col border-t border-panelBorder bg-panelBg transition-transform duration-200 ' +
          (onRight ? 'right-0 border-l ' : 'left-0 border-r ') +
          (active
            ? 'translate-x-0'
            : (onRight ? 'translate-x-full' : '-translate-x-full') +
              ' pointer-events-none')
        }
        style={{ width: PANEL_WIDTH_PX }}
        aria-hidden={!active}
      >
        {active && (
          <>
            {active.header.showTitle && (
              <div
                className={
                  'flex items-center px-3 ' +
                  (active.header.showDivider ? 'border-b border-panelBorder' : '')
                }
                style={{ height: HEADER_HEIGHT_PX }}
              >
                <h2
                  className="text-title font-semibold"
                  style={{ color: `var(--color-${active.header.titleColor})` }}
                >
                  {active.manifest.label}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <ActiveWidget key={active.manifest.id} config={active} />
            </div>
          </>
        )}
      </aside>

      <aside
        className={
          'absolute top-0 bottom-0 z-20 flex flex-col items-center border-t border-panelBorder bg-panelBg ' +
          (onRight ? 'left-0 border-l' : 'right-0 border-r')
        }
        style={{ width: STRIP_WIDTH_PX }}
      >
        <button
          type="button"
          onClick={toggleExpand}
          aria-label={isExpanded ? 'Collapse side panel' : 'Expand side panel'}
          aria-expanded={isExpanded}
          title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          style={{ height: HEADER_HEIGHT_PX }}
          className="flex w-full shrink-0 items-center justify-center border-b border-panelBorder text-panelWidget hover:bg-text/10 hover:text-strongText"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: chevronSize, height: chevronSize }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d={
                isExpanded === onRight
                  ? 'm9 18 6-6-6-6' // ▶
                  : 'm15 18-6-6 6-6' // ◀
              }
            />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-1 pt-2">
          {resolved.map(({ manifest }) => {
            const isActive = manifest.id === activeId
            return (
              <button
                key={manifest.id}
                type="button"
                onClick={() => toggle(manifest.id)}
                aria-label={`${manifest.label} panel`}
                title={manifest.label}
                aria-pressed={isActive}
                className={
                  'rounded p-1.5 transition-colors ' +
                  (isActive ? 'bg-primary/15' : 'hover:bg-text/10')
                }
              >
                <WidgetIcon
                  src={iconForSurface(manifest, 'side-panel')}
                  color="var(--color-panelWidget)"
                  style={{
                    width: 'var(--side-rail-icon-size)',
                    height: 'var(--side-rail-icon-size)',
                  }}
                />
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

function ActiveWidget({ config }: { config: ResolvedWidgetConfig }) {
  const Component = config.manifest.component
  return (
    <WidgetBoundary id={config.manifest.id}>
      <Component />
    </WidgetBoundary>
  )
}
