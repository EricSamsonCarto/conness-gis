import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { layersSchema } from '../src/core/schema/layers.ts'
import { inlineRefs, resolve, walk, type Node } from '../editor/settings/schemaNodes.ts'

const raw = z.toJSONSchema(z.object({ layers: layersSchema }), { target: 'draft-7', io: 'input', unrepresentable: 'any' }) as Node
const root = inlineRefs(raw)
const at = (layer: Record<string, unknown>, key: string) => walk(root, ['layers', '0', key], { layers: [layer] })

test('walk: a layer field comes from that layer type, not the first type with the key', () => {
  assert.match(at({ type: 'geojson' }, 'url')?.description ?? '', /geojson/)
  assert.match(at({ type: 'esri', service: 'feature' }, 'url')?.description ?? '', /FeatureServer/)
  assert.match(at({ type: 'esri', service: 'dynamic' }, 'url')?.description ?? '', /MapServer/)
  assert.equal(at({ type: 'tiles' }, 'maxTileZoom')?.default, 14)
  // no data: the first variant with the key, as before
  assert.ok(walk(root, ['layers', '0', 'url'], undefined))
})

test('resolve: a nested union (PMTiles vector / raster) gives that variant its own fields', () => {
  const items = walk(root, ['layers', '0'], undefined)!
  const vector = Object.keys(resolve(items, { type: 'pmtiles' }).properties ?? {})
  const raster = Object.keys(resolve(items, { type: 'pmtiles', raster: true }).properties ?? {})
  assert.ok(vector.includes('encoding') && !vector.includes('tileSize'))
  assert.ok(raster.includes('tileSize') && !raster.includes('encoding'))
})

test('inlineRefs: shared schemas written once under definitions are walked like inline ones', () => {
  assert.ok(JSON.stringify(raw).includes('#/definitions/popup'))
  assert.ok(!JSON.stringify(root).includes('$ref'))
  assert.equal(walk(root, ['layers', '0', 'popup', 'trigger'], { layers: [{ type: 'geojson', popup: {} }] })?.description, 'Click or hover.')
  assert.ok(walk(root, ['layers', '0', 'label', 'fontSize'], { layers: [{ type: 'geojson', label: {} }] })?.description)
})
