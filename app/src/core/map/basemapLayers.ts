import type {
  Map as MapLibreMap,
  LayerSpecification,
  SourceSpecification,
  SpriteSpecification,
  StyleSpecification,
} from 'maplibre-gl'

// swaps basemap layers in place, setStyle's diff would drop data layers

const PREFIX = 'basemap:'

let basemapLayerIds: string[] = []
let basemapSourceIds: string[] = []
// the latest switch wins, a style fetch that lands late is dropped
let latestSwitch = 0

export const isBasemapLayer = (id: string): boolean => basemapLayerIds.includes(id)

// at 'load', before data layers register, the whole style is basemap
export function recordBootBasemap(map: MapLibreMap): void {
  basemapLayerIds = map.getLayersOrder()
  basemapSourceIds = Object.keys(map.getStyle().sources)
}

// prefixed ids can't collide with data layers
// projection, sky and terrain are left out, they belong to the kit
export function basemapParts(style: StyleSpecification): {
  sources: Record<string, SourceSpecification>
  layers: LayerSpecification[]
  glyphs?: string
  sprite?: SpriteSpecification
} {
  const sources: Record<string, SourceSpecification> = {}
  for (const [id, source] of Object.entries(style.sources)) sources[PREFIX + id] = source
  const layers = style.layers.map(
    (layer) =>
      ({
        ...layer,
        id: PREFIX + layer.id,
        ...('source' in layer && typeof layer.source === 'string'
          ? { source: PREFIX + layer.source }
          : {}),
      }) as LayerSpecification,
  )
  return { sources, layers, glyphs: style.glyphs, sprite: style.sprite }
}

// false if the fetch failed or a later switch won. `null` removes it
export async function swapBasemap(
  map: MapLibreMap,
  style: string | StyleSpecification | null,
): Promise<boolean> {
  const token = ++latestSwitch
  let next: StyleSpecification | null
  try {
    // shortcut: relative URLs in a fetched style aren't resolved
    // resolve against the style URL if one needs it
    next = typeof style === 'string' ? await (await fetch(style)).json() : style
  } catch (err) {
    console.warn(
      `[conness-gis] Couldn't load basemap style, keeping the current one: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return false
  }
  if (token !== latestSwitch) return false

  for (const id of basemapLayerIds) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of basemapSourceIds) if (map.getSource(id)) map.removeSource(id)
  basemapLayerIds = []
  basemapSourceIds = []
  if (!next) return true

  const { sources, layers, glyphs, sprite } = basemapParts(next)
  // lowest remaining layer = bottom of the data stack
  const beforeId = map.getLayersOrder()[0]
  for (const [id, source] of Object.entries(sources)) map.addSource(id, source)
  for (const layer of layers) map.addLayer(layer, beforeId)
  // raster basemaps have no glyphs, keep the old fonts so labels draw
  if (glyphs) map.setGlyphs(glyphs)
  // typed as a URL, but setSprite passes arrays (VersaTiles) through
  if (sprite) map.setSprite(sprite as string)

  basemapLayerIds = layers.map((l) => l.id)
  basemapSourceIds = Object.keys(sources)
  return true
}
