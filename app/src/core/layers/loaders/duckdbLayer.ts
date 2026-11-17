import type { Map as MapLibreMap, GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/turf'
import type { FeatureCollection } from 'geojson'
import type { GeoJsonLayer, GeoParquetLayer, LayerFilterHandler } from '../../types'
import { addSublayers } from './sublayers'
import type { RegisteredLayer } from './geojson'
import { setGeoJsonLayerFilter } from '../layerOps'
import { toExpression } from '../../filters/compile'
import { currentFilterPredicate } from '../../filters/apply'
import { cachedValues, distinctFromFeatures } from '../../filters/values'
import { startOpacity } from '../recordLayer'
import { loadWhenVisible } from '../lazyLoad'

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function addDuckDBLayer(
  map: MapLibreMap,
  layer: GeoJsonLayer | GeoParquetLayer,
  read: () => Promise<FeatureCollection>,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`
  const visible = layer.visible ?? true
  const opacity = startOpacity(layer)
  const visibility: 'visible' | 'none' = visible ? 'visible' : 'none'

  map.addSource(sourceId, { type: 'geojson', data: EMPTY_FC })

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

  // set on teardown, so a late result can't write to a re-registered map
  let stale = false
  let lastFc: FeatureCollection | undefined

  // fills the source itself, so a retry from export/filter/zoom draws too
  let data: Promise<FeatureCollection> | undefined
  const load = () =>
    (data ??= (async () => {
      const fc = await read()
      lastFc = fc
      if (!stale) (map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(fc)
      return fc
    })().catch((err: unknown) => {
      // forget the failure so the next need retries
      data = undefined
      throw err
    }))

  const cancelLoad = loadWhenVisible(layer, visible, () =>
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

  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      lastFc ??= await load()
    } catch {
      return undefined
    }
    const passes = currentFilterPredicate(layer.id)
    const features = passes
      ? lastFc.features.filter((f) => passes(f.properties))
      : lastFc.features
    if (features.length === 0) return undefined
    return turfBbox({ type: 'FeatureCollection', features }) as LngLatBoundsLike
  }

  const filter: LayerFilterHandler | undefined = layer.filters?.length
    ? {
        apply: (state) => setGeoJsonLayerFilter(map, layer.id, toExpression(state)),
        getValues: (column) =>
          cachedValues(layer.id, column, async () =>
            distinctFromFeatures((await load()).features, column),
          ),
      }
    : undefined

  return {
    id: layer.id,
    sourceId,
    sublayerIds,
    teardown: () => {
      stale = true
      cancelLoad()
    },
    getBounds,
    // waits on the read, so an export mid-load isn't empty
    getFeatures: async () => (await load()).features,
    filter,
  }
}
