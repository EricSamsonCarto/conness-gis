import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import type { TilesLayer } from '../../types'
import { configError } from '../../configError'
import { addRasterTileLayer, addVectorTileLayer, type TileMetadata } from './vectorTiles'
import type { RegisteredLayer } from './geojson'

const DEFAULT_MIN_TILE_ZOOM = 0
const DEFAULT_MAX_TILE_ZOOM = 14

interface TileJson extends TileMetadata {
  bounds?: [number, number, number, number]
}

// our own copy, cached for basemap switches
const tileJsonCache = new Map<string, Promise<TileJson>>()

function fetchTileJson(url: string): Promise<TileJson> {
  const hit = tileJsonCache.get(url)
  if (hit) return hit
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
      return res.json() as Promise<TileJson>
    })
    .catch((err: unknown) => {
      // evict so a later call retries
      tileJsonCache.delete(url)
      throw err
    })
  tileJsonCache.set(url, promise)
  return promise
}

const isTemplate = (url: string) => url.includes('{z}')

export function addTilesLayer(map: MapLibreMap, layer: TilesLayer): RegisteredLayer {
  const template = isTemplate(layer.url)

  const templateFields = {
    tiles: [layer.url],
    minzoom: layer.minTileZoom ?? DEFAULT_MIN_TILE_ZOOM,
    maxzoom: layer.maxTileZoom ?? DEFAULT_MAX_TILE_ZOOM,
    ...(layer.attribution ? { attribution: layer.attribution } : {}),
  }

  // lazy, vector tiles need it now, rasters only for zoom-to-extent
  let tileJson: Promise<TileJson> | undefined
  const loadTileJson = () => (template ? null : (tileJson ??= fetchTileJson(layer.url)))
  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      const bounds = (await loadTileJson())?.bounds
      return bounds ? [bounds[0], bounds[1], bounds[2], bounds[3]] : undefined
    } catch {
      return undefined
    }
  }

  if (layer.raster) {
    return addRasterTileLayer(
      map,
      layer,
      {
        type: 'raster',
        tileSize: layer.tileSize ?? 512,
        ...(template ? templateFields : { url: layer.url }),
      },
      getBounds,
    )
  }

  if (template && (layer.sourceLayers ?? []).length === 0) {
    throw configError({
      where: `settings.layers["${layer.id}"].sourceLayers`,
      why: 'a {z}/{x}/{y} template has no metadata, so there are no source layers to draw',
      fix: "list them, e.g. sourceLayers: [{ sourceLayer: 'roads' }], or use the server's TileJSON URL",
    })
  }

  return addVectorTileLayer(map, layer, {
    source: {
      type: 'vector',
      ...(template ? templateFields : { url: layer.url }),
      // else the TileJSON's own encoding applies
      ...(layer.encoding ? { encoding: layer.encoding } : {}),
    },
    metadata: loadTileJson() ?? Promise.resolve(null),
    getBounds,
  })
}
