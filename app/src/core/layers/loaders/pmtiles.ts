import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import type { PMTilesLayer } from '../../types'
import { resolveLayerUrl } from '../resolveLayerUrl'
import { pmtilesArchive, pmtilesMetadata } from '../pmtilesProtocol'
import { addRasterTileLayer, addVectorTileLayer, type TileMetadata } from './vectorTiles'
import type { RegisteredLayer } from './geojson'

export function addPMTilesLayer(map: MapLibreMap, layer: PMTilesLayer): RegisteredLayer {
  const resolvedUrl = resolveLayerUrl(layer.url)

  // header bounds, already cached by the shared reader
  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      const header = await pmtilesArchive(resolvedUrl).getHeader()
      return [header.minLon, header.minLat, header.maxLon, header.maxLat]
    } catch {
      return undefined
    }
  }

  if (layer.raster) {
    warnOnTileTypeMismatch(layer.id, resolvedUrl, true, undefined)
    return addRasterTileLayer(
      map,
      layer,
      { type: 'raster', url: `pmtiles://${resolvedUrl}`, tileSize: layer.tileSize ?? 512 },
      getBounds,
    )
  }

  warnOnTileTypeMismatch(layer.id, resolvedUrl, false, layer.encoding)
  return addVectorTileLayer(map, layer, {
    // the protocol's TileJSON lacks `encoding`, so MLT needs it here
    source: {
      type: 'vector',
      url: `pmtiles://${resolvedUrl}`,
      ...(layer.encoding ? { encoding: layer.encoding } : {}),
    },
    metadata: pmtilesMetadata(resolvedUrl).then((m) => m as TileMetadata),
    getBounds,
  })
}

// tile types 1 MVT and 6 MLT are vector, 2 to 5 images
// a mismatch draws nothing, so warn
function warnOnTileTypeMismatch(
  layerId: string,
  url: string,
  raster: boolean,
  encoding: 'mvt' | 'mlt' | undefined,
): void {
  void pmtilesArchive(url)
    .getHeader()
    .then(
      (header) => {
        const isRaster = header.tileType >= 2 && header.tileType <= 5
        const isVector = header.tileType === 1 || header.tileType === 6
        if (raster && isVector) {
          console.warn(
            `[conness-gis] PMTiles layer "${layerId}" has raster: true, but the archive holds vector tiles. Remove raster: true.`,
          )
        } else if (!raster && isRaster) {
          console.warn(
            `[conness-gis] PMTiles layer "${layerId}": the archive holds image tiles. Set raster: true.`,
          )
        } else if (!raster && header.tileType === 6 && encoding !== 'mlt') {
          console.warn(
            `[conness-gis] PMTiles layer "${layerId}": the archive holds MapLibre Tiles (MLT). Set encoding: 'mlt'.`,
          )
        }
      },
      () => {},
    )
}
