import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  freeSlug,
  guessKind,
  flatRows,
  kindOf,
  landing,
  layerItems,
  move,
  moveRow,
  newLayer,
  placeEmptyGroups,
  renameGroup,
  sectionTarget,
  setCornerOrder,
  simpleFields,
  ungroup,
  unusedColor,
} from '../editor/edits/listEdits.ts'

test('move: shifts one item and leaves the rest in order', () => {
  const list = ['a', 'b', 'c', 'd']
  move(list, 0, 2)
  assert.deepEqual(list, ['b', 'c', 'a', 'd'])
  move(list, 3, 0)
  assert.deepEqual(list, ['d', 'b', 'c', 'a'])
})

test('move: out of range does nothing', () => {
  const list = ['a', 'b']
  move(list, 0, 5)
  move(list, -1, 0)
  assert.deepEqual(list, ['a', 'b'])
})

test('setCornerOrder: controls and floating widgets get 10, 20, 30 in stack order', () => {
  const settings = {
    mapControls: { navigation: { position: 'top-left' } } as Record<string, { order?: number } | undefined>,
    floatingWidgets: [
      { slot: 'top-left', widgets: [{ widgetName: 'search' }, { widgetName: 'measure' }] as { widgetName: string; order?: number }[] },
    ],
  }
  setCornerOrder(settings, [
    { kind: 'widget', id: 'measure', param: 'floatingWidgets|0|1' },
    { kind: 'control', key: 'navigation' },
    { kind: 'widget', id: 'search', param: 'floatingWidgets|0|0' },
  ])
  assert.equal(settings.floatingWidgets[0].widgets[1].order, 10)
  assert.equal(settings.mapControls.navigation?.order, 20)
  assert.equal(settings.floatingWidgets[0].widgets[0].order, 30)
})

test('setCornerOrder: the credits button gets a block of its own', () => {
  const settings: { mapControls?: Record<string, { order?: number } | undefined> } = {}
  setCornerOrder(settings, [{ kind: 'control', key: 'attribution' }])
  assert.deepEqual(settings.mapControls, { attribution: { order: 10 } })
})

test('freeSlug: lowercase dashes, a number on a clash', () => {
  assert.equal(freeSlug('Mount Conness (OSM)', [], 'basemap'), 'mount-conness-osm')
  assert.equal(freeSlug('Topo', ['topo', 'topo-2'], 'basemap'), 'topo-3')
  assert.equal(freeSlug('!!!', [], 'basemap'), 'basemap')
  assert.equal(freeSlug('東京', ['layer'], 'layer'), 'layer-2')
})

// a, [roads: b, c], d, with c listed apart from b in the file
type L = { id: string; group?: string }
const sample = (): L[] => [{ id: 'a' }, { id: 'b', group: 'roads' }, { id: 'd' }, { id: 'c', group: 'roads' }]
const ids = (layers: { id: string }[]) => layers.map((l) => l.id)

test('layerItems: a group sits at its first layer, its layers together', () => {
  assert.deepEqual(layerItems(sample()), [
    { kind: 'layer', id: 'a' },
    { kind: 'group', name: 'roads', ids: ['b', 'c'] },
    { kind: 'layer', id: 'd' },
  ])
})

test('layerItems: an empty group sits at its saved position', () => {
  assert.deepEqual(layerItems(sample(), { roads: {}, empty: { position: 1 } }), [
    { kind: 'layer', id: 'a' },
    { kind: 'group', name: 'empty', ids: [] },
    { kind: 'group', name: 'roads', ids: ['b', 'c'] },
    { kind: 'layer', id: 'd' },
  ])
})

// rows: a, [roads], b, c, d
test('moveRow: a layer joins the group of the row above it, or leaves', () => {
  const layers = sample()
  const groups = {}
  moveRow(layers, groups, 0, 1)
  assert.deepEqual(ids(layers), ['a', 'b', 'c', 'd'])
  assert.equal(layers[0].group, 'roads')
  moveRow(layers, groups, 1, 4)
  assert.deepEqual(ids(layers), ['b', 'c', 'd', 'a'])
  assert.equal(layers[3].group, undefined)
})

test('moveRow: a group moves whole and snaps out of another group', () => {
  const layers = sample()
  const groups = {}
  moveRow(layers, groups, 1, 0)
  assert.deepEqual(ids(layers), ['b', 'c', 'a', 'd'])
  // emptied by dragging its last layers out, it keeps a spot
  moveRow(layers, groups, 2, 4)
  moveRow(layers, groups, 1, 3)
  assert.deepEqual(ids(layers), ['a', 'd', 'b', 'c'])
  assert.deepEqual(groups, { roads: { position: 0 } })
  const more = [{ id: 'x', group: 'g' }, { id: 'y', group: 'g' }]
  const empty = { e: { position: 1 } }
  // e dropped between x and y snaps above g
  moveRow(more, empty, 3, 2)
  assert.deepEqual(empty, { e: { position: 0 } })
})

test('moveRow: a layer dragged left leaves its group, landing just below it', () => {
  const layers = sample()
  const groups = {}
  // b, the first of roads, out: below c
  moveRow(layers, groups, 2, 2, true)
  assert.deepEqual(ids(layers), ['a', 'c', 'b', 'd'])
  assert.equal(layers[2].group, undefined)
  // the last group in the list too
  const last = [{ id: 'x', group: 'g' }]
  moveRow(last, {}, 1, 1, true)
  assert.equal(last[0].group, undefined)
})

