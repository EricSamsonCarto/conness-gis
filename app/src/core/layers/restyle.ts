import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LayerConfig } from '../types'
import { addSublayers } from './loaders/sublayers'
import { restyleVectorTileLayer } from './loaders/vectorTiles'
import { layerRecord, registeredLayer } from './registerLayers'
import { configuredOpacity, recordLayer, resolvedState } from './recordLayer'

// the kinds addSublayers draws, which liveAreas.ts sends live changes for
// DuckDB's own tiles reload instead
export function canRestyle(layer: LayerConfig): boolean {
  if (layer.type === 'pmtiles' || layer.type === 'tiles') return layer.raster !== true
  if (layer.type === 'geojson') return !(typeof layer.duckdb === 'object' && layer.duckdb.mvt)
  if (layer.type === 'geoparquet') return !layer.mvt
  if (layer.type === 'flatgeobuf') return true
  return layer.type === 'esri' && layer.service === 'feature' && layer.symbology !== undefined
}

// a new look on the same source, so the data isn't loaded again
// the user's visibility, opacity and filter stay
export function restyleLayer(map: MapLibreMap, layer: LayerConfig): void {
  const entry = registeredLayer(layer.id)
  if (!entry || !canRestyle(layer)) throw new Error(`[conness-gis] "${layer.id}" can't be restyled in place`)
  if ((layer.type === 'pmtiles' || layer.type === 'tiles') && layer.raster !== true) {
    const { plain } = restyleVectorTileLayer(map, layer)
    if (plain) {
      entry.record = plain.record
      entry.sublayerIds.splice(0, entry.sublayerIds.length, ...plain.sublayerIds)
      recordLayer(map, layerRecord(layer, entry), entry)
    }
    return
  }
  if (!('symbology' in layer) || !layer.symbology) throw new Error(`[conness-gis] "${layer.id}" has no style to redraw`)
  const order = (map.getStyle().layers ?? []).map((l) => l.id)
  const own = entry.sublayerIds.filter((id) => map.getLayer(id))
  const last = Math.max(-1, ...own.map((id) => order.indexOf(id)))
  const above = order.slice(last + 1).find((id) => !own.includes(id))
  // an Esri layer's zooms may come from its service, not its config
  const oldMin = own.length > 0 ? map.getLayer(own[0])?.minzoom : undefined
  const oldMax = own.length > 0 ? map.getLayer(own[0])?.maxzoom : undefined
  for (const id of own) map.removeLayer(id)

  const { visible, opacity } = resolvedState({ id: layer.id, visible: layer.visible ?? true, opacity: configuredOpacity(layer) ?? 1 })
  const ids = addSublayers(map, {
    layerId: layer.id,
    sourceId: entry.sourceId,
    symbology: layer.symbology,
    geometryType: layer.geometryType,
    visibility: visible ? 'visible' : 'none',
    opacity,
    minZoom: layer.minZoom ?? (layer.type === 'esri' ? oldMin : undefined),
    maxZoom: layer.maxZoom ?? (layer.type === 'esri' && oldMax !== 24 ? oldMax : undefined),
    label: layer.label,
    ...(above ? { beforeIds: { fill: above, line: above, point: above, label: above } } : {}),
  })
  entry.sublayerIds.splice(0, entry.sublayerIds.length, ...ids)
  recordLayer(map, layerRecord(layer, entry), entry)
}
