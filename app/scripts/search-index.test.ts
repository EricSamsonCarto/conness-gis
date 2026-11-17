import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allEntries, allSections, isPanel, type PanelEntry } from '../editor/settings/settingsMap.ts'
import { buildIndex, search } from '../editor/settings/searchIndex.ts'
import { widgetSections } from '../editor/settings/widgetSections.ts'
import { loadWidgetModules } from './widget-settings.ts'

const layers = [{ id: 'airports', name: 'US Major Airports', type: 'geojson' }]
// the widgets' blocks, built from their settings.ts as the editor builds them
const sections = widgetSections(
  loadWidgetModules().flatMap((m) => (m.settings ? [{ id: m.about.id, label: m.about.label, schema: m.settings }] : [])),
)
const index = buildIndex(layers, sections)
const labels = (query: string, placed: string[] = []) => search(index, query, placed).map((r) => r.label)

test('a setting is found by its label or its JSON key', () => {
  assert.ok(labels('max zoom').includes('Max zoom'))
  assert.equal(search(index, 'maxZoom', []).find((r) => r.target === 'settings:map.maxZoom')?.label, 'Max zoom')
})

test('the whole name ranks first; sections and pop-out links are found too', () => {
  assert.equal(labels('globe')[0], 'Globe')
  assert.ok(labels('colors').includes('Edit individual colors'))
})

test('a layer is found by its name and opens the Layers pop-out at it', () => {
  const [hit] = search(index, 'airport', [])
  assert.equal(hit.kind, 'layer')
  assert.deepEqual(
    hit.panels.map((p) => p.panel),
    ['layers', 'layer:airports'],
  )
})

test("a widget's settings are flagged when the widget isn't placed", () => {
  const units = search(index, 'linear unit', [])
  assert.ok(units.length > 0 && units.every((r) => r.notPlaced))
  assert.ok(search(index, 'linear unit', ['measure']).every((r) => !r.notPlaced))
})

test('a pop-out link opens its pop-out', () => {
  const reorder = search(index, 'reorder widgets', []).find((r) => r.kind === 'panel')
  assert.deepEqual(
    reorder?.panels.map((p) => p.panel),
    ['placement-order'],
  )
})

test('every setting shown as a row is searchable, and section names are unique', () => {
  const targets = new Set(index.map((e) => e.target))
  // settings inside a custom screen (layers, basemaps…) are listed there, not as rows
  const inScreens = new Set(
    allEntries()
      .filter((e): e is PanelEntry => isPanel(e) && Boolean(e.screen))
      .flatMap((p) => p.sections.flatMap((s) => s.settings)),
  )
  const missing = allEntries()
    .filter((e) => !isPanel(e) && !inScreens.has(e))
    .map((e) => ('path' in e ? e.path : ''))
    .filter((path) => !targets.has(path))
  assert.deepEqual(missing, [])
  // widget blocks reveal by section name too, so theirs count
  const names = [...allSections(), ...sections].flatMap((s) => (s.name ? [s.name] : []))
  assert.equal(new Set(names).size, names.length)
})