test('landing: the group a drop joins, as the drag preview shows it', () => {
  // rows: a, [roads], b, c, d
  const rows = flatRows(layerItems(sample()))
  assert.deepEqual(landing(rows, 0, 1, false), { at: 1, group: 'roads' })
  assert.deepEqual(landing(rows, 4, 3, false), { at: 3, group: 'roads' })
  assert.deepEqual(landing(rows, 4, 3, true), { at: 4 })
  assert.deepEqual(landing(rows, 0, 0, false), { at: 0, group: undefined })
  // a group block dropped between another group's rows snaps above that group
  const two = flatRows(layerItems([{ id: 'x', group: 'g' }, { id: 'y', group: 'g' }], { e: { position: 1 } }))
  assert.deepEqual(landing(two, 3, 2, false), { at: 0 })
})

test('moveRow: an empty group takes a layer dropped above its slot, not below it', () => {
  // rows: [e], slot, a
  const layers: L[] = [{ id: 'a' }]
  const groups = { e: { position: 0 } }
  const rows = flatRows(layerItems(layers, groups))
  assert.deepEqual(landing(rows, 2, 2, false), { at: 2, group: undefined })
  moveRow(layers, groups, 2, 1)
  assert.equal(layers[0].group, 'e')
  assert.deepEqual(groups, {})
})

test('placeEmptyGroups: an emptied group stays, an empty one follows the item below it', () => {
  const layers = sample()
  const before = layerItems(layers)
  for (const l of layers) delete l.group
  const groups = {}
  // b and c fall back to their own spots, roads stays above d
  placeEmptyGroups(before, layers, groups)
  assert.deepEqual(groups, { roads: { position: 2 } })
  // a new layer on top moves it down with the rest
  const after = layerItems(layers, groups)
  layers.unshift({ id: 'n' })
  placeEmptyGroups(after, layers, groups)
  assert.deepEqual(groups, { roads: { position: 3 } })
  // a new group goes in at its position, and `false` lets an emptied one go
  const more: L[] = [{ id: 'x', group: 'g' }]
  const was = layerItems(more)
  delete more[0].group
  const fresh = { n: { position: 0 } }
  placeEmptyGroups(was, more, fresh, false)
  assert.deepEqual(fresh, { n: { position: 0 } })
})

test('renameGroup / ungroup: members and the layerGroups entry follow', () => {
  const layers = sample()
  const groups: Record<string, unknown> = { roads: { collapsed: false } }
  renameGroup(layers, groups, 'roads', 'Streets')
  assert.deepEqual(layers.map((l) => l.group), [undefined, 'Streets', undefined, 'Streets'])
  assert.deepEqual(groups, { Streets: { collapsed: false } })
  ungroup(layers, groups, 'Streets')
  assert.ok(layers.every((l) => !('group' in l)))
  assert.deepEqual(groups, {})
})

test('guessKind: by extension, then Esri URL shapes, else a tile server', () => {
  assert.equal(guessKind('parks.geojson'), 'geojson')
  assert.equal(guessKind('https://x.org/data.JSON?v=2'), 'geojson')
  assert.equal(guessKind('roads.pmtiles'), 'pmtiles')
  assert.equal(guessKind('storms.parquet'), 'geoparquet')
  assert.equal(guessKind('storms.geoparquet'), 'geoparquet')
  assert.equal(guessKind('a.fgb'), 'flatgeobuf')
  assert.equal(guessKind('a.parquet'), 'geoparquet')
  assert.equal(guessKind('https://s.arcgis.com/x/FeatureServer/0'), 'esri-feature')
  assert.equal(guessKind('https://s.arcgis.com/x/MapServer'), 'esri-dynamic')
  assert.equal(guessKind('https://tiles.example.com/{z}/{x}/{y}.pbf'), 'tiles')
})

test('newLayer: an id from the name, the kind fields, a style only where one is required', () => {
  const layers = [{ id: 'parks', symbology: { kind: 'simple', color: '#2563EB' } }]
  assert.deepEqual(newLayer('geojson', 'Parks', './layers/parks2.geojson', layers), {
    id: 'parks-2',
    name: 'Parks',
    type: 'geojson',
    url: './layers/parks2.geojson',
    symbology: { kind: 'simple', color: unusedColor(layers) },
  })
  assert.notEqual(unusedColor(layers), '#2563eb')
  assert.deepEqual(newLayer('esri-tiled', 'Imagery', 'https://x/MapServer', layers), {
    id: 'imagery',
    name: 'Imagery',
    type: 'esri',
    service: 'tiled',
    url: 'https://x/MapServer',
  })
})

test('kindOf: the most specific kind whose fields match', () => {
  assert.equal(kindOf({ type: 'pmtiles', url: 'a.pmtiles' }), 'pmtiles')
  assert.equal(kindOf({ type: 'pmtiles', raster: true }), 'pmtiles-raster')
  assert.equal(kindOf({ type: 'esri', service: 'dynamic' }), 'esri-dynamic')
  assert.equal(kindOf({ type: 'nope' }), undefined)
})

test('simpleFields: only what the geometry paints, named for it; every field without one', () => {
  assert.deepEqual(simpleFields('line').map(([k]) => k), ['color', 'width', 'opacity'])
  assert.equal(simpleFields('polygon').find(([k]) => k === 'strokeColor')?.[1], 'Border color')
  assert.equal(simpleFields('point').find(([k]) => k === 'strokeColor')?.[1], 'Ring color')
  assert.equal(simpleFields(undefined).length, 7)
})

test('sectionTarget: the section and index a row lands in, none above the first header', () => {
  // [A] a b [B] c
  const headers = [true, false, false, true, false]
  assert.deepEqual(sectionTarget(headers, 1, 1), { section: 0, index: 0 })
  assert.deepEqual(sectionTarget(headers, 1, 4), { section: 1, index: 1 })
  assert.deepEqual(sectionTarget(headers, 4, 2), { section: 0, index: 1 })
  assert.equal(sectionTarget(headers, 1, 0), null)
})
