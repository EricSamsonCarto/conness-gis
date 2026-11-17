import type { ExpressionSpecification, FilterSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { useStore } from '../store'
import { resolvedThemeColor } from '../theme/theme'
import type { SelectedPopupFeature } from '../types'
import { isZoomCurve, plus, type Size } from './paintSize'

// drawn by filtered layers on the feature's own source, not a copy
// queried tiled polygons come back cut at tile edges
const FILL = 'kit-highlight-fill'
const OUTLINE = 'kit-highlight-outline'
const CASING = 'kit-highlight-casing'
const POINT = 'kit-highlight-point'
const IDS = [FILL, OUTLINE, CASING, POINT]

const isType = (...types: string[]): ExpressionSpecification => [
  'match',
  ['geometry-type'],
  types,
  true,
  false,
]

// the same identity popupHandlers' featureKey uses
// null when nothing tells it apart, an empty `all` would match everything
function matchFeature(feature: GeoJSON.Feature): ExpressionSpecification | null {
  if (feature.id !== undefined && feature.id !== null) return ['==', ['id'], feature.id]
  const props = Object.entries(feature.properties ?? {}).filter(
    ([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
  )
  if (props.length === 0) return null
  return ['all', ...props.map(([k, v]) => ['==', ['get', k], v] as ExpressionSpecification)]
}

// the ring's gap outside the point's own edge, at any size
const RING_GAP = 3

// the point's radius and stroke plus the gap, MapLibre's defaults if unset
function ringRadius(map: MapLibreMap, sublayerId: string): Size {
  const radius = (map.getPaintProperty(sublayerId, 'circle-radius') ?? 5) as Size
  const stroke = (map.getPaintProperty(sublayerId, 'circle-stroke-width') ?? 0) as Size
  // a zoom-based stroke can't go into another expression, so count 1px
  const edge = isZoomCurve(stroke) ? 1 : stroke
  const out = typeof edge === 'number' ? edge + RING_GAP : (['+', edge, RING_GAP] as ExpressionSpecification)
  return plus(radius, out)
}

function clear(map: MapLibreMap) {
  for (const id of IDS) if (map.getLayer(id)) map.removeLayer(id)
}

function draw(map: MapLibreMap, selected: SelectedPopupFeature) {
  const sublayer = map.getLayer(selected.sublayerId)
  if (!sublayer || !('source' in sublayer)) return
  const on = {
    source: sublayer.source,
    ...(sublayer.sourceLayer ? { 'source-layer': sublayer.sourceLayer } : {}),
  }
  const match = matchFeature(selected.feature)
  if (!match) return
  const where = (...types: string[]): FilterSpecification => ['all', match, isType(...types)]
  const color = resolvedThemeColor('featureHighlight')

  // polygons and points on top, a line's casing right under the line
  map.addLayer({
    id: FILL,
    type: 'fill',
    ...on,
    filter: where('Polygon', 'MultiPolygon'),
    paint: { 'fill-color': color, 'fill-opacity': 0.15 },
  })
  map.addLayer({
    id: OUTLINE,
    type: 'line',
    ...on,
    filter: where('Polygon', 'MultiPolygon'),
    paint: { 'line-color': color, 'line-width': 3 },
    layout: { 'line-join': 'round' },
  })
  map.addLayer({
    id: POINT,
    type: 'circle',
    ...on,
    filter: where('Point', 'MultiPoint'),
    paint: {
      'circle-radius': sublayer.type === 'circle' ? ringRadius(map, selected.sublayerId) : 10,
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': color,
      'circle-stroke-width': 3,
    },
  })
  map.addLayer(
    {
      id: CASING,
      type: 'line',
      ...on,
      filter: where('LineString', 'MultiLineString'),
      paint: { 'line-color': color, 'line-width': 7, 'line-opacity': 0.6 },
      layout: { 'line-join': 'round', 'line-cap': 'round' },
    },
    selected.sublayerId,
  )
}

// redrawn on every selection, so layers loaded later never end up above
export function registerHighlight(map: MapLibreMap): () => void {
  const update = () => {
    const { selectedFeatures, selectedFeatureIndex } = useStore.getState()
    const selected = selectedFeatures[selectedFeatureIndex]
    try {
      clear(map)
      if (selected?.resolved.highlight) draw(map, selected)
    } catch (err) {
      // a failed highlight mustn't take the popup with it
      console.warn("[conness-gis] Couldn't highlight the selected feature:", err)
    }
  }
  const unsubscribe = useStore.subscribe((state, prev) => {
    if (
      state.selectedFeatures !== prev.selectedFeatures ||
      state.selectedFeatureIndex !== prev.selectedFeatureIndex
    ) {
      update()
    }
  })
  return () => {
    unsubscribe()
    // the map may already be torn down
    try {
      clear(map)
    } catch {
      // nothing left to clear
    }
  }
}
