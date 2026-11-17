import type { AllPaintProperties, Map as MapLibreMap } from 'maplibre-gl'

// paint built at runtime from config, MapLibre's style validation checks it
export function setPaint(map: MapLibreMap, id: string, prop: string, value: unknown): void {
  map.setPaintProperty(id, prop as keyof AllPaintProperties, value as never)
}

export function getPaint(map: MapLibreMap, id: string, prop: string): unknown {
  return map.getPaintProperty(id, prop as keyof AllPaintProperties)
}

export const OPACITY_PROPS: Record<string, string[]> = {
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['text-opacity'],
  raster: ['raster-opacity'],
}

// base opacities per kit sublayer, which the slider multiplies
// others (Draw, esri-gl, rasters) have none and are set directly
const opacityBases = new Map<string, Record<string, unknown>>()

// zoom expressions must stay top-level, so they can't be wrapped
export function scaled(base: unknown, multiplier: number): unknown {
  if (typeof base === 'number') return base * multiplier
  if (JSON.stringify(base).includes('["zoom"]')) return base
  return ['*', base, multiplier]
}

export function withLayerOpacity(
  sublayerId: string,
  layerType: keyof typeof OPACITY_PROPS,
  basePaint: Record<string, unknown>,
  multiplier: number,
): Record<string, unknown> {
  const bases: Record<string, unknown> = {}
  const paint = { ...basePaint }
  for (const prop of OPACITY_PROPS[layerType] ?? []) {
    const base = basePaint[prop] ?? 1
    bases[prop] = base
    paint[prop] = scaled(base, multiplier)
  }
  opacityBases.set(sublayerId, bases)
  return paint
}

export function opacityBasesFor(sublayerId: string): Record<string, unknown> | undefined {
  return opacityBases.get(sublayerId)
}
