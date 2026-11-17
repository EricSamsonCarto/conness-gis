import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedPaths, isLive, liveChanges } from '../editor/preview/liveAreas.ts'

const base = () => ({
  settings: { branding: { title: 'Parks' }, ui: { textSizes: { large: 14 }, topBar: { height: 56 } } },
  theme: { colors: { primary: 'blue-700' } },
  layers: { layers: [{ id: 'a', symbology: { kind: 'simple', color: '#fff' } }] },
})

test('changedPaths: the leaves that differ; a list of the same ids item by item, else one leaf', () => {
  const after = base()
  after.theme.colors.primary = 'red-600'
  after.layers.layers[0].symbology.color = '#000'
  assert.deepEqual(changedPaths(base(), after).sort(), ['layers:layers.0.symbology.color', 'theme:colors.primary'])
  const added = base()
  added.layers.layers.push({ id: 'b', symbology: { kind: 'simple', color: '#fff' } })
  assert.deepEqual(changedPaths(base(), added), ['layers:layers'])
})

test('isLive: only theme, title and the CSS-variable sizes', () => {
  const live = base()
  live.theme.colors.primary = 'red-600'
  live.settings.ui.textSizes.large = 16
  live.settings.branding.title = 'City Parks'
  assert.equal(isLive(base(), live), true)

  const duckdb = base()
  ;(duckdb.settings as Record<string, unknown>).duckdb = { bundleUrl: 'x' }
  assert.equal(isLive(base(), duckdb), false)

  const mixed = base()
  mixed.theme.colors.primary = 'red-600'
  ;(mixed.settings as Record<string, unknown>).duckdb = { bundleUrl: 'x' }
  assert.equal(isLive(base(), mixed), false)

  assert.equal(isLive(base(), base()), false)
})

test('isLive: every layers.json change, symbology.json and group settings', () => {
  const layers = (list: Record<string, unknown>[]) => ({ layers: { layers: list } })
  const red = { kind: 'simple', color: '#f00' }
  assert.equal(isLive(layers([{ id: 'a', type: 'pmtiles', raster: true }]), layers([{ id: 'a', type: 'pmtiles', raster: true, minZoom: 4 }])), true)
  // added, removed, moved, re-sourced
  assert.equal(isLive(layers([{ id: 'a', symbology: red }]), layers([{ id: 'a', symbology: red }, { id: 'b' }])), true)
  assert.equal(isLive(layers([{ id: 'a' }, { id: 'b' }]), layers([{ id: 'b' }, { id: 'a' }])), true)
  assert.equal(isLive(layers([{ id: 'a', url: 'a.geojson' }]), layers([{ id: 'a', url: 'b.geojson' }])), true)
  assert.equal(isLive({ symbology: { roads: red } }, { symbology: { roads: { ...red, color: '#00f' } } }), true)
  assert.equal(isLive({ settings: { layerGroups: {} } }, { settings: { layerGroups: { Roads: { collapsed: false } } } }), true)
})

test('isLive: what the shell and widgets read while drawing, and popups', () => {
  const settings = (s: Record<string, unknown>) => ({ settings: s })
  assert.equal(isLive(settings({ ui: { popups: { trigger: 'click' } } }), settings({ ui: { popups: { trigger: 'hover' } } })), true)
  assert.equal(isLive(settings({ widgets: { search: { placeholder: 'a' } } }), settings({ widgets: { search: { placeholder: 'b' } } })), true)
  assert.equal(isLive(settings({ widgets: { measure: { precision: 2 } } }), settings({ widgets: { measure: { precision: 3 } } })), true)
  const layer = (popup: unknown) => ({ layers: { layers: [{ id: 'a', type: 'geojson', symbology: { kind: 'simple', color: '#f00' }, popup }] } })
  assert.equal(isLive(layer({ title: 'name' }), layer({ title: 'city' })), true)
})

test('liveChanges: only the live part of a draft, the rest left as before', () => {
  const after = base()
  after.theme.colors.primary = 'red-600'
  ;(after.settings as Record<string, unknown>).duckdb = { bundleUrl: 'x' }
  const live = liveChanges(base(), after)!
  assert.equal((live.theme as typeof after.theme).colors.primary, 'red-600')
  assert.equal((live.settings as Record<string, unknown>).duckdb, undefined)
  assert.equal(liveChanges(base(), base()), null)
})

test('isLive: settings only read at startup need no reload', () => {
  const settings = (s: Record<string, unknown>) => ({ settings: s })
  assert.equal(isLive(settings({ map: { zoom: 4 } }), settings({ map: { zoom: 6 } })), true)
  assert.equal(isLive(settings({ map: { minZoom: 2 } }), settings({ map: { minZoom: 4 } })), true)
  assert.equal(isLive(settings({ duckdb: {} }), settings({ duckdb: { bundleUrl: 'x' } })), false)
})

test('isLive: basemaps and map controls, except what the app builds at load', () => {
  const basemaps = (list: Record<string, unknown>[]) => ({ basemaps: { basemaps: list } })
  assert.equal(isLive(basemaps([{ id: 'a', style: 'x' }]), basemaps([{ id: 'a', style: 'y' }])), true)
  assert.equal(isLive(basemaps([{ id: 'a', thumbnail: 'a.jpg' }]), basemaps([{ id: 'a', thumbnail: 'b.jpg' }])), false)
  assert.equal(isLive(basemaps([{ id: 'a' }]), basemaps([{ id: 'a' }, { id: 'b' }])), false)
  assert.equal(isLive(basemaps([{ id: 'a' }, { id: 'b' }]), basemaps([{ id: 'b' }, { id: 'a' }])), true)
  assert.equal(isLive(basemaps([{ id: 'a' }, { id: 'b' }]), basemaps([{ id: 'b' }])), true)
  const controls = (c: Record<string, unknown>) => ({ settings: { mapControls: c } })
  assert.equal(isLive(controls({}), controls({ scale: {} })), true)
  assert.equal(isLive(controls({}), controls({ terrain: {} })), true)
})

test('a group on one side only: its leaves, and removed with them', () => {
  const settings = (s: Record<string, unknown>) => ({ settings: s })
  const sized = settings({ ui: { floatingControls: { iconSize: 21 } } })
  assert.deepEqual(changedPaths(settings({ ui: {} }), sized), ['settings:ui.floatingControls.iconSize'])
  assert.equal(isLive(settings({}), sized), true)
  assert.equal(isLive(sized, settings({})), true)
  assert.deepEqual(liveChanges(sized, settings({ ui: {} })), settings({ ui: {} }))

  const globe = (g?: unknown) => settings({ mapControls: g === undefined ? {} : { globe: g } })
  assert.deepEqual(changedPaths(globe(), globe({})), ['settings:mapControls.globe'])
  assert.deepEqual(liveChanges(globe({ spin: true }), globe()), globe())
  assert.deepEqual(liveChanges(globe({ spin: true }), globe({})), globe({}))

  const mixed = settings({ ui: { floatingControls: { iconSize: 21 } }, duckdb: { bundleUrl: 'x' } })
  assert.equal(isLive(settings({}), mixed), false)
})
