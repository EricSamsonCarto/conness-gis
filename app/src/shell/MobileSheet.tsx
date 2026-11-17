import { useCallback, useEffect, useRef, useState } from 'react'
import { settings } from '@user/settings'
import { getWidgetManifest, resolveWidget } from '@/core/widgets/registry'
import type { WidgetPlacement, WidgetSurface } from '@/core/widget-types'
import { useStore } from '@/core/store'
import { PopupContent } from './PopupContent'
import { SheetHeader } from './SheetHeader'
import { WidgetBoundary } from './WidgetBoundary'

// read each time (opening, dragging), so the editor's live changes apply
const initialSheetVh = () => settings.ui?.mobile?.initialSheetVh ?? 25
const minSheetVh = () => settings.ui?.mobile?.minSheetVh ?? 12
const maxSheetVh = () => settings.ui?.mobile?.maxSheetVh ?? 65

export function MobileSheet() {
  const features = useStore((s) => s.selectedFeatures)
  const widgetId = useStore((s) => s.mobileSheetWidgetId)

  const showPopup = features.length > 0
  const open = showPopup || widgetId !== null

  const [heightVh, setHeightVh] = useState(initialSheetVh)

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) setHeightVh(initialSheetVh())
    wasOpen.current = open
  }, [open])

  const dragRef = useRef<{ startY: number; startVh: number } | null>(null)

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dyVh = ((e.clientY - drag.startY) / window.innerHeight) * 100
    const next = Math.min(
      maxSheetVh(),
      Math.max(minSheetVh(), drag.startVh - dyVh),
    )
    setHeightVh(next)
  }, [])

  // pointerup is { once: true }, removes itself
  const onPointerUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
  }, [onPointerMove])

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startVh: heightVh }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp, { once: true })
    },
    [heightVh, onPointerMove, onPointerUp],
  )

  // clean up if unmounted mid-drag
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  if (!open) return null

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-xl border-t border-panelBorder bg-panelBg shadow-[0_-2px_12px_rgba(0,0,0,0.12)]"
      style={{ height: `${heightVh}dvh` }}
    >
      {showPopup && <PopupContent onSheetDrag={onHandlePointerDown} />}
      {/* invisible, since display none can reset scroll */}
      {widgetId !== null && (
        <div
          className={
            'flex min-h-0 flex-col ' + (showPopup ? 'invisible absolute inset-0' : 'flex-1')
          }
        >
          <WidgetSheet key={widgetId} widgetId={widgetId} onDragStart={onHandlePointerDown} />
        </div>
      )}
    </div>
  )
}

// the widget's header settings from where it's placed, else the global ones
function placedHeader(id: string) {
  const placed: [WidgetPlacement[], WidgetSurface][] = [
    [settings.topBarWidgets, 'top-bar'],
    [settings.sidePanelWidgets, 'side-panel'],
    [settings.floatingWidgets.flatMap((slot) => slot.widgets), 'floating'],
  ]
  for (const [list, surface] of placed) {
    const placement = list.find((p) => p.widgetName === id)
    if (placement) return resolveWidget(placement, surface).header
  }
  return resolveWidget({ widgetName: id }, getWidgetManifest(id).surfaces[0]).header
}

function WidgetSheet({ widgetId, onDragStart }: { widgetId: string; onDragStart: (e: React.PointerEvent) => void }) {
  const closeSheet = useStore((s) => s.closeMobileSheet)
  const manifest = getWidgetManifest(widgetId)
  const header = placedHeader(widgetId)
  const Component = manifest.mobileComponent ?? manifest.component

  return (
    <>
      <SheetHeader
        title={header.showTitle ? manifest.label : undefined}
        titleClass="text-title font-medium"
        titleStyle={{ color: `var(--color-${header.titleColor})` }}
        divider={header.showDivider}
        onClose={closeSheet}
        closeLabel={`Close ${manifest.label}`}
        onDragStart={onDragStart}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <WidgetBoundary id={manifest.id}>
          <Component />
        </WidgetBoundary>
      </div>
    </>
  )
}
