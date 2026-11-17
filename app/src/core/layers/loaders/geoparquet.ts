import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GeoParquetLayer } from '../../types'
import { resolveLayerUrl } from '../resolveLayerUrl'
import { describeGeoParquet, readGeoParquet } from '../../duckdb/readGeo'
import { addDuckDBTileLayer } from './duckdbTiles'
import { addDuckDBLayer } from './duckdbLayer'
import type { RegisteredLayer } from './geojson'

export function addGeoParquetLayer(
  map: MapLibreMap,
  layer: GeoParquetLayer,
): RegisteredLayer {
  // DuckDB runs in a worker, needs an absolute url
  const url = new URL(resolveLayerUrl(layer.url), location.href).href
  if (layer.mvt) {
    return addDuckDBTileLayer(map, layer, url, layer, () => describeGeoParquet(url))
  }
  return addDuckDBLayer(map, layer, () => readGeoParquet(layer.id, url, layer.limit))
}
