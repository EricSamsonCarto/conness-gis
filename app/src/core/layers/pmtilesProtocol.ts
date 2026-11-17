import { PMTiles, Protocol } from 'pmtiles'
import { isBundledLayerFile } from './resolveLayerUrl'
import { RangeOrWholeSource } from './pmtilesSource'

// shared with MapView, so loaders reuse the header MapLibre fetched
export const pmtilesProtocol = new Protocol()

// keyed by the url after pmtiles://
export function pmtilesArchive(url: string): PMTiles {
  let archive = pmtilesProtocol.get(url)
  if (!archive) {
    // only built-in files may fall back to a whole download
    archive = new PMTiles(isBundledLayerFile(url) ? new RangeOrWholeSource(url) : url)
    pmtilesProtocol.add(archive)
  }
  return archive
}

// PMTiles doesn't cache metadata, and basemap switches re-register layers
const metadataCache = new Map<string, Promise<unknown>>()

export function pmtilesMetadata(url: string): Promise<unknown> {
  const hit = metadataCache.get(url)
  if (hit) return hit
  const promise = pmtilesArchive(url)
    .getMetadata()
    .catch((err: unknown) => {
      // evict so a later call retries
      metadataCache.delete(url)
      throw err
    })
  metadataCache.set(url, promise)
  return promise
}
