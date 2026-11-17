import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LayerConfig } from '../types'
import { useStore } from '../store'
import { addGeoJsonLayer, type RegisteredLayer } from './loaders/geojson'
import { addPMTilesLayer } from './loaders/pmtiles'
import { addTilesLayer } from './loaders/tiles'
import { addFlatGeobufLayer } from './loaders/flatgeobuf'
import { addEsriLayer, isEsriRaster } from './loaders/esri'
import { addGeoParquetLayer } from './loaders/geoparquet'
import { resolveSymbology } from './symbology'
import { configuredOpacity, recordLayer, type LayerRecord } from './recordLayer'
import { configError } from '../configError'

// the latest registration of each layer, for the editor's live changes
const registry = new Map<string, RegisteredLayer>()
export const registeredLayer = (id: string): RegisteredLayer | undefined => registry.get(id)

// every style layer a registered layer draws, in stack order
export function styleLayersOf(map: MapLibreMap, id: string): string[] {
  const entry = registry.get(id)
  if (!entry) return []
  const children = useStore.getState().layerMetadata[id]?.childIds ?? []
  const ids = new Set([
    ...entry.sublayerIds,
    ...children.flatMap((child) => ['-fill', '-line', '-point', '-label'].map((s) => `${child}${s}`)),
  ])
  const order = (map.getStyle().layers ?? []).map((l) => l.id)
  return [...ids].filter((l) => map.getLayer(l)).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// a layer off the map and out of the store, records and all
export function unregisterLayer(map: MapLibreMap, id: string): void {
  const entry = registry.get(id)
  if (!entry) return
  const drawn = styleLayersOf(map, id)
  const children = useStore.getState().layerMetadata[id]?.childIds ?? []
  entry.teardown?.()
  for (const l of drawn) if (map.getLayer(l)) map.removeLayer(l)
  if (map.getSource(entry.sourceId)) map.removeSource(entry.sourceId)
  const store = useStore.getState()
  for (const child of children) store.removeLayerMetadata(child)
  store.removeLayerMetadata(id)
  registry.delete(id)
}

// the data layers in settings order, kept under drawings and highlights
export function restackLayers(map: MapLibreMap, layers: LayerConfig[]): void {
  const bottomUp = [...layers.filter(isRasterLayer)].reverse().concat([...layers.filter((l) => !isRasterLayer(l))].reverse())
  const groups = bottomUp.map((l) => styleLayersOf(map, l.id))
  const data = new Set(groups.flat())
  const order = (map.getStyle().layers ?? []).map((l) => l.id)
  const top = Math.max(-1, ...[...data].map((l) => order.indexOf(l)))
  const above = order.slice(top + 1).find((l) => !data.has(l))
  for (const group of groups) for (const l of group) map.moveLayer(l, above)
}

const isRasterLayer = (layer: LayerConfig): boolean =>
  (layer.type === 'esri' && isEsriRaster(layer)) ||
  ((layer.type === 'pmtiles' || layer.type === 'tiles') && layer.raster === true)

// what the layer list and legend keep about a layer
export function layerRecord(layer: LayerConfig, entry: RegisteredLayer): LayerRecord {
  return {
    id: layer.id,
    name: layer.name,
    group: layer.group,
    visible: layer.visible ?? true,
    opacity: configuredOpacity(layer) ?? 1,
    symbology: 'symbology' in layer ? layer.symbology : undefined,
    geometryType: 'geometryType' in layer ? layer.geometryType : undefined,
    hideFromLegend: layer.hideFromLegend,
    legend: layer.legend,
    minZoom: layer.minZoom,
    maxZoom: layer.maxZoom,
    label: 'label' in layer ? layer.label : undefined,
    raster: isRasterLayer(layer),
    actions: layer.actions,
    filters: 'filters' in layer ? layer.filters : undefined,
    // loaders that decide at load time (PMTiles) override these
    ...entry.record,
  }
}

export function registerLayers(
  map: MapLibreMap,
  layers: LayerConfig[],
): RegisteredLayer[] {
  const seen = new Set<string>()
  for (const layer of layers) {
    if (seen.has(layer.id)) {
      throw new Error(
        `Duplicate layer id "${layer.id}" in settings.layers. Layer ids must be globally unique.`,
      )
    }
    seen.add(layer.id)
    if ((layer as { opacity?: unknown }).opacity !== undefined) {
      throw configError({
        where: `settings.layers["${layer.id}"].opacity`,
        why: '`opacity` moved into `symbology`',
        fix:
          layer.type === 'esri'
            ? 'use esriOpacity for raster or service-styled Esri layers, or symbology.opacity / strokeOpacity with kit symbology'
            : (layer.type === 'pmtiles' || layer.type === 'tiles') && layer.raster
              ? 'use rasterOpacity'
              : 'use symbology.opacity (fill, dot or line) and symbology.strokeOpacity (outline or ring)',
      })
    }
    // bad refs throw at boot, not on first paint
    const symbology = 'symbology' in layer ? layer.symbology : undefined
    if (symbology?.kind === 'ref') resolveSymbology(symbology)
  }

  const registered: RegisteredLayer[] = []
  const { layerMetadata } = useStore.getState()

  // reversed so the first listed draws on top, rasters first to sit under
  const rasterLayers = layers.filter(isRasterLayer)
  const vectorLayers = layers.filter((l) => !isRasterLayer(l))
  const orderedLayers = [...rasterLayers].reverse().concat([...vectorLayers].reverse())

  for (const layer of orderedLayers) {
    // the store wins over settings, loaders read opacity via startOpacity
    const existing = layerMetadata[layer.id]
    const resolvedLayer: LayerConfig = existing ? { ...layer, visible: existing.visible } : layer

    let entry: RegisteredLayer
    try {
      switch (resolvedLayer.type) {
        case 'geojson':
          entry = addGeoJsonLayer(map, resolvedLayer)
          break
        case 'pmtiles':
          entry = addPMTilesLayer(map, resolvedLayer)
          break
        case 'tiles':
          entry = addTilesLayer(map, resolvedLayer)
          break
        case 'flatgeobuf':
          entry = addFlatGeobufLayer(map, resolvedLayer)
          break
        case 'esri':
          entry = addEsriLayer(map, resolvedLayer)
          break
        case 'geoparquet':
          entry = addGeoParquetLayer(map, resolvedLayer)
          break
        default: {
          const exhaustive: never = resolvedLayer
          throw new Error(`Unknown layer type: ${JSON.stringify(exhaustive)}`)
        }
      }
    } catch (err) {
      // one bad layer shouldn't blank the map
      console.warn(
        `[conness-gis] Skipping layer "${layer.id}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      continue
    }
    registered.push(entry)
    registry.set(layer.id, entry)
    recordLayer(map, layerRecord(layer, entry), entry)
  }

  return registered
}
