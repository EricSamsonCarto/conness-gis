import { useState } from 'react'
import { useStore } from '@/core/store'
import { useMap, useMapReady } from '@/core/hooks'
import { NO_BASEMAP_ID, previousBasemapId, selectBasemap } from '@/core/map/basemapSwitch'
import { Spinner } from '@/ui/Spinner'
import { ToggleSwitch } from '@/ui/ToggleSwitch'
import { setContours, setHillshade } from '@/core/map/elevation'
import { settings } from '@user/settings'
import { widgetSettings } from '@/core/widgetSettings'
import type { BasemapSettings } from './settings'
// found by name, project first, so a build carries only the ones it uses
import { thumbnails } from '@user/basemap-thumbnails'

// the select, switch and spinner logic both layouts below share
function useBasemap() {
  const map = useMap()
  const isMapReady = useMapReady()
  const currentBasemapId = useStore((s) => s.currentBasemapId)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const select = (id: string, style: (typeof settings.basemaps)[number]['style'] | null) => {
    if (!map || !isMapReady || id === currentBasemapId) return
    setPendingId(id)
    return selectBasemap(map, id, style).then(() =>
      setPendingId((current) => (current === id ? null : current)),
    )
  }
  // off goes back to the basemap shown before
  const setNone = (on: boolean) => {
    if (on) return select(NO_BASEMAP_ID, null)
    const back = settings.basemaps.find((b) => b.id === previousBasemapId())
    return back && select(back.id, back.style)
  }

  const config = widgetSettings<BasemapSettings>('basemap')
  const showNone = config?.showNone !== false
  const showHillshade = config?.hillshade?.showToggle !== false
  const showContours = config?.contours?.showToggle !== false
  const hillshadeOn = useStore((s) => s.hillshadeOn)
  const contoursOn = useStore((s) => s.contoursOn)
  const [elevationPending, setElevationPending] = useState<string | null>(null)
  // spinner until the new tiles are in, 10 s at most
  const toggle = (name: string, apply: () => unknown) => {
    if (!map || !isMapReady) return
    setElevationPending(name)
    const done = () => {
      if (!map.areTilesLoaded()) return
      map.off('render', done)
      clearTimeout(cap)
      setElevationPending((p) => (p === name ? null : p))
    }
    const cap = setTimeout(() => {
      map.off('render', done)
      setElevationPending((p) => (p === name ? null : p))
    }, 10_000)
    // contours load their library first, so wait for their layers
    void Promise.resolve(apply()).then(() => {
      map.on('render', done)
      map.triggerRepaint()
    })
  }
  const row = (name: string, label: string, on: boolean, set: (on: boolean) => unknown) => (
    <div className="flex items-center gap-2 px-1.5 py-1 text-medium text-text">
      <span className="flex-1">{label}</span>
      {elevationPending === name && <Spinner size={12} />}
      <ToggleSwitch checked={on} onChange={(next) => toggle(name, () => set(next))} ariaLabel={label} />
    </div>
  )
  const toggleRows = (showNone || showHillshade || showContours) && (
    <div className="flex flex-col gap-1">
      {showNone && row('none', 'No Basemap', currentBasemapId === NO_BASEMAP_ID, setNone)}
      {showHillshade && row('hillshade', 'Hillshade', hillshadeOn, (on) => map && setHillshade(map, on))}
      {showContours && row('contours', 'Contours', contoursOn, (on) => map && setContours(map, on))}
    </div>
  )

  // size classes written out in full so Tailwind keeps them
  const list = (thumb: string, spinnerSize: number) =>
    settings.basemaps.map((basemap) => {
      const active = basemap.id === currentBasemapId
      const pending = basemap.id === pendingId
      const src = thumbnails[basemap.id]
      return (
        <li key={basemap.id}>
          <button
            type="button"
            onClick={() => select(basemap.id, basemap.style)}
            aria-pressed={active}
            aria-busy={pending}
            className={
              'flex w-full items-center gap-3 rounded p-1.5 text-left text-large transition-colors ' +
              (active
                ? 'bg-primary font-medium text-white'
                : 'text-text hover:bg-text/10')
            }
          >
            <span className={`relative shrink-0 ${thumb}`}>
              {src ? (
                <img
                  src={src}
                  alt=""
                  aria-hidden="true"
                  className={
                    `rounded object-cover ${thumb} ` +
                    (active ? 'ring-1 ring-white/50' : 'ring-1 ring-black/10')
                  }
                />
              ) : (
                // keeps the name aligned without an image
                <span className={`block rounded bg-text/10 ${thumb}`} />
              )}
              {pending && (
                <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40">
                  <Spinner size={spinnerSize} />
                </span>
              )}
            </span>
            <span className={`min-w-0 flex-1 truncate ${active ? 'text-white' : 'text-strongText'}`}>{basemap.name}</span>
          </button>
        </li>
      )
    })

  return { toggleRows, list }
}

// on mobile, smaller thumbnails so more rows fit, toggles after the list
export function BasemapWidget({ mobile = false }: { mobile?: boolean }) {
  const { toggleRows, list } = useBasemap()
  if (mobile) {
    return (
      <div className="flex h-full flex-col">
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {list('h-10 w-10', 16)}
          {toggleRows && <li className="border-t border-panelBorder pt-2">{toggleRows}</li>}
        </ul>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col">
      {toggleRows && <div className="border-b border-panelBorder p-2">{toggleRows}</div>}
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">{list('h-20 w-20', 22)}</ul>
    </div>
  )
}
