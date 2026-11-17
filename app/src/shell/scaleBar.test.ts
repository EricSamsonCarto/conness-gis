import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scaleFor } from './scaleBar.ts'

test('scaleFor: metric rounds down to 1, 2, 3 or 5 and switches to km', () => {
  assert.deepEqual(scaleFor(1200, 'metric'), { distance: 1, unit: 'km', ratio: 1 / 1.2 })
  assert.deepEqual(scaleFor(740, 'metric'), { distance: 500, unit: 'm', ratio: 500 / 740 })
  assert.equal(scaleFor(29, 'metric').distance, 20)
})

test('scaleFor: imperial in feet, then miles past one mile', () => {
  const short = scaleFor(100, 'imperial')
  assert.equal(short.unit, 'ft')
  assert.equal(short.distance, 300)
  const long = scaleFor(5000, 'imperial')
  assert.equal(long.unit, 'mi')
  assert.equal(long.distance, 3)
})

test('scaleFor: nautical miles, and fractions under one', () => {
  assert.deepEqual(scaleFor(1852 * 4, 'nautical'), { distance: 3, unit: 'nm', ratio: 3 / 4 })
  assert.equal(scaleFor(926, 'nautical').distance, 0.5)
})
