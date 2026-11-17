import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { ContoursConfig, HillshadeConfig } from '../types'
import { settings } from '@user/settings'
import { DEFAULT_FONT, DEFAULT_FONT_SIZE } from '../layers/labels'
import { widgetSettings } from '../widgetSettings'
import { useStore } from '../store'
import { isBasemapLayer } from './basemapLayers'
import { DEFAULT_DEM_SOURCE, demSource } from './terrain'

// the stack from the bottom is basemap, hillshade, contours, your data
const HILLSHADE_SOURCE = 'hillshade-dem'
const HILLSHADE_LAYER = 'kit-hillshade'

const CONTOURS_SOURCE = 'contours-src'
const CONTOURS_LINES = 'kit-contours'
const CONTOURS_LABELS = 'kit-contour-labels'

type ElevationSettings = { hillshade?: HillshadeConfig; contours?: ContoursConfig }
const hillshadeConfig = (): HillshadeConfig => widgetSettings<ElevationSettings>('basemap')?.hillshade ?? {}
const contoursConfig = (): ContoursConfig => widgetSettings<ElevationSettings>('basemap')?.contours ?? {}

// minor and major intervals from each zoom up
const THRESHOLDS = {
  meters: { 10: [200, 1000], 12: [100, 500], 14: [20, 100] },
  feet: { 10: [500, 2500], 12: [250, 1000], 14: [50, 250] },
}

// the first layer above the basemap that isn't in `skip`, to insert under
function aboveBasemap(map: MapLibreMap, skip: string[] = []): string | undefined {
  return map.getLayersOrder().find((id) => !isBasemapLayer(id) && !skip.includes(id))
}

// the browser parses any CSS color, then the alpha is scaled
export function withAlpha(color: string, alpha: number): string {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return color
  ctx.fillStyle = color
  const c = String(ctx.fillStyle)
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const [r, g, b, a = '1'] = c.slice(c.indexOf('(') + 1, -1).split(',').map((p) => p.trim())
  return `rgba(${r}, ${g}, ${b}, ${Number(a) * alpha})`
}

export function setHillshade(map: MapLibreMap, on: boolean): void {
  if (map.getLayer(HILLSHADE_LAYER)) map.removeLayer(HILLSHADE_LAYER)
  if (map.getSource(HILLSHADE_SOURCE)) map.removeSource(HILLSHADE_SOURCE)
  useStore.getState().setHillshadeOn(on)
  if (!on) return
  const c = hillshadeConfig()
  const alpha = c.opacity ?? 0.5
  map.addSource(HILLSHADE_SOURCE, demSource(c.source))
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: HILLSHADE_SOURCE,
      paint: {
        'hillshade-method': c.method ?? 'standard',
        'hillshade-exaggeration': c.exaggeration ?? 0.5,
        'hillshade-highlight-color': withAlpha(c.highlightColor ?? 'rgb(255, 255, 228)', alpha),
        'hillshade-shadow-color': withAlpha(c.shadowColor ?? 'rgb(114, 124, 131)', alpha),
        'hillshade-accent-color': withAlpha(c.accentColor ?? '#000000', alpha),
      },
    },
    aboveBasemap(map),
  )
}

// one per elevation url, made when contours first turn on
let contourDem: { url: string; dem: InstanceType<typeof import('maplibre-contour').default.DemSource> } | null = null
// a later toggle wins over an earlier one still loading the library
let contoursToken = 0

export async function setContours(map: MapLibreMap, on: boolean): Promise<void> {
  const token = ++contoursToken
  for (const id of [CONTOURS_LABELS, CONTOURS_LINES]) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(CONTOURS_SOURCE)) map.removeSource(CONTOURS_SOURCE)
  useStore.getState().setContoursOn(on)
  if (!on) return
  const c = contoursConfig()
  const own = c.source?.tiles?.[0]
  const url = own ?? DEFAULT_DEM_SOURCE.tiles[0]
  if (contourDem?.url !== url) {
    const { default: mlcontour } = await import('maplibre-contour')
    // as in Mapterhorn's example, contours from z12 in a worker
    const dem = new mlcontour.DemSource({
      url,
      encoding: c.source?.encoding === 'mapbox' ? 'mapbox' : 'terrarium',
      maxzoom: Math.min(c.source?.maxzoom ?? 12, 12),
      worker: true,
    })
    dem.setupMaplibre(maplibregl)
    contourDem = { url, dem }
  }
  if (token !== contoursToken || !map.getStyle()) return
  const feet = c.unit === 'feet'
  map.addSource(CONTOURS_SOURCE, {
    type: 'vector',
    tiles: [
      contourDem.dem.contourProtocolUrl({
        thresholds: c.thresholds ?? THRESHOLDS[feet ? 'feet' : 'meters'],
        multiplier: feet ? 3.28084 : 1,
        elevationKey: 'ele',
        levelKey: 'level',
        contourLayer: 'contours',
        buffer: 1,
        overzoom: 2,
      }),
    ],
    maxzoom: 17,
    ...(own ? {} : { attribution: DEFAULT_DEM_SOURCE.attribution }),
  })
  // above the hillshade, under the data
  const before = aboveBasemap(map, [HILLSHADE_LAYER])
  const width = c.width ?? 1
  const minzoom = c.minZoom ?? 10
  map.addLayer(
    {
      id: CONTOURS_LINES,
      type: 'line',
      source: CONTOURS_SOURCE,
      'source-layer': 'contours',
      minzoom,
      paint: {
        'line-color': c.lineColor ?? 'rgb(215, 151, 60)',
        'line-width': ['match', ['get', 'level'], 1, width, width / 2],
      },
    },
    before,
  )
  if (c.labels === false) return
  map.addLayer(
    {
      id: CONTOURS_LABELS,
      type: 'symbol',
      source: CONTOURS_SOURCE,
      'source-layer': 'contours',
      minzoom: c.labelMinZoom ?? minzoom,
      maxzoom: c.labelMaxZoom ?? 24,
      paint: {
        'text-color': c.labelColor ?? 'rgb(172, 120, 48)',
        'text-halo-color': 'white',
        'text-halo-width': 2,
      },
      layout: {
        'symbol-placement': 'line',
        // the kit's label size, as data labels use (Label defaults)
        'text-size': c.labelSize ?? settings.ui?.layerDefaults?.label?.fontSize ?? DEFAULT_FONT_SIZE,
        'text-field': ['concat', ['number-format', ['get', 'ele'], {}], feet ? ' ft' : ' m'],
        'text-font': [DEFAULT_FONT],
      },
    },
    before,
  )
}

// on at load from settings, rebuilt as they were after a live change
export function applyElevation(map: MapLibreMap, boot: boolean): void {
  const hillshade = boot ? hillshadeConfig().enabled === true : useStore.getState().hillshadeOn
  if (hillshade || map.getLayer(HILLSHADE_LAYER)) setHillshade(map, hillshade)
  const contours = boot ? contoursConfig().enabled === true : useStore.getState().contoursOn
  if (contours || map.getSource(CONTOURS_SOURCE)) void setContours(map, contours)
}
