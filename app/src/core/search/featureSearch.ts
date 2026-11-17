import type { SearchableLayerConfig, LayerConfig } from '../types'
import { resolveLayerUrl } from '../layers/resolveLayerUrl'
import { loadGeoJsonFeatures } from '../layers/geojsonFeatures'
import { currentFilterPredicate } from '../filters/apply'

export interface FeatureSearchResult {
  layerId: string
  layerName: string
  label: string
  lng: number
  lat: number
  // [w, s, e, n], left out for points, which use a fixed zoom
  bbox?: [number, number, number, number]
  feature: GeoJSON.Feature
}

const DEFAULT_RESULTS_PER_LAYER = 8

function geometryBounds(
  geometry: GeoJSON.Geometry | null,
): [number, number, number, number] | null {
  if (!geometry || geometry.type === 'GeometryCollection') return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  // coordinates nest to varying depth, so recurse to a [lng, lat] pair
  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords as [number, number]
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat < south) south = lat
      if (lat > north) north = lat
      return
    }
    for (const c of coords) visit(c)
  }

  visit(geometry.coordinates)
  if (west === Infinity) return null
  return [west, south, east, north]
}

function matchFeature(
  feature: GeoJSON.Feature,
  fields: string[],
  labelField: string,
  query: string,
): string | null {
  const props = feature.properties ?? {}
  const q = query.toLowerCase()
  const hit = fields.some((field) => {
    const value = props[field]
    return value != null && String(value).toLowerCase().includes(q)
  })
  if (!hit) return null
  const label = props[labelField]
  return label != null ? String(label) : query
}

export async function searchLayer(
  config: SearchableLayerConfig,
  layers: LayerConfig[],
  query: string,
): Promise<FeatureSearchResult[]> {
  const layer = layers.find((l) => l.id === config.layerId)
  if (!layer) {
    console.warn(
      `[conness-gis] search: layer "${config.layerId}" not found in settings.layers.`,
    )
    return []
  }
  if (layer.type !== 'geojson') {
    console.warn(
      `[conness-gis] search: layer "${config.layerId}" is ${layer.type}. ` +
        `In-layer feature search supports GeoJSON only (PMTiles can't be searched ` +
        `client-side). Skipping.`,
    )
    return []
  }

  const labelField = config.labelField ?? config.fields[0]
  const limit = config.limit ?? DEFAULT_RESULTS_PER_LAYER
  // querySourceFeatures only sees loaded tiles, so search the whole file
  const features = await loadGeoJsonFeatures(layer.id, resolveLayerUrl(layer.url))
  const passesFilter = currentFilterPredicate(layer.id)

  const results: FeatureSearchResult[] = []
  for (const feature of features) {
    if (passesFilter && !passesFilter(feature.properties)) continue
    const label = matchFeature(feature, config.fields, labelField, query)
    if (label === null) continue
    const bbox = geometryBounds(feature.geometry)
    if (!bbox) continue
    const lng = (bbox[0] + bbox[2]) / 2
    const lat = (bbox[1] + bbox[3]) / 2
    const isPoint = bbox[0] === bbox[2] && bbox[1] === bbox[3]
    results.push({
      layerId: layer.id,
      layerName: layer.name,
      label,
      lng,
      lat,
      bbox: isPoint ? undefined : bbox,
      feature,
    })
    if (results.length >= limit) break
  }
  return results
}

// every property name in the first 200 features, loaded the way search does
export async function layerColumns(layerId: string, layers: LayerConfig[]): Promise<string[]> {
  const layer = layers.find((l) => l.id === layerId)
  if (!layer || layer.type !== 'geojson') throw new Error(`"${layerId}" isn't a GeoJSON layer`)
  const features = await loadGeoJsonFeatures(layer.id, resolveLayerUrl(layer.url))
  const names = new Set<string>()
  for (const feature of features.slice(0, 200)) for (const key of Object.keys(feature.properties ?? {})) names.add(key)
  return [...names].sort((a, b) => a.localeCompare(b))
}
