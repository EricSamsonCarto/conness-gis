import type {
  Map as MapLibreMap,
  ExpressionSpecification,
  FilterSpecification,
} from 'maplibre-gl'
import { baseFilterFor } from './loaders/sublayers'
import { getPaint, OPACITY_PROPS, opacityBasesFor, scaled, setPaint } from './opacity'

// -shadow is Draw's drop shadow, it hides with Drawings
const SUBLAYER_SUFFIXES = ['-fill', '-line', '-point', '-label', '-raster', '-shadow'] as const

function sublayerIds(layerId: string): string[] {
  return SUBLAYER_SUFFIXES.map((suffix) => `${layerId}${suffix}`)
}

// labels toggle separately, includeLabel is for Draw's text drawings
export function setLayerVisibility(
  map: MapLibreMap,
  layerId: string,
  visible: boolean,
  includeLabel = false,
): void {
  const visibility = visible ? 'visible' : 'none'
  for (const id of sublayerIds(layerId)) {
    if (id.endsWith('-label') && !includeLabel) continue
    if (!map.getLayer(id)) continue
    map.setLayoutProperty(id, 'visibility', visibility)
  }
}

// 0 and 24 mean no limit. labelMin keeps a later label start
export function setLayerZoomRange(
  map: MapLibreMap,
  layerId: string,
  min: number | undefined,
  max: number | undefined,
  labelMin: number | undefined,
): void {
  for (const id of sublayerIds(layerId)) {
    if (!map.getLayer(id)) continue
    const from = id.endsWith('-label') ? Math.max(labelMin ?? 0, min ?? 0) : (min ?? 0)
    map.setLayerZoomRange(id, from, max ?? 24)
  }
}

export function setLabelVisibility(
  map: MapLibreMap,
  layerId: string,
  visible: boolean,
): void {
  const id = `${layerId}-label`
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export function setLayerOpacity(
  map: MapLibreMap,
  layerId: string,
  opacity: number,
): void {
  for (const id of sublayerIds(layerId)) {
    const layer = map.getLayer(id)
    if (!layer) continue
    const props = OPACITY_PROPS[layer.type as keyof typeof OPACITY_PROPS]
    if (!props) continue
    const bases = opacityBasesFor(id)
    for (const prop of props) {
      if (bases && prop in bases) {
        setPaint(map, id, prop, scaled(bases[prop], opacity))
        continue
      }
      // raw expression paint is the user's, leave it
      if (Array.isArray(getPaint(map, id, prop))) continue
      setPaint(map, id, prop, opacity)
    }
  }
}

// base from baseFilterFor, not the map, so repeat calls don't stack
export function setGeoJsonLayerFilter(
  map: MapLibreMap,
  layerId: string,
  filter: ExpressionSpecification | null,
): void {
  const suffixes = ['-fill', '-line', '-point', '-label'] as const
  for (const suffix of suffixes) {
    const id = `${layerId}${suffix}`
    if (!map.getLayer(id)) continue
    const base = suffix === '-label' ? undefined : baseFilterFor(id, suffix)
    let next: FilterSpecification | null
    if (base && filter) next = ['all', base, filter] as FilterSpecification
    else next = base ?? filter
    map.setFilter(id, next)
  }
}
