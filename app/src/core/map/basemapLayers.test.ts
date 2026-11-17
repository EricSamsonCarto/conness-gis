import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { StyleSpecification } from 'maplibre-gl'
import { basemapParts } from './basemapLayers.ts'

const style = {
  version: 8,
  glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
  sprite: [{ id: 'base', url: 'https://example.com/sprites/base' }],
  projection: { type: 'globe' },
  sky: {},
  terrain: { source: 'dem' },
  sources: {
    tiles: { type: 'vector', url: 'https://example.com/tiles.json' },
    dem: { type: 'raster-dem', url: 'https://example.com/dem.json' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', source: 'tiles', 'source-layer': 'water' },
  ],
} as StyleSpecification

test('prefixes source and layer ids and rewrites layer sources', () => {
  const parts = basemapParts(style)
  assert.deepEqual(Object.keys(parts.sources), ['basemap:tiles', 'basemap:dem'])
  assert.deepEqual(parts.layers.map((l) => l.id), ['basemap:bg', 'basemap:water'])
  assert.equal((parts.layers[1] as { source: string }).source, 'basemap:tiles')
  assert.equal('source' in parts.layers[0], false)
})

test('passes glyphs and sprite through and leaves out projection, sky and terrain', () => {
  const parts = basemapParts(style)
  assert.equal(parts.glyphs, style.glyphs)
  assert.deepEqual(parts.sprite, style.sprite)
  assert.equal('projection' in parts, false)
  assert.equal('sky' in parts, false)
  assert.equal('terrain' in parts, false)
})
