import { useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { settings } from '@user/settings'
import { iconForSurface, resolveWidget } from '@/core/widgets/registry'
import { useMap } from '@/core/hooks'
import { useSettingsVersion, useStore } from '@/core/store'
import type { FloatingSlot } from '@/core/types'
import type { FloatingOpens, ResolvedWidgetConfig } from '@/core/widget-types'
import { WidgetHeader } from './WidgetHeader'
import { WidgetIcon } from './WidgetIcon'
import { WidgetBoundary } from './WidgetBoundary'

// open toward the opposite edge to stay over the map
const SIDEWAYS_CLASS: Record<FloatingSlot, string> = {
  'top-left': 'top-0 left-full ml-2',
  'top-right': 'top-0 right-full mr-2',
  'bottom-left': 'bottom-0 left-full ml-2',
  'bottom-right': 'bottom-0 right-full mr-2',
}

// up half of h-10 to center the bar on the button, needs a 40px first row
const CHROMELESS_SIDEWAYS_CLASS: Record<FloatingSlot, string> = {
  'top-left': 'top-1/2 -translate-y-5 left-full ml-2',
  'top-right': 'top-1/2 -translate-y-5 right-full mr-2',
  'bottom-left': 'top-1/2 -translate-y-5 left-full ml-2',
  'bottom-right': 'top-1/2 -translate-y-5 right-full mr-2',
}

// below in top corners, above in bottom ones, flush with the outer edge
const VERTICALLY_CLASS: Record<FloatingSlot, string> = {
  'top-left': 'top-full left-0 mt-2',
  'top-right': 'top-full right-0 mt-2',
  'bottom-left': 'bottom-full left-0 mb-2',
  'bottom-right': 'bottom-full right-0 mb-2',
}

function popoutClass(slot: FloatingSlot, opens: FloatingOpens, chromeless: boolean): string {
  if (opens === 'vertically') return VERTICALLY_CLASS[slot]
  return chromeless ? CHROMELESS_SIDEWAYS_CLASS[slot] : SIDEWAYS_CLASS[slot]
}

interface ResolvedSlot {
  slot: FloatingSlot
  horizontal: boolean
  widgets: ResolvedWidgetConfig[]
}

function resolveSlots(): ResolvedSlot[] {
  return settings.floatingWidgets.map((slotConfig) => ({
    slot: slotConfig.slot,
    horizontal: slotConfig.direction === 'horizontal',
    widgets: slotConfig.widgets.map((p) => resolveWidget(p, 'floating')),
  }))
}

function findCornerContainer(
  mapContainer: HTMLElement,
  slot: FloatingSlot,
): HTMLElement | null {
  return mapContainer.querySelector(`.maplibregl-ctrl-${slot}`)
}

export function FloatingSlots() {
  const map = useMap()
  const settingsVersion = useSettingsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slots = useMemo(() => resolveSlots(), [settingsVersion])
  const activeId = useStore((s) => s.activeFloatingWidgetId)
  const setActive = useStore((s) => s.setActiveFloatingWidget)
  if (slots.length === 0) return null
  // corner containers (portal targets) exist once the map is in the store
  if (!map) return null

  const mapContainer = map.getContainer()

  return (
    <>
      {slots.map((slot, i) => {
        const target = findCornerContainer(mapContainer, slot.slot)
        if (!target) return null
        return createPortal(
          <FloatingSlotContent
            slot={slot}
            activeId={activeId}
            onToggle={(id) => setActive(activeId === id ? null : id)}
            onClose={() => setActive(null)}
          />,
          target,
          `${slot.slot}-${i}`,
        )
      })}
    </>
  )
}

interface FloatingSlotContentProps {
  slot: ResolvedSlot
  activeId: string | null
  onToggle: (id: string) => void
  onClose: () => void
}

// vertical stacks a .maplibregl-ctrl per widget like a native control
// horizontal is one control for the row, placed by its lowest order
function FloatingSlotContent({
  slot,
  activeId,
  onToggle,
  onClose,
}: FloatingSlotContentProps) {
  const buttons = slot.widgets.map((resolved) => (
    <FloatingWidgetButton
      key={resolved.manifest.id}
      resolved={resolved}
      slot={slot.slot}
      opens={resolved.opens ?? (slot.horizontal ? 'vertically' : 'sideways')}
      isActive={resolved.manifest.id === activeId}
      onToggle={() => onToggle(resolved.manifest.id)}
      onClose={onClose}
    />
  ))

  if (slot.horizontal && buttons.length > 0) {
    const rowOrder = Math.min(...slot.widgets.map((w) => w.order))
    return (
      <div
        className="maplibregl-ctrl flex gap-2.5"
        // native controls are order 0
        style={rowOrder !== 0 ? { order: rowOrder } : undefined}
      >
        {buttons}
      </div>
    )
  }

  return (
    <>
      {slot.widgets.map((resolved, i) => (
        <div
          key={resolved.manifest.id}
          className="maplibregl-ctrl"
          style={resolved.order !== 0 ? { order: resolved.order } : undefined}
        >
          {buttons[i]}
        </div>
      ))}
    </>
  )
}

interface FloatingWidgetButtonProps {
  resolved: ResolvedWidgetConfig
  slot: FloatingSlot
  opens: FloatingOpens
  isActive: boolean
  onToggle: () => void
  onClose: () => void
}

function FloatingWidgetButton({
  resolved,
  slot,
  opens,
  isActive,
  onToggle,
  onClose,
}: FloatingWidgetButtonProps) {
  const { manifest, hasUI, panelWidth, chromeless, stayOnMobile } = resolved
  const isMobile = useStore((s) => s.isMobile)
  // an element, not a component, so lint sees nothing made in render
  const view = isMobile && manifest.mobileComponent ? <manifest.mobileComponent /> : <manifest.component />
  const openMobileWidget = useStore((s) => s.openMobileWidget)
  const mobileActive = useStore((s) => s.mobileSheetWidgetId) === manifest.id
  const useSheet = isMobile && !stayOnMobile

  const buttonStyle: CSSProperties = hasUI
    ? {
        width: 'var(--floating-control-size)',
        height: 'var(--floating-control-size)',
      }
    : { height: 'var(--floating-control-size)' }

  // action-only, the widget wires its own onClick
  const handleClick = !hasUI
    ? undefined
    : useSheet
      ? () => openMobileWidget(manifest.id)
      : onToggle
  const pressed = hasUI ? (useSheet ? mobileActive : isActive) : undefined

  return (
    // order sorts the button within a horizontal row
    <div
      className="pointer-events-auto relative"
      style={resolved.order !== 0 ? { order: resolved.order } : undefined}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={pressed}
        aria-label={manifest.description ?? manifest.label}
        title={manifest.description ?? manifest.label}
        style={buttonStyle}
        className={
          // floating-widget-btn (index.css) overrides MapLibre's button:hover
          'floating-widget-btn flex items-center justify-center gap-2 rounded px-2 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] transition-colors ' +
          (pressed ? 'ring-1 ring-primary' : '')
        }
      >
        <WidgetIcon
          src={iconForSurface(manifest, 'floating')}
          color="var(--floating-icon-color)"
          className="aspect-square h-[75%]"
        />
        {!hasUI && (
          <span className="text-medium text-text">{manifest.label}</span>
        )}
      </button>

      {hasUI && isActive && !useSheet && chromeless && (
        <div className={'kit-floating-ui absolute z-20 ' + popoutClass(slot, opens, true)}>
          <WidgetBoundary id={manifest.id}>{view}</WidgetBoundary>
        </div>
      )}

      {hasUI && isActive && !useSheet && !chromeless && (
        <div
          className={
            'kit-floating-ui absolute z-20 rounded border border-panelBorder bg-panelBg shadow-lg ' +
            popoutClass(slot, opens, false)
          }
          style={{ width: panelWidth }}
        >
          <WidgetHeader
            label={manifest.label}
            config={resolved.header}
            onClose={onClose}
            closeAriaLabel={`Close ${manifest.label}`}
          />
          <div className="min-h-0">
            <WidgetBoundary id={manifest.id}>{view}</WidgetBoundary>
          </div>
        </div>
      )}
    </div>
  )
}
