import type { Map as MapLibreMap, RasterDEMSourceSpecification } from 'maplibre-gl'
import type { DemSourceConfig, TerrainControlConfig } from '../types'

export const TERRAIN_SOURCE_ID = 'terrain-dem'

// Mapterhorn's tiles credit 151 open sources on that page
export const MAPTERHORN_ATTRIBUTION = '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'

// the values Mapterhorn's own examples use. shared by hillshade and contours
export const DEFAULT_DEM_SOURCE = {
  tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
  encoding: 'terrarium' as const,
  tileSize: 512,
  // real tiles stop at z17. uncapped, MapLibre would ask past it
  maxzoom: 17,
  attribution: MAPTERHORN_ATTRIBUTION,
}

// a source of the user's own (tiles or url) keeps only the encoding default
// so Mapterhorn's size, zoom and credit never land on someone else's tiles
export function demSource(source: DemSourceConfig | undefined): RasterDEMSourceSpecification {
  if (!source?.tiles && !source?.url) return { type: 'raster-dem', ...DEFAULT_DEM_SOURCE, ...source }
  return { type: 'raster-dem', encoding: DEFAULT_DEM_SOURCE.encoding, ...source }
}

// the source as last added, so a live change swaps it only when it differs
let addedSource = ''

// after a live change the source follows the settings
// and terrain stays as the user left it
export function applyTerrain(map: MapLibreMap, config: TerrainControlConfig | undefined, boot: boolean): void {
  const on = map.getTerrain()
  const spec = config ? JSON.stringify(demSource(config.source)) : ''
  if (spec !== addedSource || boot) {
    if (on) map.setTerrain(null)
    if (map.getSource(TERRAIN_SOURCE_ID)) map.removeSource(TERRAIN_SOURCE_ID)
    if (config) map.addSource(TERRAIN_SOURCE_ID, demSource(config.source))
    addedSource = spec
  }
  if (!config) return
  const exaggeration = config.exaggeration ?? 1
  if (boot ? config.enabled : on) map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration })
}
