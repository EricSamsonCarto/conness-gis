// a data-driven size as legend stops. no imports, so tests run it in node

export type SizeStops = { kind: 'dot' | 'line'; stops: { value: number; size: number; label: string }[] }

// abs, so negative stops (diverging scales) shorten too
export function formatNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(n)
}

// an interpolate on data, not on ['zoom']
function stopsOf(expr: unknown): SizeStops['stops'] | null {
  if (!Array.isArray(expr) || expr[0] !== 'interpolate') return null
  if (expr.length < 7 || (expr.length - 3) % 2 !== 0) return null
  if (JSON.stringify(expr[2]) === '["zoom"]') return null
  const stops: SizeStops['stops'] = []
  for (let i = 3; i < expr.length; i += 2) {
    const value = expr[i]
    const size = expr[i + 1]
    if (typeof value !== 'number' || typeof size !== 'number') return null
    stops.push({ value, size, label: formatNumber(value) })
  }
  return stops
}

export function sizeStops(paint: Record<string, unknown>): SizeStops | null {
  const dots = stopsOf(paint['circle-radius'])
  if (dots) return { kind: 'dot', stops: dots }
  const lines = stopsOf(paint['line-width'])
  return lines ? { kind: 'line', stops: lines } : null
}
