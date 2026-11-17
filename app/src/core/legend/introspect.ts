import type {
  LayerMetadata,
  LegendOverride,
  Symbology,
  SymbologyRaw,
  SymbologySimple,
  LayerGeometryType,
} from '../types'
import { geometryFromRawPaint, resolveSymbology } from '../layers/symbology'
import { formatNumber, sizeStops, type SizeStops } from './sizes'

export type LegendSwatch =
  | {
      kind: 'single'
      color: string
      strokeColor?: string
      strokeWidth?: number
      radius?: number
      width?: number
      // simple symbology only
      opacity?: number
      strokeOpacity?: number
      geometryType: LayerGeometryType | undefined
      // a data-driven dot radius or line width (raw paint), shown under the color
      sizes?: SizeStops
    }
  | {
      kind: 'categories'
      entries: { label: string; color: string; radius?: number; strokeColor?: string; strokeWidth?: number }[]
      geometryType: LayerGeometryType | undefined
      description?: string
      sizes?: SizeStops
    }
  | {
      kind: 'gradient'
      stops: { value: number | string; label?: string; color: string }[]
      description?: string
      sizes?: SizeStops
    }
  | { kind: 'hidden' }
  | { kind: 'unknown' }

const COLOR_PAINT_KEYS = ['circle-color', 'fill-color', 'line-color'] as const

function findColorExpression(paint: Record<string, unknown>): unknown | null {
  for (const key of COLOR_PAINT_KEYS) {
    const value = paint[key]
    if (Array.isArray(value)) return value
  }
  return null
}

// ['match', input, v1, out1, v2, out2, ..., fallback]
function categoriesFromMatch(
  expr: unknown[],
): { entries: { label: string; color: string }[] } | null {
  if (expr[0] !== 'match') return null
  // length 3 + 2N, as op, input, N pairs, fallback
  if (expr.length < 5 || (expr.length - 3) % 2 !== 0) return null
  const entries: { label: string; color: string }[] = []
  for (let i = 2; i < expr.length - 1; i += 2) {
    const value = expr[i]
    const color = expr[i + 1]
    if (typeof color !== 'string') return null
    // match can group several values in one array
    const label = Array.isArray(value) ? value.join(' / ') : String(value)
    entries.push({ label, color })
  }
  if (entries.length === 0) return null
  return { entries }
}

// ['interpolate', interpolation, input, stop1, out1, stop2, out2, ...]
function gradientFromInterpolate(
  expr: unknown[],
): Extract<LegendSwatch, { kind: 'gradient' }> | null {
  if (expr[0] !== 'interpolate') return null
  if (expr.length < 6 || (expr.length - 3) % 2 !== 0) return null
  const stops: { value: number; color: string }[] = []
  for (let i = 3; i < expr.length; i += 2) {
    const value = expr[i]
    const color = expr[i + 1]
    if (typeof value !== 'number' || typeof color !== 'string') return null
    stops.push({ value, color })
  }
  if (stops.length < 2) return null
  // label endpoints only, keeps the bar clean
  const labeled = stops.map((s, i) => ({
    ...s,
    label: i === 0 || i === stops.length - 1 ? formatNumber(s.value) : undefined,
  }))
  return { kind: 'gradient', stops: labeled }
}

function fromOverride(
  legend: LegendOverride,
  geometryType: LayerGeometryType | undefined,
  description?: string,
): LegendSwatch {
  if (legend.kind === 'hidden') return { kind: 'hidden' }
  if (legend.kind === 'categories') {
    return { kind: 'categories', entries: legend.entries, geometryType, description }
  }
  return { ...legend, description }
}

function introspectRaw(
  raw: SymbologyRaw,
  geometryType: LayerGeometryType | undefined,
): LegendSwatch {
  const description = raw.description
  if (raw.legend) return fromOverride(raw.legend, geometryType, description)
  const paint = raw.paint
  if (!paint) return { kind: 'unknown' }
  const sizes = sizeStops(paint) ?? undefined
  const expr = findColorExpression(paint)
  if (!expr || !Array.isArray(expr)) {
    for (const key of COLOR_PAINT_KEYS) {
      const v = paint[key]
      if (typeof v === 'string') return { kind: 'single', color: v, geometryType, sizes }
    }
    return { kind: 'unknown' }
  }
  const cats = categoriesFromMatch(expr)
  if (cats) return { kind: 'categories', entries: cats.entries, geometryType, description, sizes }
  const gradient = gradientFromInterpolate(expr)
  return gradient ? { ...gradient, description, sizes } : { kind: 'unknown' }
}

function fromSimple(
  s: SymbologySimple,
  geometryType: LayerGeometryType | undefined,
): LegendSwatch {
  return {
    kind: 'single',
    color: s.color,
    radius: s.radius,
    width: s.width,
    strokeColor: s.strokeColor,
    strokeWidth: s.strokeWidth,
    opacity: s.opacity,
    strokeOpacity: s.strokeOpacity,
    geometryType,
  }
}

export function legendForSymbology(
  symbology: Symbology,
  geometryType: LayerGeometryType | undefined,
): LegendSwatch {
  const concrete = resolveSymbology(symbology)
  if (concrete.kind === 'simple') return fromSimple(concrete, geometryType)
  // a raw paint draws one geometry, never mixed
  return introspectRaw(concrete, geometryType ?? geometryFromRawPaint(concrete) ?? undefined)
}

export function legendForLayer(layer: LayerMetadata): LegendSwatch | null {
  // rasters have no geometry, squares read as image coverage
  if (layer.legend) return fromOverride(layer.legend, layer.raster ? 'polygon' : layer.geometryType)
  if (layer.symbology) return legendForSymbology(layer.symbology, layer.geometryType)
  return null
}
