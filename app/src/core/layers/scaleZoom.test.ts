import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scaleToZoom } from './scaleZoom.ts'

test('scaleToZoom: a scale denominator as a zoom level; 0 and junk are no limit', () => {
  assert.equal(Math.round(scaleToZoom(1000000)! * 10) / 10, 9.2)
  assert.equal(Math.round(scaleToZoom(591657527.591555)! * 1000) / 1000, 0)
  assert.equal(scaleToZoom(0), undefined)
  assert.equal(scaleToZoom(undefined), undefined)
})
