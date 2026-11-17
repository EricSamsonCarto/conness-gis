import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { MapOptions } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { settings } from '@user/settings'
import { useSettingsVersion, useStore } from '@/core/store'
import { useMap, useMapReady } from '@/core/hooks'
import { pmtilesProtocol } from '@/core/layers/pmtilesProtocol'
import { duckdbTileProtocol } from '@/core/duckdb/tileProtocol'
import { getDuckDB, usesDuckDB } from '@/core/duckdb/engine'
import { registerLayers } from '@/core/layers/registerLayers'
import { registerPopupHandlers } from '@/core/popups/popupHandlers'
import { registerHighlight } from '@/core/popups/highlight'
import { applyGlobe, startGlobeSpin } from '@/core/map/globe'
import { applyElevation } from '@/core/map/elevation'
import { startGlobeAtmosphere } from '@/core/map/globeAtmosphere'
import { applyTerrain } from '@/core/map/terrain'
import { mapBackgroundColor, selectBasemap, withoutBasemapProjection } from '@/core/map/basemapSwitch'
import { recordBootBasemap } from '@/core/map/basemapLayers'
import { registerMapControls, replaceMapControls } from './mapControls'
import { connectPreview, keepPreviewState, restorePreviewCamera, restorePreviewState, trackPreviewCamera } from '@/core/preview/previewCamera'

// bundlers can't resolve MapLibre 6's worker from import.meta.url
maplibregl.setWorkerUrl(workerUrl)
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile)
maplibregl.addProtocol('duckdb', duckdbTileProtocol)
// starts the large WASM download with the map, not at the first layer
if (settings.layers.some(usesDuckDB)) getDuckDB().catch(() => {})

