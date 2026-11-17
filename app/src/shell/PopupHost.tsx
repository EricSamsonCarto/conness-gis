import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Resizable, type ResizeCallback, type ResizeStartCallback } from 're-resizable'
import { settings } from '@user/settings'
import { useStore } from '@/core/store'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Geometry, Position } from 'geojson'
import { useMap } from '@/core/hooks'
import { PopupContent } from './PopupContent'

const DEFAULT_HEIGHT_PX = 300
const DEFAULT_MAX_HEIGHT_PX = 500
// the smallest an "auto" popup gets
const AUTO_MIN_HEIGHT_PX = 100
const DEFAULT_WIDTH_PX = 320
const EDGE_GAP_PX = 8
// keeps it a popup, not a panel, a larger configured size raises it
const DEFAULT_MAX_WIDTH_PX = 440

const RESIZE_EDGES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
}
const RESIZE_CURSORS = {
  top: { cursor: 'ns-resize' },
  bottom: { cursor: 'ns-resize' },
  left: { cursor: 'ew-resize' },
  right: { cursor: 'ew-resize' },
  topLeft: { cursor: 'nwse-resize' },
  bottomRight: { cursor: 'nwse-resize' },
  topRight: { cursor: 'nesw-resize' },
  bottomLeft: { cursor: 'nesw-resize' },
}

const ARROW_PX = 10

// a point, the nearest spot on a line, else the click inside a polygon
// planar lng and lat is close enough at click distances
function featureAnchor(geometry: Geometry, click: [number, number]): [number, number] {
  const d2 = (a: Position, b: Position) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
  const nearest = (candidates: Position[]): [number, number] => {
    const best = candidates.reduce((a, b) => (d2(b, click) < d2(a, click) ? b : a), candidates[0] ?? click)
    return [best[0], best[1]]
  }
  const onSegment = (a: Position, b: Position): Position => {
    const len = d2(a, b)
    if (len === 0) return a
    const t = Math.max(0, Math.min(1, ((click[0] - a[0]) * (b[0] - a[0]) + (click[1] - a[1]) * (b[1] - a[1])) / len))
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  }
  const onLine = (line: Position[]) => line.slice(1).map((b, i) => onSegment(line[i], b))
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates[0], geometry.coordinates[1]]
    case 'MultiPoint':
      return nearest(geometry.coordinates)
    case 'LineString':
      return nearest(onLine(geometry.coordinates))
    case 'MultiLineString':
      return nearest(geometry.coordinates.flatMap(onLine))
    default:
      return click
  }
}

// above the spot it opened from, below if there's no room, inside the map
// the arrow faces the spot, kept off the rounded corners
function nextToFeature(
  map: MapLibreMap,
  anchor: [number, number],
  measured: { width: number; height: number } | null,
  size: { width: number | string; height: number | string },
): { style: CSSProperties; arrow: { left: number; top: number; edge: 'top' | 'bottom' } } {
  const area = map.getContainer()
  const point = map.project(anchor)
  const width = measured?.width ?? (typeof size.width === 'number' ? size.width : DEFAULT_WIDTH_PX)
  const height = measured?.height ?? (typeof size.height === 'number' ? size.height : DEFAULT_HEIGHT_PX)
  const gap = 12
  const above = point.y - height - gap
  const top = above >= EDGE_GAP_PX ? above : point.y + gap
  const clamp = (n: number, max: number) => Math.max(EDGE_GAP_PX, Math.min(n, max - EDGE_GAP_PX))
  const left = clamp(point.x - width / 2, area.clientWidth - width)
  const y = clamp(top, area.clientHeight - height)
  const edge = y + height <= point.y ? 'bottom' : 'top'
  const x = Math.max(left + 12, Math.min(point.x, left + width - 12))
  return {
    style: { left: `${left}px`, top: `${y}px` },
    arrow: { left: x - ARROW_PX / 2, top: (edge === 'bottom' ? y + height : y) - ARROW_PX / 2, edge },
  }
}

