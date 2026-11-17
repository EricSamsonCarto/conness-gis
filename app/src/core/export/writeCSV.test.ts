import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featuresToCSV } from './writeCSV.ts'

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features })
const lines = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n')

test('quotes commas, quotes and line breaks; starts with a BOM; ends with CRLF', () => {
  const csv = featuresToCSV(
    fc([{ type: 'Feature', properties: { a: 'x,y', b: 'say "hi"', c: 'one\ntwo', d: null }, geometry: null as never }]),
  )
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.endsWith('\r\n'))
  assert.equal(lines(csv)[1], '"x,y","say ""hi""","one\ntwo",')
})

test('mixed points and polygons get lon/lat and wkt columns, blank where they do not apply', () => {
  const csv = featuresToCSV(
    fc([
      { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [1, 2] } },
      {
        type: 'Feature',
        properties: { id: 2 },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ]),
  )
  const [header, point, polygon] = lines(csv)
  assert.equal(header, 'id,longitude,latitude,wkt')
  assert.equal(point, '1,1,2,')
  assert.equal(polygon, '2,,,"POLYGON ((0 0, 1 0, 1 1, 0 0))"')
})

test('a property named like a generated column is renamed, never repeated', () => {
  const csv = featuresToCSV(
    fc([
      {
        type: 'Feature',
        properties: { longitude: 'old', longitude_1: 'taken', latitude: 'old' },
        geometry: { type: 'Point', coordinates: [3, 4] },
      },
    ]),
  )
  const [header, row] = lines(csv)
  assert.equal(header, 'longitude_2,longitude_1,latitude_1,longitude,latitude')
  assert.equal(row, 'old,taken,old,3,4')
})
