import MapboxDraw from '@mapbox/mapbox-gl-draw'
import type { GeoJSONSource, IControl, Map as MapLibreMap } from 'maplibre-gl'
import { onSourcesLoaded } from './persistentOverlay'

// a plain string, MapLibre paint can't read var(). mirrors the hover token
export const HOVER_COLOR = '#f59e0b'

type DrawEventName = 'draw.create' | 'draw.update' | 'draw.delete' | 'draw.selectionchange' | 'draw.render'
// never, so any handler fits whatever payload it expects
type DrawListener = (e: never) => void

// Draw fires its events on the map, MapLibre 6 types only its own
export function drawEvents(map: MapLibreMap) {
  return map as unknown as {
    on(type: DrawEventName, listener: DrawListener): void
    off(type: DrawEventName, listener: DrawListener): void
    once(type: DrawEventName, listener: DrawListener): void
  }
}

// fixed source ids, so only one Draw can be on the map at a time
const DRAW_COLD_SOURCE = 'mapbox-gl-draw-cold'

// one slot for Draw and Measure, so either waits for the other to close
let pendingSwap: (() => void) | null = null

export function finishPendingSwap(): void {
  const finish = pendingSwap
  pendingSwap = null
  finish?.()
}

export function addMapboxDraw(map: MapLibreMap, styles: object[]): MapboxDraw {
  // a fast reopen or a Draw and Measure switch never makes a second Draw
  finishPendingSwap()
  // point Draw's class lookups at MapLibre's (official example)
  const classes = MapboxDraw.constants.classes as Record<string, string>
  classes.CANVAS = 'maplibregl-canvas'
  classes.CONTROL_BASE = 'maplibregl-ctrl'
  classes.CONTROL_PREFIX = 'maplibregl-ctrl-'
  classes.CONTROL_GROUP = 'maplibregl-ctrl-group'
  classes.ATTRIBUTION = 'maplibregl-ctrl-attrib'

  const draw = new MapboxDraw({ displayControlsDefault: false, userProperties: true, styles })
  // @types target mapbox-gl's Map, this is the documented MapLibre pattern
  map.addControl(draw as unknown as IControl)
  return draw
}

export function removeMapboxDraw(map: MapLibreMap, draw: MapboxDraw): void {
  try {
    map.removeControl(draw as unknown as IControl)
  } catch {
    // already gone if the style was torn down
  }
}

// keep the overlay until Draw draws the same shapes, so they don't blink
export function swapOverlayOut(map: MapLibreMap, removeOverlay: () => void, alsoWait: string[] = []): void {
  const start = () => {
    pendingSwap = onSourcesLoaded(map, [DRAW_COLD_SOURCE, ...alsoWait], removeOverlay)
  }
  drawEvents(map).once('draw.render', start)
  pendingSwap = () => {
    drawEvents(map).off('draw.render', start)
    removeOverlay()
  }
}

// keep Draw until the overlay's sources have drawn, so shapes don't blink
export function swapOverlayIn(map: MapLibreMap, sources: string[], removeLive: () => void): void {
  pendingSwap = onSourcesLoaded(map, sources, removeLive)
}

// Draw adds every style twice, `.cold` idle and `.hot` being edited
const renderedIds = (styleId: string) => [`${styleId}.cold`, `${styleId}.hot`]

// pass as queryRenderedFeatures' `layers` so hover skips the basemap
export function drawLayerIds(map: MapLibreMap, styles: object[]): string[] {
  return styles
    .flatMap((s) => renderedIds((s as { id: string }).id))
    .filter((id) => map.getLayer(id))
}

// Draw strips user_* off vertices, so a style expression can't color them
export function setDrawVertexColor(map: MapLibreMap, vertexStyleId: string, color: string): void {
  for (const id of renderedIds(vertexStyleId)) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'circle-color', color)
  }
}

// setFeatureProperty doesn't repaint, re-setting the features does
export function repaintDraw(draw: MapboxDraw): void {
  draw.set(draw.getAll())
}

// a user_hover property, Draw's re-renders make feature-state unreliable
export function setDrawHover(draw: MapboxDraw, from: string | null, to: string | null): void {
  if (from !== null && draw.get(from)) draw.setFeatureProperty(from, 'hover', false)
  if (to !== null && draw.get(to)) draw.setFeatureProperty(to, 'hover', true)
  repaintDraw(draw)
}

export function featuresWithMeta<M>(
  draw: MapboxDraw,
  meta: Map<string, M>,
): { id: string; geometry: GeoJSON.Geometry; meta: M }[] {
  const out: { id: string; geometry: GeoJSON.Geometry; meta: M }[] = []
  for (const f of draw.getAll().features) {
    const m = typeof f.id === 'string' ? meta.get(f.id) : undefined
    if (m) out.push({ id: f.id as string, geometry: f.geometry, meta: m })
  }
  return out
}

// Draw's draft ends with the cursor point, which isn't placed yet
function placedVertices(g: GeoJSON.Geometry): GeoJSON.Position[] {
  const coords =
    g.type === 'LineString' ? g.coordinates.slice(0, -1)
    : g.type === 'Polygon' ? (g.coordinates[0] ?? []).slice(0, -2)
    : []
  return coords.filter(Array.isArray)
}

// the newest unrecorded feature, colored from the first click
// dots every placed vertex, since Draw shows only the newest
export class DraftFeature {
  private draftId: string | null = null
  private color = ''
  private readonly map: MapLibreMap
  private readonly draw: MapboxDraw
  private readonly vertexStyleId: string
  private readonly sourceId: string
  private readonly layerId: string

  constructor(map: MapLibreMap, draw: MapboxDraw, vertexStyleId: string, sourceId: string) {
    this.map = map
    this.draw = draw
    this.vertexStyleId = vertexStyleId
    this.sourceId = sourceId
    this.layerId = `${sourceId}-circle`
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer(this.layerId)) {
      map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 4,
          'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      })
    }
  }

  // call on draw.render while a tool is armed
  update(known: Map<string, unknown>, nextColor: string): GeoJSON.Feature | undefined {
    const drafts = this.draw.getAll().features.filter((f) => typeof f.id !== 'string' || !known.has(f.id))
    const draft = drafts[drafts.length - 1]
    if (!draft || typeof draft.id !== 'string') {
      this.clear()
      return undefined
    }
    if (this.draftId !== draft.id) {
      this.draftId = draft.id
      this.color = nextColor
    }
    if (draft.properties?.user_color !== this.color) this.draw.setFeatureProperty(draft.id, 'color', this.color)
    setDrawVertexColor(this.map, this.vertexStyleId, this.color)
    this.setVertices(placedVertices(draft.geometry))
    // Draw re-inserts its layers on top as it renders
    if (this.map.getLayer(this.layerId)) this.map.moveLayer(this.layerId)
    return draft
  }

  clear(): void {
    if (this.draftId === null) return
    this.draftId = null
    this.setVertices([])
  }

  remove(): void {
    if (this.map.getLayer(this.layerId)) this.map.removeLayer(this.layerId)
    if (this.map.getSource(this.sourceId)) this.map.removeSource(this.sourceId)
  }

  private setVertices(coords: GeoJSON.Position[]): void {
    const features: GeoJSON.Feature[] = coords.map((c) => ({
      type: 'Feature',
      properties: { color: this.color },
      geometry: { type: 'Point', coordinates: c },
    }))
    ;(this.map.getSource(this.sourceId) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
  }
}
