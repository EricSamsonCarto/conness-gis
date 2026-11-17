import type { LngLatBoundsLike } from 'maplibre-gl'

// fitBounds throws on bad extents (bad pmtiles header, projected esri CRS)
export function isValidLngLatBounds(
  bounds: LngLatBoundsLike | undefined,
): bounds is LngLatBoundsLike {
  if (!bounds || !Array.isArray(bounds) || bounds.length !== 4) return false
  const [minLon, minLat, maxLon, maxLat] = bounds
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return false
  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return false
  if (minLon >= maxLon || minLat >= maxLat) return false
  return true
}
