import type {
  ErrorEvent as MapErrorEvent,
  Map as MapLibreMap,
  GeoJSONSource,
  LngLatBoundsLike,
  MapSourceDataEvent,
} from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/turf'
import type { GeoJsonLayer, LayerFilterHandler } from '../../types'
import { resolveLayerUrl } from '../resolveLayerUrl'
import { addSublayers } from './sublayers'
import { loadGeoJsonFeatures } from '../geojsonFeatures'
import { describeGeoJSON, readGeoJSON } from '../../duckdb/readGeo'
import { addDuckDBTileLayer } from './duckdbTiles'
import { addDuckDBLayer } from './duckdbLayer'
import type { LayerRecord } from '../recordLayer'
import { setGeoJsonLayerFilter } from '../layerOps'
import { toExpression } from '../../filters/compile'
import { currentFilterPredicate } from '../../filters/apply'
import { cachedValues, distinctFromFeatures } from '../../filters/values'
import { startOpacity } from '../recordLayer'
import { isDeferred, loadWhenVisible } from '../lazyLoad'

export interface RegisteredLayer {
  id: string
  sourceId: string
  sublayerIds: string[]
  // runs before a basemap-switch re-register so listeners don't leak
  teardown?: () => void
  // lazy, called on click, some loaders need an extra request
  getBounds?: () => Promise<LngLatBoundsLike | undefined>
  // unfiltered for Export, the caller applies the filter
  getFeatures?: () => Promise<GeoJSON.Feature[]>
  // the boot overlay waits on it, it never rejects
  // loadWhenVisible loaders mark pending themselves
  ready?: Promise<void>
  // overrides the settings-derived store record (PMTiles)
  record?: Partial<LayerRecord>
  filter?: LayerFilterHandler
}

const GEOJSON_SIZE_WARN_THRESHOLD_MB = 15

export async function fileSizeMB(url: string): Promise<number | null> {
  if (url.startsWith('data:')) return null
  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) / (1024 * 1024) : null
  } catch {
    return null
  }
}

async function warnIfLargeGeoJson(layerId: string, url: string): Promise<void> {
  const sizeMB = await fileSizeMB(url)
  if (sizeMB === null || sizeMB <= GEOJSON_SIZE_WARN_THRESHOLD_MB) return
  console.warn(
    `[conness-gis] Layer "${layerId}" is ${sizeMB.toFixed(1)}MB as GeoJSON. ` +
      `Files over ${GEOJSON_SIZE_WARN_THRESHOLD_MB}MB cause noticeable parse lag ` +
      `and can freeze the browser tab on load. Consider converting to PMTiles ` +
      `or simplifying the geometry (e.g. gdf.simplify() in convert-data/).`,
  )
}

// settles on error too, so pending never hangs
function fillFromUrl(map: MapLibreMap, sourceId: string, url: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      map.off('sourcedata', onData)
      map.off('error', onError)
      resolve()
    }
    const onData = (e: MapSourceDataEvent) => {
      if (e.sourceId === sourceId && map.isSourceLoaded(sourceId)) done()
    }
    // MapLibre merges the failing source's id into its error event
    const onError = (e: MapErrorEvent & { sourceId?: string }) => {
      if (e.sourceId === sourceId) done()
    }
    map.on('sourcedata', onData)
    map.on('error', onError)
    ;(map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(url)
  })
}

export function addGeoJsonLayer(
  map: MapLibreMap,
  layer: GeoJsonLayer,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`
  const visible = layer.visible ?? true
  const opacity = startOpacity(layer)
  const visibility: 'visible' | 'none' = visible ? 'visible' : 'none'
  const resolvedUrl = resolveLayerUrl(layer.url)

  if (layer.duckdb) {
    // DuckDB runs in a worker, needs an absolute url
    const url = new URL(resolvedUrl, location.href).href
    if (typeof layer.duckdb === 'object' && layer.duckdb.mvt) {
      return addDuckDBTileLayer(map, layer, url, layer.duckdb, () => describeGeoJSON(url))
    }
    return addDuckDBLayer(map, layer, () => readGeoJSON(layer.id, url))
  }

  void warnIfLargeGeoJson(layer.id, resolvedUrl)

  const deferred = isDeferred(layer)
  map.addSource(sourceId, {
    type: 'geojson',
    data: deferred ? { type: 'FeatureCollection', features: [] } : resolvedUrl,
  })
  const cancelLoad = deferred
    ? loadWhenVisible(layer, visible, () => fillFromUrl(map, sourceId, resolvedUrl))
    : undefined

  const sublayerIds = addSublayers(map, {
    layerId: layer.id,
    sourceId,
    symbology: layer.symbology,
    geometryType: layer.geometryType,
    visibility,
    opacity,
    minZoom: layer.minZoom,
    maxZoom: layer.maxZoom,
    label: layer.label,
  })

  // MapLibre owns the parsed data, so fetch our cached copy on demand
  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      const all = await loadGeoJsonFeatures(layer.id, resolvedUrl)
      const passes = currentFilterPredicate(layer.id)
      const features = passes ? all.filter((f) => passes(f.properties)) : all
      if (features.length === 0) return undefined
      return turfBbox({ type: 'FeatureCollection', features }) as LngLatBoundsLike
    } catch {
      return undefined
    }
  }

  const filter: LayerFilterHandler | undefined = layer.filters?.length
    ? {
        apply: (state) => setGeoJsonLayerFilter(map, layer.id, toExpression(state)),
        getValues: (column) =>
          cachedValues(layer.id, column, async () =>
            distinctFromFeatures(await loadGeoJsonFeatures(layer.id, resolvedUrl), column),
          ),
      }
    : undefined

  return {
    id: layer.id,
    sourceId,
    getBounds,
    getFeatures: () => loadGeoJsonFeatures(layer.id, resolvedUrl),
    sublayerIds,
    filter,
    teardown: cancelLoad,
  }
}
