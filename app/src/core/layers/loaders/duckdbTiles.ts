import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import type { GeoJsonLayer, GeoParquetLayer, LayerFilterHandler, TilesVectorLayer } from '../../types'
import type { Column } from '../../duckdb/readGeo'
import { allFeatures, distinctValues, prepareTileTable, type TileTable } from '../../duckdb/tileTable'
import { tileUrl } from '../../duckdb/tileProtocol'
import { setGeoJsonLayerFilter } from '../layerOps'
import { toExpression } from '../../filters/compile'
import { cachedValues, sortDistinct } from '../../filters/values'
import { addVectorTileLayer } from './vectorTiles'
import { fileSizeMB, type RegisteredLayer } from './geojson'
import { loadWhenVisible } from '../lazyLoad'

const DEFAULT_MAX_TILE_FEATURES = 5000
// don't tile a big dataset at continent scale by accident
const DEFAULT_MIN_ZOOM = 10
// tippecanoe and Planetiler's default (about 0.6 m), MapLibre overzooms
const DEFAULT_MAX_TILE_ZOOM = 14
// whole file held in memory (about 3x its size)
const LARGE_FILE_MB = 100

async function warnIfLargeForTiling(layerId: string, url: string): Promise<void> {
  const mb = await fileSizeMB(url)
  if (mb === null || mb <= LARGE_FILE_MB) return
  console.warn(
    `[conness-gis] Layer "${layerId}" is ${mb.toFixed(0)} MB. Tiling it in the browser ` +
      `holds the whole file in memory (about ${(mb * 3).toFixed(0)} MB). For data this size, ` +
      `convert it to PMTiles instead (see Converting Data in the docs).`,
  )
}

export function addDuckDBTileLayer(
  map: MapLibreMap,
  layer: GeoParquetLayer | GeoJsonLayer,
  url: string,
  tiling: { maxTileFeatures?: number; maxTileZoom?: number },
  source: () => Promise<{ from: string; attrs: Column[]; geom: string }>,
): RegisteredLayer {
  void warnIfLargeForTiling(layer.id, url)

  // started on first need (boot, toggle-on, export, filter or zoom)
  let table: Promise<TileTable> | undefined
  const load = () =>
    // registers at once, so early tile requests wait instead of empty
    (table ??= prepareTileTable(layer.id, url, source).catch((err: unknown) => {
      // forget the failure so the next need retries
      table = undefined
      throw err
    }))

  const cancelLoad = loadWhenVisible(layer, layer.visible ?? true, () =>
    load().then(
      () => {},
      (err: unknown) => {
        console.warn(
          `[conness-gis] Layer "${layer.id}" failed to load through DuckDB: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
      },
    ),
  )

  const config: TilesVectorLayer = {
    id: layer.id,
    type: 'tiles',
    name: layer.name,
    group: layer.group,
    visible: layer.visible,
    minZoom: layer.minZoom ?? DEFAULT_MIN_ZOOM,
    maxZoom: layer.maxZoom,
    geometryType: layer.geometryType,
    label: layer.label,
    popup: layer.popup,
    actions: layer.actions,
    hideFromLegend: layer.hideFromLegend,
    legend: layer.legend,
    url: '',
    sourceLayers: [{ sourceLayer: 'data', symbology: layer.symbology }],
  }

  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      return (await load()).bounds
    } catch {
      return undefined
    }
  }

  const entry = addVectorTileLayer(map, config, {
    source: {
      type: 'vector',
      tiles: [tileUrl(layer.id, tiling.maxTileFeatures ?? DEFAULT_MAX_TILE_FEATURES)],
      minzoom: 0,
      maxzoom: tiling.maxTileZoom ?? DEFAULT_MAX_TILE_ZOOM,
    },
    metadata: Promise.resolve({ vector_layers: [{ id: 'data' }] }),
    getBounds,
  })

  const filter: LayerFilterHandler | undefined = layer.filters?.length
    ? {
        // property expressions work on tile features as on GeoJSON ones
        apply: (state) => setGeoJsonLayerFilter(map, layer.id, toExpression(state)),
        getValues: (column) =>
          cachedValues(layer.id, column, async () =>
            sortDistinct(await distinctValues(await load(), column)),
          ),
      }
    : undefined

  return {
    ...entry,
    filter,
    // back in WGS84, the caller applies the filter
    getFeatures: async () => (await allFeatures(await load())).features,
    teardown: () => {
      entry.teardown?.()
      cancelLoad()
    },
  }
}
