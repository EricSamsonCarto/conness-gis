import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadGeoJsonFeatures } from './geojsonFeatures.ts'

test('loadGeoJsonFeatures: a new url for the same layer reads the new file', async () => {
  const files: Record<string, unknown> = {
    'https://x/a.geojson': { type: 'Feature', geometry: null, properties: { from: 'a' } },
    'https://x/b.geojson': { type: 'Feature', geometry: null, properties: { from: 'b' } },
  }
  const fetched: string[] = []
  globalThis.fetch = (async (url: string) => {
    fetched.push(url)
    return new Response(JSON.stringify(files[url]))
  }) as typeof fetch

  const a = await loadGeoJsonFeatures('parks', 'https://x/a.geojson')
  await loadGeoJsonFeatures('parks', 'https://x/a.geojson')
  const b = await loadGeoJsonFeatures('parks', 'https://x/b.geojson')

  assert.equal(a[0].properties?.from, 'a')
  assert.equal(b[0].properties?.from, 'b')
  assert.deepEqual(fetched, ['https://x/a.geojson', 'https://x/b.geojson'])
})