// MapLibre's 0–22 lets users zoom out to a speck
const DEFAULT_MIN_ZOOM = 1.5
const DEFAULT_MAX_ZOOM = 16

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const starsCanvasRef = useRef<HTMLCanvasElement>(null)
  const cometsCanvasRef = useRef<HTMLCanvasElement>(null)
  const haloCanvasRef = useRef<HTMLCanvasElement>(null)
  const setMap = useStore((s) => s.setMap)
  const setMapReady = useStore((s) => s.setMapReady)
  const map = useMap()
  const isMapReady = useMapReady()
  // shared so the CSS fallback and canvas fill can't disagree
  const backgroundColor = mapBackgroundColor()

  useEffect(() => {
    if (!containerRef.current) return

    const { style, center, zoom, bearing, pitch, minZoom, maxZoom, maxBounds, scrollZoom } =
      settings.map
    // style goes through setStyle below, the only path that can filter it
    const options: MapOptions = {
      container: containerRef.current,
      center,
      zoom,
      // shell/mapControls.ts adds it, so it can be placed and ordered
      attributionControl: false,
    }
    if (bearing !== undefined) options.bearing = bearing
    if (pitch !== undefined) options.pitch = pitch
    options.minZoom = minZoom ?? DEFAULT_MIN_ZOOM
    options.maxZoom = maxZoom ?? DEFAULT_MAX_ZOOM
    if (maxBounds !== undefined) options.maxBounds = maxBounds
    options.scrollZoom = scrollZoom ?? true
    restorePreviewCamera(options)

    const map = new maplibregl.Map(options)
    trackPreviewCamera(map)
    const disconnectPreview = connectPreview(map)
    const forgetPreviewState = keepPreviewState(map)
    map.setStyle(style, withoutBasemapProjection)

    registerMapControls(map, settings.mapControls)

    setMap(map)
    map.on('load', () => {
      // before data layers register, so only the basemap is recorded
      recordBootBasemap(map)
      setMapReady(true)
    })

    return () => {
      disconnectPreview()
      forgetPreviewState()
      setMapReady(false)
      setMap(null)
      map.remove()
    }
  }, [setMap, setMapReady])

  useEffect(() => {
    if (!map || !isMapReady) return

    let cleanupPopups: (() => void) | null = null
    let registeredLayers: { teardown?: () => void }[] = []

    // loaders may swap a layer for its source layers (PMTiles), even late
    const registerPopups = () => {
      cleanupPopups?.()
      const overrides = useStore.getState().popupLayerOverrides
      const popupLayers = settings.layers.flatMap((l) => overrides[l.id] ?? [l])
      try {
        cleanupPopups = registerPopupHandlers(map, popupLayers, settings.ui?.popups)
      } catch (err) {
        cleanupPopups = null
        console.error('[conness-gis] Failed to register popups:', err)
      }
    }

    try {
      registeredLayers = registerLayers(map, settings.layers)
      registerPopups()
      void restorePreviewState(map)
    } catch (err) {
      console.error('[conness-gis] Failed to register layers:', err)
    }
    // also after live changes, which may change ui.popups or a layer's popup
    const unsubscribeOverrides = useStore.subscribe((state, prev) => {
      if (state.popupLayerOverrides !== prev.popupLayerOverrides || state.settingsVersion !== prev.settingsVersion) registerPopups()
    })
    const cleanupHighlight = registerHighlight(map)
    // the editor's live changes to the map controls and the open basemap's style
    let controls = JSON.stringify(settings.mapControls ?? null)
    let basemaps = settings.basemaps
    const unsubscribeLive = useStore.subscribe((state, prev) => {
      if (state.settingsVersion === prev.settingsVersion) return
      // the camera's limits, as at load
      map.setMinZoom(settings.map.minZoom ?? DEFAULT_MIN_ZOOM)
      map.setMaxZoom(settings.map.maxZoom ?? DEFAULT_MAX_ZOOM)
      map.setMaxBounds(settings.map.maxBounds ?? null)
      const nextControls = JSON.stringify(settings.mapControls ?? null)
      if (nextControls !== controls) replaceMapControls(map, settings.mapControls)
      controls = nextControls
      const id = state.currentBasemapId
      const was = basemaps.find((b) => b.id === id)
      const now = settings.basemaps.find((b) => b.id === id)
      if (id && was && now && JSON.stringify(was.style) !== JSON.stringify(now.style)) void selectBasemap(map, id, now.style)
      // commercialUse drops restricted basemaps, so leave one that's gone
      const first = settings.basemaps[0]
      if (was && !now && first) void selectBasemap(map, first.id, first.style)
      basemaps = settings.basemaps
    })
    return () => {
      unsubscribeOverrides()
      unsubscribeLive()
      cleanupHighlight()
      cleanupPopups?.()
      for (const entry of registeredLayers) entry.teardown?.()
    }
  }, [map, isMapReady])

  // the editor's live changes to map.globe run these again
  useSettingsVersion()
  const globeKey = JSON.stringify(settings.map.globe ?? null)

  useEffect(() => {
    if (!map || !isMapReady) return
    const globe = settings.map.globe
    if (!globe) return
    applyGlobe(map, globe)
    const stopSpin = startGlobeSpin(map, globe)
    return () => {
      stopSpin()
      // a globe the settings forced goes with them (the map may be gone already)
      try {
        if (globe.enabled) map.setProjection({ type: 'mercator' })
      } catch {
        // removed map
      }
    }
  }, [map, isMapReady, globeKey])

  useEffect(() => {
    if (!map || !isMapReady) return
    const globe = settings.map.globe
    if (!globe) return
    if (!starsCanvasRef.current || !cometsCanvasRef.current || !haloCanvasRef.current) return

    return startGlobeAtmosphere(
      map,
      {
        stars: starsCanvasRef.current,
        comets: cometsCanvasRef.current,
        halo: haloCanvasRef.current,
      },
      globe,
      backgroundColor,
    )
  }, [map, isMapReady, backgroundColor, globeKey])

  // hillshade and contours on at load if set, rebuilt on live changes
  useEffect(() => {
    if (!map || !isMapReady) return
    applyElevation(map, true)
    return useStore.subscribe((state, prev) => {
      if (state.settingsVersion !== prev.settingsVersion) applyElevation(map, false)
    })
  }, [map, isMapReady])

  useEffect(() => {
    if (!map || !isMapReady) return
    applyTerrain(map, settings.mapControls?.terrain, true)
    return useStore.subscribe((state, prev) => {
      if (state.settingsVersion !== prev.settingsVersion) applyTerrain(map, settings.mapControls?.terrain, false)
    })
  }, [map, isMapReady])

  return (
    // shows through canvas gaps instead of the browser's white
    <div className="relative h-full w-full" style={{ backgroundColor }}>
      <canvas ref={starsCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={cometsCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={haloCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* not absolute, maplibre-gl.css forces relative after init */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
