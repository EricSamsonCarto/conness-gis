import type {
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapMouseEvent,
} from 'maplibre-gl'
import { popupTemplates } from '@user/popups'
import { useStore } from '../store'
import type {
  PopupLayer,
  PopupUiConfig,
  ResolvedPopupConfig,
  SelectedPopupFeature,
} from '../types'
import { resolvePopup } from './resolvePopup'

interface PopupEntry {
  layer: PopupLayer
  resolved: ResolvedPopupConfig
  sublayerIds: string[]
}

// module-scoped, to warn once per column across re-registrations
const warnedColumns = new Set<string>()

const SUBLAYER_SUFFIXES = ['-fill', '-line', '-point'] as const

// the registered entries, for popups opened from code (search results)
let entriesByLayer = new Map<string, PopupEntry>()

function sublayerIdsFor(layerId: string): string[] {
  return SUBLAYER_SUFFIXES.map((s) => `${layerId}${s}`)
}

function featureToGeoJson(f: MapGeoJSONFeature): GeoJSON.Feature {
  return {
    type: 'Feature',
    id: f.id,
    geometry: f.geometry,
    properties: f.properties,
  }
}

function validateColumns(
  layerId: string,
  fields: Record<string, string> | null,
  feature: MapGeoJSONFeature,
): void {
  if (!fields) return
  const props = feature.properties ?? {}
  for (const key of Object.keys(fields)) {
    if (key in props) continue
    const warnKey = `${layerId}::${key}`
    if (warnedColumns.has(warnKey)) continue
    warnedColumns.add(warnKey)
    const available = Object.keys(props).join(', ')
    console.warn(
      `[conness-gis] Popup field "${key}" not found in feature properties ` +
        `of layer "${layerId}". Available columns: ${available || '(none)'}.`,
    )
  }
}