export function PopupHost() {
  const features = useStore((s) => s.selectedFeatures)
  const featureIndex = useStore((s) => s.selectedFeatureIndex)
  const anchor = useStore((s) => s.popupAnchor)
  const popupPosition = useStore((s) => s.popupPosition)
  const setPopupPosition = useStore((s) => s.setPopupPosition)
  const popupSize = useStore((s) => s.popupSize)
  const setPopupSize = useStore((s) => s.setPopupSize)
  const trigger = useStore((s) => s.selectedFeatureTrigger)

  const resizableRef = useRef<Resizable>(null)
  // offset for grab time, popup follows without jump
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null,
  )

  const draggable = settings.ui?.popups?.draggable ?? true
  const resizable = settings.ui?.popups?.resizable ?? false

  const map = useMap()
  const mode = features[featureIndex]?.resolved.position ?? 'bottom-left'
  const geometry = features[featureIndex]?.feature.geometry
  const at = anchor && geometry ? featureAnchor(geometry, anchor) : anchor
  // a fresh array every render, the string re-measures only on a move
  const atKey = at ? at.join(',') : null
  const followsFeature = mode === 'feature' && at !== null && popupPosition === null
  // it moves with the map, its rendered size keeps it inside
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    if (!map || !followsFeature) return
    const onMove = () => {
      const el = resizableRef.current?.resizable
      setMeasured(el ? { width: el.offsetWidth, height: el.offsetHeight } : null)
    }
    const frame = requestAnimationFrame(onMove)
    map.on('move', onMove)
    return () => {
      cancelAnimationFrame(frame)
      map.off('move', onMove)
    }
  }, [map, followsFeature, atKey, featureIndex])

  useEffect(() => {
    if (!map) return
    const onResize = () => {
      const pos = useStore.getState().popupPosition
      if (!pos) return
      const el = resizableRef.current?.resizable
      const width = el?.offsetWidth ?? settings.ui?.popups?.width ?? DEFAULT_WIDTH_PX
      const height = el?.offsetHeight ?? DEFAULT_HEIGHT_PX
      const area = map.getContainer()
      const x = Math.max(EDGE_GAP_PX, Math.min(pos.x, area.clientWidth - width - EDGE_GAP_PX))
      const y = Math.max(EDGE_GAP_PX, Math.min(pos.y, area.clientHeight - height - EDGE_GAP_PX))
      if (x !== pos.x || y !== pos.y) setPopupPosition({ x, y })
    }
    map.on('resize', onResize)
    return () => {
      map.off('resize', onResize)
    }
  }, [map, setPopupPosition])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      const el = resizableRef.current?.resizable
      if (!drag || !el) return
      const parent = el.offsetParent as HTMLElement | null
      if (!parent) return
      const parentRect = parent.getBoundingClientRect()

      let x = e.clientX - parentRect.left - drag.offsetX
      let y = e.clientY - parentRect.top - drag.offsetY
      const maxX = parentRect.width - el.offsetWidth - EDGE_GAP_PX
      const maxY = parentRect.height - el.offsetHeight - EDGE_GAP_PX
      x = Math.max(EDGE_GAP_PX, Math.min(maxX, x))
      y = Math.max(EDGE_GAP_PX, Math.min(maxY, y))
      setPopupPosition({ x, y })
    },
    [setPopupPosition],
  )

  // pointerup is { once: true }, removes itself
  const onPointerUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
  }, [onPointerMove])

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!draggable) return
      const el = resizableRef.current?.resizable
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragRef.current = {
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp, { once: true })
    },
    [draggable, onPointerMove, onPointerUp],
  )

  // clean up if unmounted mid-drag (e.g. Escape)
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  // pin top-left, else a bottom-edge drag grows the popup upward
  // taking the size lifts an `auto` height's maxHeight cap during the drag
  const onResizeStart: ResizeStartCallback = (_e, _dir, el) => {
    resizeStartRef.current = {
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    }
    setPopupPosition({ x: el.offsetLeft, y: el.offsetTop })
    setPopupSize({ width: el.offsetWidth, height: el.offsetHeight })
  }

  // top/left edges move the corner by the delta
  const onResize: ResizeCallback = (_e, dir, _el, delta) => {
    const start = resizeStartRef.current
    if (!start) return
    const d = dir.toLowerCase()
    setPopupPosition({
      x: d.includes('left') ? start.x - delta.width : start.x,
      y: d.includes('top') ? start.y - delta.height : start.y,
    })
  }

  const onResizeStop: ResizeCallback = (e, dir, el, delta) => {
    onResize(e, dir, el, delta)
    const start = resizeStartRef.current
    if (start) {
      setPopupSize({ width: start.width + delta.width, height: start.height + delta.height })
    }
    resizeStartRef.current = null
  }

  if (features.length === 0) return null

  const heightSetting = settings.ui?.popups?.height ?? DEFAULT_HEIGHT_PX
  const maxHeightSetting = settings.ui?.popups?.maxHeight ?? DEFAULT_MAX_HEIGHT_PX
  const widthSetting = settings.ui?.popups?.width ?? DEFAULT_WIDTH_PX
  const userSize = resizable ? popupSize : null
  const size = userSize ?? { width: widthSetting, height: heightSetting }
  const minHeight = heightSetting === 'auto' ? AUTO_MIN_HEIGHT_PX : heightSetting

  // where it was dropped, else ui.popups.position, a layer's own wins
  let positionStyle: CSSProperties
  let arrow: ReturnType<typeof nextToFeature>['arrow'] | null = null
  if (popupPosition !== null) {
    positionStyle = { left: `${popupPosition.x}px`, top: `${popupPosition.y}px` }
  } else if (followsFeature && map) {
    ;({ style: positionStyle, arrow } = nextToFeature(map, at, measured, size))
  } else {
    const [v, h] = mode === 'feature' ? ['bottom', 'left'] : mode.split('-')
    positionStyle = { [h]: `${EDGE_GAP_PX}px`, [v]: `${EDGE_GAP_PX}px` } as CSSProperties
  }

  // the arrow takes the color of the popup edge it sits on
  const resolved = features[featureIndex]?.resolved
  const hasFooter =
    (trigger === 'click' && features.length > 1) ||
    resolved?.zoomToFeature ||
    resolved?.copyCoordinates ||
    resolved?.viewInGoogleMaps
  const arrowFill = arrow?.edge === 'top' ? 'bg-popupHeaderBg' : hasFooter ? 'bg-surface' : 'bg-panelBg'

  return (
    <>
      {/* under the popup so only half shows, gone once dragged or resized */}
      {arrow && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-[29] rotate-45 border border-panelBorder ${arrowFill}`}
          style={{ left: arrow.left, top: arrow.top, width: ARROW_PX, height: ARROW_PX }}
        />
      )}
      <Resizable
        ref={resizableRef}
        size={size}
        maxHeight={userSize || heightSetting === 'auto' ? Math.max(maxHeightSetting, minHeight) : undefined}
        maxWidth={resizable ? Math.max(settings.ui?.popups?.maxWidth ?? DEFAULT_MAX_WIDTH_PX, widthSetting) : undefined}
        minWidth={resizable ? widthSetting : undefined}
        minHeight={resizable ? minHeight : undefined}
        enable={resizable ? RESIZE_EDGES : false}
        handleStyles={RESIZE_CURSORS}
        bounds="parent"
        boundsByDirection
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        className="pointer-events-auto z-30 flex flex-col overflow-hidden rounded-md border border-panelBorder bg-panelBg shadow-lg"
        style={{ position: 'absolute', ...positionStyle }}
      >
        <PopupContent onHeaderPointerDown={draggable ? onHeaderPointerDown : undefined} />
      </Resizable>
    </>
  )
}
