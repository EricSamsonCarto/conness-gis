import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveTo, setOnMobile, turnOff, turnOn, whereOf, wheresFor } from '../editor/edits/placementEdits.ts'

const demo = () => ({
  topBarWidgets: [{ widgetName: 'measure' }],
  sidePanelWidgets: [{ widgetName: 'legend' }],
  floatingWidgets: [{ slot: 'top-left', widgets: [{ widgetName: 'search', order: -1 }] }],
  mobileWidgets: ['legend', 'measure'],
})

test('turnOn places a widget on the first place its manifest allows', () => {
  const s = demo()
  turnOn(s, 'draw', ['top-bar'])
  assert.deepEqual(s.topBarWidgets.at(-1), { widgetName: 'draw' })
  turnOn(s, 'coordinates', ['floating'])
  assert.equal(whereOf(s, 'coordinates'), 'floating:top-left')
  turnOn(s, 'measure', ['top-bar'])
  assert.equal(s.topBarWidgets.filter((p) => p.widgetName === 'measure').length, 1)
})

test('turnOff removes it everywhere and drops an empty floating slot', () => {
  const s = demo()
  turnOff(s, 'search')
  assert.deepEqual(s.floatingWidgets, [])
  turnOff(s, 'measure')
  assert.deepEqual(s.topBarWidgets, [])
  assert.deepEqual(s.mobileWidgets, ['legend'])
})

test('moveTo keeps the placement options', () => {
  const s = demo()
  moveTo(s, 'search', 'floating:bottom-right')
  assert.deepEqual(s.floatingWidgets, [{ slot: 'bottom-right', widgets: [{ widgetName: 'search', order: -1 }] }])
  moveTo(s, 'measure', 'side-panel')
  assert.equal(whereOf(s, 'measure'), 'side-panel')
})

test('setOnMobile adds once and removes', () => {
  const s = demo()
  setOnMobile(s, 'search', true)
  setOnMobile(s, 'search', true)
  assert.deepEqual(s.mobileWidgets, ['legend', 'measure', 'search'])
  setOnMobile(s, 'legend', false)
  assert.deepEqual(s.mobileWidgets, ['measure', 'search'])
  assert.deepEqual(wheresFor(['floating']), ['floating:top-left', 'floating:top-right', 'floating:bottom-left', 'floating:bottom-right'])
})