// one handler for all layers, per-layer handlers race on stacked hits
export function registerPopupHandlers(
  map: MapLibreMap,
  layers: PopupLayer[],
  uiPopups: PopupUiConfig | undefined,
): () => void {
  const clickEntries: PopupEntry[] = []
  const hoverEntries: PopupEntry[] = []

  for (const layer of layers) {
    const resolved = resolvePopup(layer, uiPopups)
    if (!resolved) continue

    if (!popupTemplates[resolved.displayType]) {
      const available = Object.keys(popupTemplates).join(', ')
      throw new Error(
        `Layer "${layer.id}": popup displayType "${resolved.displayType}" ` +
          `not found in popups.tsx. Available templates: ${available}.`,
      )
    }

    const entry: PopupEntry = {
      layer,
      resolved,
      sublayerIds: sublayerIdsFor(layer.id),
    }
    if (resolved.trigger === 'click') clickEntries.push(entry)
    else hoverEntries.push(entry)
  }
  const byLayer = new Map([...clickEntries, ...hoverEntries].map((e) => [e.layer.id, e]))
  entriesByLayer = byLayer

  if (clickEntries.length === 0 && hoverEntries.length === 0) {
    return () => {}
  }

  const cleanups: Array<() => void> = []

  // some sources have no ids, fall back to properties
  const featureKey = (layerId: string, f: { id?: unknown; properties: unknown }) =>
    `${layerId}::${f.id !== undefined && f.id !== null ? String(f.id) : JSON.stringify(f.properties)}`

  function toSelected(
    f: MapGeoJSONFeature,
    pool: PopupEntry[],
  ): SelectedPopupFeature | null {
    const entry = pool.find((e) => e.sublayerIds.includes(f.layer.id))
    if (!entry) return null
    validateColumns(entry.layer.id, entry.resolved.fields, f)
    return {
      layerId: entry.layer.id,
      sublayerId: f.layer.id,
      layerName: entry.layer.name,
      feature: featureToGeoJson(f),
      resolved: entry.resolved,
    }
  }

  if (clickEntries.length > 0) {
    const onClick = (e: MapMouseEvent) => {
      // a widget owns map clicks (useMapClickLock)
      if (useStore.getState().mapClickOwners.length > 0) return

      const clickSublayers = clickEntries
        .flatMap((entry) => entry.sublayerIds)
        .filter((id) => map.getLayer(id))
      if (clickSublayers.length === 0) return

      const features = map.queryRenderedFeatures(e.point, {
        layers: clickSublayers,
      })

      if (features.length === 0) {
        if (uiPopups?.closeOnMapClick ?? true) {
          const state = useStore.getState()
          if (state.selectedFeatureTrigger === 'click') state.closePopup()
        }
        return
      }

      // queryRenderedFeatures returns a polygon once per intersecting tile
      const seen = new Set<string>()
      const combined: SelectedPopupFeature[] = []
      for (const f of features) {
        const selected = toSelected(f, clickEntries)
        if (!selected) continue
        const key = featureKey(selected.layerId, f)
        if (seen.has(key)) continue
        seen.add(key)
        combined.push(selected)
      }
      if (combined.length === 0) return
      useStore.getState().setSelectedFeatures(combined, 'click', [e.lngLat.lng, e.lngLat.lat])
    }
    map.on('click', onClick)
    cleanups.push(() => map.off('click', onClick))
  }

  // checked per move, Esri and PMTiles add sublayers later
  const interactiveIds = [...clickEntries, ...hoverEntries].flatMap((entry) => entry.sublayerIds)
  const hoverIds = new Set(hoverEntries.flatMap((entry) => entry.sublayerIds))
  const onMouseMove = (e: MapMouseEvent) => {
    const state = useStore.getState()
    // a widget owns map clicks and sets its own cursor
    if (state.mapClickOwners.length > 0) {
      if (state.selectedFeatureTrigger === 'hover') state.closePopup()
      return
    }

    const layers = interactiveIds.filter((id) => map.getLayer(id))
    if (layers.length === 0) return
    // one query for cursor and hover popup, top-most first
    const hits = map.queryRenderedFeatures(e.point, { layers })
    map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : ''
    if (hoverIds.size === 0) return

    const top = hits.find((f) => hoverIds.has(f.layer.id))
    if (!top) {
      if (state.selectedFeatureTrigger === 'hover') state.closePopup()
      return
    }
    const selected = toSelected(top, hoverEntries)
    if (!selected) return
    // same feature, skip the re-render
    const current = state.selectedFeatures[0]
    if (
      state.selectedFeatureTrigger === 'hover' &&
      current &&
      featureKey(current.layerId, current.feature) === featureKey(selected.layerId, top)
    ) {
      return
    }
    state.setSelectedFeatures([selected], 'hover', [e.lngLat.lng, e.lngLat.lat])
  }
  map.on('mousemove', onMouseMove)
  cleanups.push(() => {
    map.off('mousemove', onMouseMove)
    map.getCanvas().style.cursor = ''
  })

  return () => {
    for (const c of cleanups) c()
    // a newer registration may already have replaced it
    if (entriesByLayer === byLayer) entriesByLayer = new Map()
  }
}

// a feature's popup as a click would open it, false if hidden or none
export function openPopupFor(
  map: MapLibreMap,
  layerId: string,
  feature: GeoJSON.Feature,
  anchor: [number, number],
): boolean {
  const entry = entriesByLayer.get(layerId)
  const type = feature.geometry?.type ?? ''
  const suffix = type.includes('Point') ? '-point' : type.includes('Line') ? '-line' : '-fill'
  const sublayerId = `${layerId}${suffix}`
  if (!entry || !map.getLayer(sublayerId)) return false
  if (map.getLayoutProperty(sublayerId, 'visibility') === 'none') return false
  useStore.getState().setSelectedFeatures(
    [{ layerId, sublayerId, layerName: entry.layer.name, feature, resolved: entry.resolved }],
    'click',
    anchor,
  )
  return true
}
