import { symbologies } from '@user/symbology'
import type { LayerGeometryType, Symbology, SymbologySimple, SymbologyRaw } from '../types'

type Paint = Record<string, unknown>

const DEFAULT_LINE_WIDTH = 2
const DEFAULT_CIRCLE_RADIUS = 5
const DEFAULT_CIRCLE_STROKE_COLOR = '#ffffff'
const DEFAULT_CIRCLE_STROKE_WIDTH = 1
const DEFAULT_POLYGON_STROKE_COLOR = '#ffffff'
const DEFAULT_POLYGON_STROKE_WIDTH = 0

export function resolveSymbology(symbology: Symbology): SymbologySimple | SymbologyRaw {
  if (symbology.kind !== 'ref') return symbology
  const resolved = symbologies[symbology.name]
  if (!resolved) {
    throw new Error(
      `Symbology ref "${symbology.name}" not found in your project's symbology.json. ` +
        `Available: ${Object.keys(symbologies).join(', ') || '(none)'}`,
    )
  }
  return resolved
}

export function paintForCircle(symbology: Symbology): Paint {
  const s = resolveSymbology(symbology)
  switch (s.kind) {
    case 'simple':
      return {
        'circle-color': s.color,
        'circle-radius': s.radius ?? DEFAULT_CIRCLE_RADIUS,
        'circle-opacity': s.opacity ?? 1,
        'circle-stroke-color': s.strokeColor ?? DEFAULT_CIRCLE_STROKE_COLOR,
        'circle-stroke-width': s.strokeWidth ?? DEFAULT_CIRCLE_STROKE_WIDTH,
        'circle-stroke-opacity': s.strokeOpacity ?? 1,
      }
    case 'raw':
      return ownKeys(s.paint, 'circle-')
  }
}

// the line layer doubles as polygon outline (stroke* fields)
export function paintForLine(symbology: Symbology, asPolygonOutline = false): Paint {
  const s = resolveSymbology(symbology)
  switch (s.kind) {
    case 'simple':
      return asPolygonOutline
        ? {
            'line-color': s.strokeColor ?? DEFAULT_POLYGON_STROKE_COLOR,
            'line-width': s.strokeWidth ?? DEFAULT_POLYGON_STROKE_WIDTH,
            'line-opacity': s.strokeOpacity ?? 1,
          }
        : {
            'line-color': s.color,
            'line-width': s.width ?? DEFAULT_LINE_WIDTH,
            'line-opacity': s.opacity ?? 1,
          }
    case 'raw':
      return ownKeys(s.paint, 'line-')
  }
}

export function paintForFill(symbology: Symbology): Paint {
  const s = resolveSymbology(symbology)
  switch (s.kind) {
    case 'simple':
      return {
        'fill-color': s.color,
        'fill-opacity': s.opacity ?? 1,
      }
    case 'raw':
      return ownKeys(s.paint, 'fill-')
  }
}

// unprefixed `visibility` is dropped, the layer list's toggle owns it
export function extraLayout(symbology: Symbology, prefix: 'fill-' | 'line-' | 'circle-'): Paint {
  const s = resolveSymbology(symbology)
  return s.kind === 'raw' ? ownKeys(s.layout, prefix) : {}
}

export function rawHasOutline(s: SymbologyRaw): boolean {
  return Object.keys(s.paint ?? {}).some((k) => k.startsWith('line-'))
}

// MapLibre rejects keys for other layer types (raw mixes fill-/line-)
function ownKeys(props: Paint | undefined, prefix: string): Paint {
  return Object.fromEntries(Object.entries(props ?? {}).filter(([k]) => k.startsWith(prefix)))
}

export function geometryFromRawPaint(s: SymbologyRaw): LayerGeometryType | null {
  const kinds = new Set(
    Object.keys(s.paint ?? {}).map((k) =>
      k.startsWith('circle-') ? 'point' : k.startsWith('fill-') ? 'polygon' : k.startsWith('line-') ? 'line' : null,
    ),
  )
  // fill and line make a polygon with a styled outline
  if (kinds.has('polygon')) kinds.delete('line')
  if (kinds.size === 1 && !kinds.has(null)) return [...kinds][0] as LayerGeometryType
  return null
}

