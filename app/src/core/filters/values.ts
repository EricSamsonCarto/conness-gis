import type { FilterValue } from '../types'

export function sortDistinct(values: unknown[]): FilterValue[] {
  const seen = new Set<FilterValue>()
  for (const v of values) {
    if (typeof v === 'number' || typeof v === 'boolean') seen.add(v)
    else if (typeof v === 'string' && v.trim() !== '') seen.add(v)
  }
  return [...seen].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), undefined, { numeric: true })
  })
}

export function distinctFromFeatures(
  features: GeoJSON.Feature[],
  column: string,
): FilterValue[] {
  return sortDistinct(features.map((f) => f.properties?.[column]))
}

// reopening the Filter panel shouldn't refetch, failures are evicted
const valuesCache = new Map<string, Promise<FilterValue[]>>()

export function cachedValues(
  layerId: string,
  column: string,
  load: () => Promise<FilterValue[]>,
): Promise<FilterValue[]> {
  const key = `${layerId}:${column}`
  const cached = valuesCache.get(key)
  if (cached) return cached
  const promise = load().catch((err: unknown) => {
    valuesCache.delete(key)
    throw err
  })
  valuesCache.set(key, promise)
  return promise
}
