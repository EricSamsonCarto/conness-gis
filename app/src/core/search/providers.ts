import { configError } from '../configError'
import type { GeocoderConfig, Settings } from '../types'

export interface GeocodeResult {
  label: string
  lng: number
  lat: number
  // [w, s, e, n], lets the widget fit a city/region
  bbox?: [number, number, number, number]
}

// nominatim's policy bans commercial use, and there's no keyless fallback
export function validateSearchConfig(settings: Settings): void {
  // the one part of Search's settings the engine reads
  const search = settings.widgets?.search as { geocoder?: GeocoderConfig } | undefined
  const provider = search?.geocoder?.provider
  if (settings.commercialUse && provider === 'nominatim') {
    throw configError({
      where: 'settings.widgets.search.geocoder.provider',
      why: "is 'nominatim', which isn't allowed when settings.commercialUse is true (Nominatim's usage policy prohibits commercial deployments)",
      fix: "set provider to 'maptiler' with an apiKey, or remove widgets.search.geocoder entirely",
    })
  }
}

const DEFAULT_LIMIT = 5
const NOMINATIM_DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const MAPTILER_DEFAULT_ENDPOINT = 'https://api.maptiler.com/geocoding'

// nominatim allows 1 request a second, enforced across calls
const NOMINATIM_MIN_INTERVAL_MS = 1000
let nominatimNextAvailableAt = 0

function reserveNominatimSlot(signal: AbortSignal): Promise<void> {
  const now = Date.now()
  const runAt = Math.max(now, nominatimNextAvailableAt)
  nominatimNextAvailableAt = runAt + NOMINATIM_MIN_INTERVAL_MS
  const delay = runAt - now
  if (delay <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delay)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        // never sent, so free its slot unless a later query booked after it
        if (nominatimNextAvailableAt === runAt + NOMINATIM_MIN_INTERVAL_MS) nominatimNextAvailableAt = runAt
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

async function geocodeNominatim(
  query: string,
  config: GeocoderConfig,
  signal: AbortSignal,
): Promise<GeocodeResult[]> {
  await reserveNominatimSlot(signal)

  const endpoint = config.endpoint ?? NOMINATIM_DEFAULT_ENDPOINT
  const url = new URL(endpoint)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'geojson')
  url.searchParams.set('limit', String(config.limit ?? DEFAULT_LIMIT))

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`)
  const data = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number] }
      properties: { display_name?: string; name?: string }
      bbox?: [number, number, number, number]
    }[]
  }

  return (data.features ?? []).map((f) => ({
    label: f.properties.display_name ?? f.properties.name ?? 'Unnamed place',
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    bbox: f.bbox,
  }))
}

async function geocodeMapTiler(
  query: string,
  config: GeocoderConfig,
  signal: AbortSignal,
): Promise<GeocodeResult[]> {
  if (!config.apiKey) {
    throw new Error(
      'MapTiler geocoder requires widgets.search.geocoder.apiKey.',
    )
  }
  const endpoint = config.endpoint ?? MAPTILER_DEFAULT_ENDPOINT
  const url = new URL(`${endpoint}/${encodeURIComponent(query)}.json`)
  url.searchParams.set('key', config.apiKey)
  url.searchParams.set('limit', String(config.limit ?? DEFAULT_LIMIT))

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`MapTiler error ${res.status}`)
  const data = (await res.json()) as {
    features?: {
      center?: [number, number]
      geometry: { coordinates: [number, number] }
      place_name?: string
      text?: string
      bbox?: [number, number, number, number]
    }[]
  }

  return (data.features ?? []).map((f) => {
    const [lng, lat] = f.center ?? f.geometry.coordinates
    return {
      label: f.place_name ?? f.text ?? 'Unnamed place',
      lng,
      lat,
      bbox: f.bbox,
    }
  })
}

export function geocode(
  query: string,
  config: GeocoderConfig,
  signal: AbortSignal,
): Promise<GeocodeResult[]> {
  switch (config.provider) {
    case 'nominatim':
      return geocodeNominatim(query, config, signal)
    case 'maptiler':
      return geocodeMapTiler(query, config, signal)
    default: {
      const exhaustive: never = config.provider
      throw new Error(`Unknown geocoder provider: ${JSON.stringify(exhaustive)}`)
    }
  }
}
