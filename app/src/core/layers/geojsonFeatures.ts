// one shared fetch, querySourceFeatures only sees loaded tiles
const featureCache = new Map<string, Promise<GeoJSON.Feature[]>>()

export function loadGeoJsonFeatures(
  layerId: string,
  url: string,
): Promise<GeoJSON.Feature[]> {
  // the url too, so a layer whose file changed live reads the new one
  const key = `${layerId}\n${url}`
  const cached = featureCache.get(key)
  if (cached) return cached

  const promise = (async () => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch "${layerId}": ${res.status}`)
    const data = (await res.json()) as GeoJSON.GeoJSON
    return data.type === 'FeatureCollection'
      ? data.features
      : data.type === 'Feature'
        ? [data]
        : []
  })().catch((err: unknown) => {
    // evict so a later call retries
    featureCache.delete(key)
    throw err
  })

  featureCache.set(key, promise)
  return promise
}
