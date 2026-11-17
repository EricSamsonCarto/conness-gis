import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isZoomCurve, plus } from './paintSize.ts'

test('plus adds to a plain size', () => {
  assert.equal(plus(6, 4), 10)
})

test('plus wraps a data-driven size', () => {
  const size = ['get', 'radius'] as never
  assert.deepEqual(plus(size, 4), ['+', ['get', 'radius'], 4])
})

test('plus adds to every output of a zoom interpolate, keeping it top-level', () => {
  const size = ['interpolate', ['linear'], ['zoom'], 4, 2, 12, 8] as never
  assert.deepEqual(plus(size, 3), ['interpolate', ['linear'], ['zoom'], 4, 5, 12, 11])
})

test('plus adds to the base and every output of a zoom step', () => {
  const size = ['step', ['zoom'], 2, 10, 6] as never
  assert.deepEqual(plus(size, 3), ['step', ['zoom'], 5, 10, 9])
})

test('a data-driven interpolate is not a zoom curve', () => {
  assert.equal(isZoomCurve(['interpolate', ['linear'], ['get', 'pop'], 0, 2, 100, 8]), false)
  assert.equal(isZoomCurve(['interpolate', ['linear'], ['zoom'], 0, 2]), true)
})
