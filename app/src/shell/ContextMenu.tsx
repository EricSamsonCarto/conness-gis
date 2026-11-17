import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { MapMouseEvent } from 'maplibre-gl'
import { settings } from '@user/settings'
import { useMap } from '@/core/hooks'
import {
  buildContextMenuItems,
  type ContextMenuItem,
} from '@/core/contextMenu/actions'

interface OpenState {
  // menu top-left, px within the map area
  x: number
  y: number
  items: ContextMenuItem[]
  lng: number
  lat: number
}

export function ContextMenu() {
  const map = useMap()
  const [open, setOpen] = useState<OpenState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const config = settings.contextMenu

  useEffect(() => {
    if (!map || !config || config.enabled === false) return

    const onContextMenu = (e: MapMouseEvent) => {
      // links wrap lng, centerHere keeps it raw to stay on this world copy
      const wrapped = e.lngLat.wrap()
      const loc = { lng: wrapped.lng, lat: wrapped.lat, zoom: map.getZoom() }
      const items = buildContextMenuItems(config, loc)
      if (items.length === 0) return
      setOpen({ x: e.point.x, y: e.point.y, items, lng: e.lngLat.lng, lat: e.lngLat.lat })
    }
    // pixel anchor would drift on camera move
    const onMoveStart = () => setOpen(null)

    map.on('contextmenu', onContextMenu)
    map.on('movestart', onMoveStart)

    return () => {
      map.off('contextmenu', onContextMenu)
      map.off('movestart', onMoveStart)
    }
  }, [map, config])

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(null)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    // capture, so it runs before MapLibre's pointer handling
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  const handleItem = (item: ContextMenuItem) => {
    if (item.action === 'center') {
      map?.flyTo({ center: [open.lng, open.lat] })
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    }
    setOpen(null)
  }

  // open toward map center so edge clicks don't clip the menu
  const container = map?.getContainer()
  const flipX = container ? open.x > container.clientWidth / 2 : false
  const flipY = container ? open.y > container.clientHeight / 2 : false
  const style: CSSProperties = {
    left: `${open.x}px`,
    top: `${open.y}px`,
    transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
  }

  return (
    <div
      ref={menuRef}
      className="pointer-events-auto absolute z-40 min-w-44 overflow-hidden rounded-md border border-panelBorder bg-panelBg py-1 shadow-lg"
      style={style}
      role="menu"
    >
      {open.items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          role="menuitem"
          onClick={() => handleItem(item)}
          className="block w-full cursor-[var(--widget-button-cursor)] px-3 py-1.5 text-left text-large text-text hover:bg-text/10"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
