import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sizeStops } from './sizes.ts'

test('sizeStops: a data-driven radius gives a dot per stop', () => {
  const paint = { 'circle-radius': ['interpolate', ['linear'], ['get', 'eq_magnitude'], 2, 2, 5, 4, 6.5, 7, 7.5, 11, 9, 18] }
  assert.deepEqual(sizeStops(paint), {
    kind: 'dot',
    stops: [
      { value: 2, size: 2, label: '2' },
      { value: 5, size: 4, label: '5' },
      { value: 6.5, size: 7, label: '6.5' },
      { value: 7.5, size: 11, label: '7.5' },
      { value: 9, size: 18, label: '9' },
    ],
  })
})

test('sizeStops: a data-driven line width gives lines, labels shortened', () => {
  const paint = { 'line-width': ['interpolate', ['linear'], ['get', 'lanes'], 1000, 1, 20000, 6] }
  assert.deepEqual(sizeStops(paint), {
    kind: 'line',
    stops: [
      { value: 1000, size: 1, label: '1.0k' },
      { value: 20000, size: 6, label: '20k' },
    ],
  })
})

test('sizeStops: zoom curves, plain numbers and matches are not data-driven sizes', () => {
  assert.equal(sizeStops({ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 12, 8] }), null)
  assert.equal(sizeStops({ 'circle-radius': 5 }), null)
  assert.equal(sizeStops({ 'circle-radius': ['match', ['get', 'k'], 'a', 4, 6] }), null)
  assert.equal(sizeStops({}), null)
})
