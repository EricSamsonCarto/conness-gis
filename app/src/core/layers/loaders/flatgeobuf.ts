import type {
  Map as MapLibreMap,
  GeoJSONSource,
  LngLatBounds,
  LngLatBoundsLike,
} from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/turf'
import type { Feature, FeatureCollection } from 'geojson'
import type { Rect } from 'flatgeobuf/lib/mjs/packedrtree.js'
import type { FlatGeobufLayer } from '../../types'
import { resolveLayerUrl } from '../resolveLayerUrl'
import { addSublayers } from './sublayers'
import type { RegisteredLayer } from './geojson'
import { startOpacity } from '../recordLayer'
import { loadWhenVisible } from '../lazyLoad'

const DYNAMIC_REFETCH_THROTTLE_MS = 400

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

function boundsToRect(bounds: LngLatBounds): Rect {
  return {
    minX: bounds.getWest(),
    minY: bounds.getSouth(),
    maxX: bounds.getEast(),
    maxY: bounds.getNorth(),
  }
}

// url and rect make Range reads, a stream reads the whole file
// a url with no rect throws
async function fetchFeatures(url: string, rect?: Rect): Promise<FeatureCollection> {
  // lazy, so apps without FlatGeobuf never download it
  const { deserialize } = await import('flatgeobuf/lib/mjs/geojson.js')
  const features: Feature[] = []
  if (rect) {
    for await (const feature of deserialize(url, { rect })) {
      features.push(feature as Feature)
    }
  } else {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`)
    }
    if (!response.body) throw new Error(`No response body for ${url}`)
    for await (const feature of deserialize(response.body)) {
      features.push(feature as Feature)
    }
  }
  return { type: 'FeatureCollection', features }
}

// dynamic's moveend listener outlives setStyle, hence teardown
export function addFlatGeobufLayer(
  map: MapLibreMap,
  layer: FlatGeobufLayer,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`
  const visible = layer.visible ?? true
  const opacity = startOpacity(layer)
  const visibility: 'visible' | 'none' = visible ? 'visible' : 'none'
  const resolvedUrl = resolveLayerUrl(layer.url)
  const dynamic = layer.bbox === 'dynamic'

  // start empty so boot never waits on the network
  map.addSource(sourceId, {
    type: 'geojson',
    data: EMPTY_FC,
  })

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

  const getSource = (): GeoJSONSource | undefined =>
    map.getSource(sourceId) as GeoJSONSource | undefined

  // dynamic bounds are only the loaded view, the rest needs a header fetch
  let lastFc: FeatureCollection | undefined
  // only the newest request may write, a slow old fetch can land late
  let latestRequest = 0

  const loadInto = async (rect?: Rect) => {
    const request = ++latestRequest
    try {
      const fc = await fetchFeatures(resolvedUrl, rect)
      if (request !== latestRequest) return
      lastFc = fc
      // source may be gone if the basemap switched mid-request
      getSource()?.setData(fc)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const hint = dynamic
        ? `. bbox:'dynamic' needs a host that serves .fgb uncompressed over ` +
          `HTTP Range requests. Gzip-compressing hosts (e.g. GitHub Pages) break ` +
          `partial reads. Either host the file on a Range-friendly server or use ` +
          `bbox:'all'.`
        : ''
      console.warn(
        `[conness-gis] FlatGeobuf layer "${layer.id}" failed to load: ${detail}${hint}`,
      )
    }
  }

  let teardown: (() => void) | undefined

  // `all` stays pending until its read lands
  const start = async (): Promise<void> => {
    if (dynamic) {
      // throttled, plus a trailing fetch for the final view
      let lastRun = 0
      let trailing: ReturnType<typeof setTimeout> | undefined
      const run = () => {
        lastRun = Date.now()
        void loadInto(boundsToRect(map.getBounds()))
      }
      const onMoveEnd = () => {
        const elapsed = Date.now() - lastRun
        if (elapsed >= DYNAMIC_REFETCH_THROTTLE_MS) {
          run()
        } else {
          if (trailing) clearTimeout(trailing)
          trailing = setTimeout(run, DYNAMIC_REFETCH_THROTTLE_MS - elapsed)
        }
      }
      map.on('moveend', onMoveEnd)
      teardown = () => {
        map.off('moveend', onMoveEnd)
        if (trailing) clearTimeout(trailing)
      }
      lastRun = Date.now()
      await loadInto(boundsToRect(map.getBounds()))
    } else {
      await loadInto()
    }
  }
  const cancelLoad = loadWhenVisible(layer, visible, start)

  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    if (!lastFc || lastFc.features.length === 0) return undefined
    return turfBbox(lastFc) as LngLatBoundsLike
  }

  return {
    id: layer.id,
    sourceId,
    sublayerIds,
    teardown: () => {
      cancelLoad()
      teardown?.()
    },
    getBounds,
  }
}
