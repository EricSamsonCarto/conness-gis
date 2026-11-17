// checks a URL from the browser, the way the app will fetch it
// a one-layer FeatureServer gets its layer number
export type SourceCheck = { ok: true; kind?: string; url?: string } | { ok: false; why: string }

const fail = (why: string): SourceCheck => ({ ok: false, why })

async function get(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    // a network failure and a missing CORS header look the same from here
    throw new Error(
      "the browser couldn't read it: the server may be down, blocking requests, or not allowing other sites to use it (CORS)",
    )
  }
}

export async function checkSource(kind: string, url: string): Promise<SourceCheck> {
  const bare = url.split(/[?#]/)[0].replace(/\/+$/, '')
  try {
    if (kind.startsWith('esri')) {
      const res = await get(`${bare}?f=json`)
      if (!res.ok) return fail(`the server answered ${res.status}`)
      const info = await res.json().catch(() => null)
      if (!info) return fail("its answer isn't an Esri service description")
      if (info.error) return fail(`the service says: ${info.error.message ?? info.error.code}`)
      if (/\/(feature|map)server\/\d+$/i.test(bare)) return { ok: true, kind: 'esri-feature' }
      if (/\/featureserver$/i.test(bare)) {
        const layers = (info.layers ?? []) as { id: number; name: string }[]
        if (layers.length === 1) return { ok: true, kind: 'esri-feature', url: `${bare}/${layers[0].id}` }
        return fail(
          `a FeatureServer URL needs the layer number at the end: ${layers.map((l) => `/${l.id} for ${l.name}`).join(', ') || 'e.g. /0'}`,
        )
      }
      if (/\/mapserver$/i.test(bare)) return { ok: true, kind: info.singleFusedMapCache ? 'esri-tiled' : 'esri-dynamic' }
      return { ok: true }
    }
    if (kind.startsWith('tiles')) {
      if (url.includes('{z}')) {
        const res = await get(url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0'))
        await res.body?.cancel()
        return res.ok
          ? { ok: true }
          : fail(`a test tile (0/0/0) answered ${res.status}, which is fine if the server has no tiles at zoom 0`)
      }
      const res = await get(url)
      if (!res.ok) return fail(`the server answered ${res.status}`)
      const tilejson = await res.json().catch(() => null)
      return Array.isArray(tilejson?.tiles)
        ? { ok: true }
        : fail("it isn't a TileJSON (no tiles list), and a tile template needs {z}, {x} and {y}")
    }
    // these three read in pieces, so the server must answer range requests
    const ranged = /^(pmtiles|flatgeobuf|geoparquet)/.test(kind)
    const res = await get(url, ranged ? { headers: { Range: 'bytes=0-0' } } : undefined)
    // only the headers were needed
    await res.body?.cancel()
    if (!res.ok) return fail(`the server answered ${res.status}`)
    if (kind.startsWith('pmtiles') && res.status !== 206) return fail("the server doesn't answer range requests, which PMTiles needs")
    return { ok: true }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
