import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LayerConfig } from '../types'
import { pmtilesMetadata } from './pmtilesProtocol'
import { resolveLayerUrl } from './resolveLayerUrl'

type TileFields = { vector_layers?: { id: string; fields?: Record<string, string> }[] }

// a layer's columns for the editor's pickers, read however its type can tell
export async function layerColumns(map: MapLibreMap, layerId: string, sourceLayer: string | undefined, layers: LayerConfig[]): Promise<string[]> {
  const layer = layers.find((l) => l.id === layerId)
  if (!layer) throw new Error("the preview doesn't have this layer yet. Click Refresh Settings first")
  const sorted = (names: Iterable<string>) => [...new Set(names)].sort((a, b) => a.localeCompare(b))

  if (layer.type === 'geojson') {
    const { layerColumns: geojsonColumns } = await import('../search/featureSearch')
    return geojsonColumns(layerId, layers)
  }
  if (layer.type === 'geoparquet') {
    const { describeGeoParquet } = await import('../duckdb/readGeo')
    return sorted((await describeGeoParquet(resolveLayerUrl(layer.url))).attrs.map((c) => c.name))
  }
  if (layer.type === 'esri') {
    if (layer.service !== 'feature') throw new Error('a map service has no columns to pick')
    const info = (await (await fetch(`${layer.url}?f=json`)).json()) as { fields?: { name: string }[] }
    return sorted((info.fields ?? []).map((f) => f.name))
  }
  if (layer.type === 'pmtiles' || layer.type === 'tiles') {
    if (layer.raster) throw new Error('image tiles have no columns')
    const metadata = (
      layer.type === 'pmtiles'
        ? await pmtilesMetadata(resolveLayerUrl(layer.url))
        : layer.url.includes('{z}')
          ? {}
          : await (await fetch(layer.url)).json()
    ) as TileFields
    const listed = metadata.vector_layers ?? []
    const own = sourceLayer ? listed.filter((v) => v.id === sourceLayer) : listed
    const names = own.flatMap((v) => Object.keys(v.fields ?? {}))
    if (names.length === 0) throw new Error("the tiles don't list their columns")
    return sorted(names)
  }
  // FlatGeobuf only knows what's loaded so far
  const names = map.querySourceFeatures(`src-${layer.id}`).flatMap((f) => Object.keys(f.properties ?? {}))
  if (names.length === 0) throw new Error('none of its features are loaded. Pan the preview to where it has some')
  return sorted(names)
}
