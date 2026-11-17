import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as maplibregl from 'maplibre-gl'
import { useMap, useMapReady, useMapClickLock } from '@/core/hooks'
import { TrashIcon } from '@/ui/icons'
import { ActionButton } from '@/ui/ActionButton'
import { useCopyToClipboard } from '@/ui/useCopyToClipboard'

type Source = 'pointer' | 'center'

interface Coords {
  lng: number | null
  lat: number | null
}

function usePointerCoords(enabled: boolean): Coords {
  const map = useMap()
  const isMapReady = useMapReady()
  const [coords, setCoords] = useState<Coords>({ lng: null, lat: null })

  useEffect(() => {
    if (!map || !isMapReady || !enabled) return

    // wrap(): fold world-copy longitudes (e.g. 190) back into ±180
    const onMove = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat.wrap()
      setCoords({ lng, lat })
    }
    const onLeave = () => {
      setCoords({ lng: null, lat: null })
    }

    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
    }
  }, [map, isMapReady, enabled])

  return coords
}

function useCenterCoords(): Coords {
  const map = useMap()
  const isMapReady = useMapReady()
  const [coords, setCoords] = useState<Coords>({ lng: null, lat: null })

  useEffect(() => {
    if (!map || !isMapReady) return
    const update = () => {
      const c = map.getCenter().wrap()
      setCoords({ lng: c.lng, lat: c.lat })
    }
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map, isMapReady])

  return coords
}

function useZoom(): number | null {
  const map = useMap()
  const isMapReady = useMapReady()
  const ready = map && isMapReady ? map : null
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!ready) return () => {}
      ready.on('zoom', onChange)
      return () => {
        ready.off('zoom', onChange)
      }
    },
    [ready],
  )
  return useSyncExternalStore(subscribe, () => (ready ? ready.getZoom() : null))
}

function formatCoord(n: number): string {
  return n.toFixed(4)
}

export function CoordinatesWidget() {
  const map = useMap()
  const isMapReady = useMapReady()
  const [source, setSource] = useState<Source>('pointer')
  const [pinned, setPinned] = useState<Coords | null>(null)
  const { copied, copy } = useCopyToClipboard()
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const pointer = usePointerCoords(source === 'pointer' && pinned === null)
  const center = useCenterCoords()
  const zoom = useZoom()

  // while armed, suppress popups so the pin click doesn't open one
  const armed = source === 'pointer' && pinned === null
  useMapClickLock('coordinates', armed)

  useEffect(() => {
    if (!map || !isMapReady || !armed) return

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat.wrap()
      setPinned({ lng, lat })
    }
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      canvas.style.cursor = ''
    }
  }, [map, isMapReady, armed])

  useEffect(() => {
    if (!map) return
    if (!pinned || pinned.lng === null || pinned.lat === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      // Marker sets its SVG fill once and can't resolve CSS vars
      const primary =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-primary')
          .trim() || '#1e40af'
      markerRef.current = new maplibregl.Marker({ color: primary })
    }
    markerRef.current.setLngLat([pinned.lng, pinned.lat]).addTo(map)
    return () => {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [map, pinned])

  if (zoom === null) {
    return <div className="p-3 text-large text-text">Waiting for map…</div>
  }

  const displayed: Coords =
    source === 'center' ? center : pinned ?? pointer

  const hasCoords = displayed.lng !== null && displayed.lat !== null
  const lngLat = hasCoords
    ? `${formatCoord(displayed.lat as number)}, ${formatCoord(displayed.lng as number)}`
    : '— , —'
  const zoomStr = zoom.toFixed(2)

  const hint =
    source === 'pointer'
      ? pinned
        ? 'Pinned. Clear to track the cursor again.'
        : 'Click the map to pin a point.'
      : null

  return (
    <div className="flex flex-col gap-2 p-3 text-large">
      <label className="flex items-center justify-between gap-2">
        <span className="text-small uppercase tracking-wide text-text">
          Source
        </span>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value as Source)
            // pinning is pointer-only, so drop a stale marker
            setPinned(null)
          }}
          className="rounded border border-panelBorder bg-panelBg px-1.5 py-0.5 text-medium text-text"
        >
          <option value="pointer">By Mouse</option>
          <option value="center">By Map Center</option>
        </select>
      </label>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-small uppercase tracking-wide text-text">
            Lat, Lng
          </div>
          <div className="font-mono text-medium tabular-nums text-text">{lngLat}</div>
        </div>
        <ActionButton
          variant="neutral"
          onClick={() => hasCoords && copy(lngLat, 'lnglat')}
          disabled={!hasCoords}
        >
          {copied === 'lnglat' ? 'Copied' : 'Copy'}
        </ActionButton>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-small uppercase tracking-wide text-text">Zoom</div>
          <div className="font-mono text-medium tabular-nums text-text">{zoomStr}</div>
        </div>
        <ActionButton variant="neutral" onClick={() => copy(zoomStr, 'zoom')}>
          {copied === 'zoom' ? 'Copied' : 'Copy'}
        </ActionButton>
      </div>
      {source === 'pointer' && pinned && (
        // index.css neutralizer lets the danger token win when floating
        <ActionButton variant="danger" onClick={() => setPinned(null)} className="self-start">
          <TrashIcon size={14} />
          Clear Point
        </ActionButton>
      )}
      {hint && <div className="text-small text-text">{hint}</div>}
    </div>
  )
}
