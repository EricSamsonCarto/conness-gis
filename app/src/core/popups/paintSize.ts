import type { ExpressionSpecification } from 'maplibre-gl'

export type Size = number | ExpressionSpecification

// MapLibre allows ['zoom'] only in a top-level interpolate or step
export const isZoomCurve = (v: unknown): v is unknown[] =>
  Array.isArray(v) &&
  ((v[0] === 'interpolate' && JSON.stringify(v[2]) === '["zoom"]') ||
    (v[0] === 'step' && JSON.stringify(v[1]) === '["zoom"]'))

// a zoom curve gets `add` on each output, so the curve stays top-level
export function plus(value: Size, add: Size): Size {
  if (typeof value === 'number' && typeof add === 'number') return value + add
  if (isZoomCurve(value)) {
    // outputs start at index 4 (interpolate) or 2 (step), then every other
    const first = value[0] === 'interpolate' ? 4 : 2
    return value.map((v, i) => (i >= first && (i - first) % 2 === 0 ? plus(v as Size, add) : v)) as Size
  }
  return ['+', value, add] as ExpressionSpecification
}
