import type {
  Map as MapLibreMap,
  LayerSpecification,
  FilterSpecification,
} from 'maplibre-gl'
import type { LabelConfig, LayerGeometryType, Symbology } from '../../types'
import {
  paintForCircle,
  paintForFill,
  paintForLine,
  extraLayout,
  resolveSymbology,
  geometryFromRawPaint,
  rawHasOutline,
} from '../symbology'
import { addLabelLayer } from '../labels'
import { configError } from '../../configError'
import { withLayerOpacity } from '../opacity'

// -line draws only real lines, tracing every polygon edge is heavy
// geometry-type reports multi-part features as Multi*
const isType = (...types: string[]): FilterSpecification => ['match', ['geometry-type'], types, true, false]
export const BASE_FILTERS: Record<'-fill' | '-line' | '-point', FilterSpecification> = {
  '-fill': isType('Polygon', 'MultiPolygon'),
  '-line': isType('LineString', 'MultiLineString'),
  '-point': isType('Point', 'MultiPoint'),
}
export const POLYGON_OUTLINE_FILTER: FilterSpecification = isType('Polygon', 'MultiPolygon')

// set when a sublayer's base differs from BASE_FILTERS (polygon outlines)
const baseFilterOverrides = new Map<string, FilterSpecification>()

export function recordBaseFilter(sublayerId: string, filter: FilterSpecification): void {
  baseFilterOverrides.set(sublayerId, filter)
}

export function baseFilterFor(
  sublayerId: string,
  suffix: '-fill' | '-line' | '-point',
): FilterSpecification {
  return baseFilterOverrides.get(sublayerId) ?? BASE_FILTERS[suffix]
}

export interface SublayerSpec {
  layerId: string
  sourceId: string
  sourceLayer?: string
  symbology: Symbology
  geometryType?: LayerGeometryType
  visibility: 'visible' | 'none'
  // multiplier on the symbology's own opacity
  opacity: number
  minZoom?: number
  maxZoom?: number
  label?: LabelConfig
  // whole-archive PMTiles stack source layers into tiers
  beforeIds?: Partial<Record<'fill' | 'line' | 'point' | 'label', string>>
}

export function addSublayers(
  map: MapLibreMap,
  spec: SublayerSpec,
): string[] {
  const { layerId, sourceId, sourceLayer, symbology, opacity, visibility, label } = spec
  const before = spec.beforeIds ?? {}

  // only set zoom keys when provided (else MapLibre defaults 0 / 24)
  const zoomRange: Pick<LayerSpecification, 'minzoom' | 'maxzoom'> = {}
  if (spec.minZoom !== undefined) zoomRange.minzoom = spec.minZoom
  if (spec.maxZoom !== undefined) zoomRange.maxzoom = spec.maxZoom

  // no geometryType means all three, unless a raw paint pins one
  const geom = spec.geometryType ?? rawPaintGeometry(layerId, symbology)
  const wantsFill = geom === undefined || geom === 'polygon'
  const resolved = resolveSymbology(symbology)
  const wantsLine =
    geom === undefined || geom === 'line' ||
    (geom === 'polygon' && (resolved.kind !== 'raw' || rawHasOutline(resolved)))
  const wantsPoint = geom === undefined || geom === 'point'

  const sublayerIds: string[] = []

  if (wantsFill) {
    const fillId = `${layerId}-fill`
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: sourceId,
      ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
      filter: BASE_FILTERS['-fill'],
      paint: withLayerOpacity(fillId, 'fill', paintForFill(symbology), opacity),
      layout: { ...extraLayout(symbology, 'fill-'), visibility },
      ...zoomRange,
    }, before.fill)
    sublayerIds.push(fillId)
  }

  if (wantsLine) {
    // on a polygon this line is the border (stroke*), else color and width
    const asPolygonOutline = geom === 'polygon'
    const lineId = `${layerId}-line`
    const lineFilter = asPolygonOutline ? POLYGON_OUTLINE_FILTER : BASE_FILTERS['-line']
    if (asPolygonOutline) recordBaseFilter(lineId, lineFilter)
    else baseFilterOverrides.delete(lineId)
    map.addLayer({
      id: lineId,
      type: 'line',
      source: sourceId,
      ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
      filter: lineFilter,
      paint: withLayerOpacity(lineId, 'line', paintForLine(symbology, asPolygonOutline), opacity),
      layout: { ...extraLayout(symbology, 'line-'), visibility },
      ...zoomRange,
    }, before.line)
    sublayerIds.push(lineId)
  }

  if (wantsPoint) {
    const circleId = `${layerId}-point`
    map.addLayer({
      id: circleId,
      type: 'circle',
      source: sourceId,
      ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
      filter: BASE_FILTERS['-point'],
      paint: withLayerOpacity(circleId, 'circle', paintForCircle(symbology), opacity),
      layout: { ...extraLayout(symbology, 'circle-'), visibility },
      ...zoomRange,
    }, before.point)
    sublayerIds.push(circleId)
  }

  // last, so labels draw on top
  if (label) {
    const labelId = addLabelLayer(map, {
      layerId,
      sourceId,
      sourceLayer,
      label,
      geometryType: spec.geometryType,
      visibility,
      beforeId: before.label,
      opacity,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom,
    })
    if (labelId) sublayerIds.push(labelId)
  }

  return sublayerIds
}

// a raw paint fits one layer type, so it can't go on all three
function rawPaintGeometry(layerId: string, symbology: Symbology): LayerGeometryType | undefined {
  const s = resolveSymbology(symbology)
  if (s.kind !== 'raw') return undefined
  const geom = geometryFromRawPaint(s)
  if (geom) return geom
  throw configError({
    where: `settings.layers["${layerId}"]`,
    why: "raw symbology without geometryType, and its paint doesn't point to one geometry",
    fix: "set geometryType to 'point', 'line' or 'polygon'",
  })
}
