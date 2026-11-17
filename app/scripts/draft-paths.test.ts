import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearestEntry, removeAt, setAt } from '../editor/edits/draftPaths.ts'

test('setAt creates the parents it needs', () => {
  const json: Record<string, unknown> = { map: { zoom: 2 } }
  setAt(json, 'map.globe.enabled', true)
  assert.deepEqual(json, { map: { zoom: 2, globe: { enabled: true } } })
})

test('removeAt prunes parents it leaves empty, and nothing else', () => {
  const json: Record<string, unknown> = { ui: { topBar: { shadow: { enabled: true }, height: 56 } } }
  removeAt(json, 'ui.topBar.shadow.enabled')
  assert.deepEqual(json, { ui: { topBar: { height: 56 } } })
  removeAt(json, 'ui.topBar.height')
  assert.deepEqual(json, {})
  removeAt(json, 'not.there')
  assert.deepEqual(json, {})
})

test('nearestEntry: the setting itself, else the closest row above it', () => {
  const rows = ['settings:ui.popups.height', 'settings:draw.defaultStyle.*', 'settings:contextMenu.custom']
  assert.equal(nearestEntry('settings:ui.popups.height', rows), 'settings:ui.popups.height')
  assert.equal(nearestEntry('settings:draw.defaultStyle.width', rows), 'settings:draw.defaultStyle.*')
  assert.equal(nearestEntry('settings:contextMenu.custom.0.url', rows), 'settings:contextMenu.custom')
  assert.equal(nearestEntry('settings:mystery', rows), undefined)
})
