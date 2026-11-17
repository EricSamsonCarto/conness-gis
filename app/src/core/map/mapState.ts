import type { Map as MapLibreMap, TerrainSpecification } from 'maplibre-gl'
import { useStore } from '../store'
import { setLabelVisibility, setLayerOpacity, setLayerVisibility } from '../layers/layerOps'
import { NO_BASEMAP_ID, selectBasemap } from './basemapSwitch'
import { isGlobeActive } from './globe'
import { TERRAIN_SOURCE_ID } from './terrain'
import { setContours, setHillshade } from './elevation'
import { isFilterActive, restorableFilter } from '../filters/compile'
import { updateLayerFilter } from '../filters/apply'
import type { LayerFilterState } from '../types'
import { settings } from '@user/settings'

// later fields are optional, older bookmarks leave those parts alone
export interface MapState {
  center: { lng: number; lat: number }
  zoom: number
  bearing: number
  pitch: number
  roll?: number
  // null if it couldn't be resolved
  basemapId: string | null
  globe?: boolean
  // null = terrain off
  terrain?: TerrainSpecification | null
  hillshade?: boolean
  contours?: boolean
  layers: Record<string, { visible: boolean; opacity: number; labelsVisible?: boolean }>
  // active filters only
  filters?: Record<string, LayerFilterState>
}

export function captureMapState(map: MapLibreMap): MapState {
  const center = map.getCenter()
  const { currentBasemapId, layerMetadata, layerFilters, hillshadeOn, contoursOn } = useStore.getState()

  const layers: MapState['layers'] = {}
  for (const [id, meta] of Object.entries(layerMetadata)) {
    layers[id] = { visible: meta.visible, opacity: meta.opacity, labelsVisible: meta.labelsVisible }
  }
  const filters: Record<string, LayerFilterState> = {}
  for (const [id, filter] of Object.entries(layerFilters)) {
    if (isFilterActive(filter)) filters[id] = filter
  }

  return {
    center: { lng: center.lng, lat: center.lat },
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    roll: map.getRoll(),
    basemapId: currentBasemapId,
    globe: isGlobeActive(map),
    terrain: map.getTerrain(),
    hillshade: hillshadeOn,
    contours: contoursOn,
    layers,
    filters,
  }
}

// a part that can't be restored is skipped with a warning
export async function applyMapState(map: MapLibreMap, state: MapState, label = 'bookmark'): Promise<void> {
  const store = useStore.getState()
  const skip = (what: string, why: string) =>
    console.warn(`[conness-gis] Bookmark "${label}": ${what} couldn't be restored: ${why}.`)

  // store first, so the layer list follows
  for (const [id, saved] of Object.entries(state.layers)) {
    const meta = store.layerMetadata[id]
    if (!meta) {
      skip(`layer "${id}"`, 'the layer no longer exists')
      continue
    }
    const labelsVisible = meta.hasLabel ? (saved.labelsVisible ?? meta.labelsVisible) : undefined
    store.updateLayerMetadata(id, { visible: saved.visible, opacity: saved.opacity, labelsVisible })
    setLayerVisibility(map, id, saved.visible, meta.labelIsGeometry)
    if (meta.hasLabel && !meta.labelIsGeometry) {
      setLabelVisibility(map, id, saved.visible && (labelsVisible ?? false))
    }
    setLayerOpacity(map, id, saved.opacity)
  }

  // older bookmarks without filters leave them alone
  if (state.filters) {
    for (const [id, saved] of Object.entries(state.filters)) {
      const config = store.layerMetadata[id]?.filters ?? []
      if (config.length === 0) {
        skip(`the filter on "${id}"`, 'the layer no longer exists or has no filter columns')
        continue
      }
      const { state: restored, dropped } = restorableFilter(saved, config)
      for (const d of dropped) skip(`the filter on "${id}" column "${d.column}"`, d.why)
      if (restored) updateLayerFilter(id, restored)
      // no columns left, so turn it off rather than leave it as it was
      else if (isFilterActive(store.layerFilters[id])) updateLayerFilter(id, { ...store.layerFilters[id], enabled: false })
    }
    // filters the bookmark lacks come off, so it shows its own view
    for (const [id, current] of Object.entries(store.layerFilters)) {
      if (!state.filters[id] && isFilterActive(current)) updateLayerFilter(id, { ...current, enabled: false })
    }
  }

  let switching: Promise<boolean> | undefined
  if (state.basemapId && state.basemapId !== store.currentBasemapId) {
    const none = state.basemapId === NO_BASEMAP_ID
    const basemap = settings.basemaps.find((b) => b.id === state.basemapId)
    if (none || basemap) {
      switching = selectBasemap(map, state.basemapId, basemap ? basemap.style : null)
    } else {
      skip(`basemap "${state.basemapId}"`, 'it is no longer in settings.basemaps')
    }
  }

  // native globe/terrain buttons follow the map's own events
  if (state.globe !== undefined && state.globe !== isGlobeActive(map)) {
    if (state.globe && !settings.map.globe && !settings.mapControls?.globe) {
      skip('the globe', 'this app has no globe (settings.map.globe or mapControls.globe)')
    } else {
      map.setProjection({ type: state.globe ? 'globe' : 'mercator' })
    }
  }
  if (state.terrain !== undefined) {
    if (state.terrain && !map.getSource(TERRAIN_SOURCE_ID)) {
      skip('terrain', 'this app has no terrain control (mapControls.terrain)')
    } else {
      map.setTerrain(state.terrain)
    }
  }

  if (state.hillshade !== undefined && state.hillshade !== store.hillshadeOn) setHillshade(map, state.hillshade)
  const contours =
    state.contours !== undefined && state.contours !== store.contoursOn ? setContours(map, state.contours) : undefined

  map.flyTo({
    center: [state.center.lng, state.center.lat],
    zoom: state.zoom,
    bearing: state.bearing,
    pitch: state.pitch,
    ...(state.roll !== undefined ? { roll: state.roll } : {}),
  })
  // idle never fires mid-flight, so this waits out the flyTo
  await Promise.all([switching, contours, map.once('idle')])
}
