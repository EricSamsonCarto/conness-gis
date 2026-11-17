import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeXml, featuresToKML, kmlColor } from './writeKML.ts'

test('escapeXml escapes markup and drops control characters XML forbids', () => {
  assert.equal(escapeXml('a & b <c> "d"'), 'a &amp; b &lt;c&gt; &quot;d&quot;')
  assert.equal(escapeXml('tab\tline\nvt\u000Bbs\u0008'), 'tab\tline\nvtbs')
})

test("kmlColor turns #rrggbb + opacity into KML's aabbggrr, and falls back to blue", () => {
  assert.equal(kmlColor('#ff8000'), 'ff0080ff')
  assert.equal(kmlColor('#f80', 0.5), '800088ff')
  assert.equal(kmlColor('red'), 'fff6823b')
})

test('featuresToKML escapes names and property values', () => {
  const kml = featuresToKML(
    {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A&B', note: '<x>' }, geometry: { type: 'Point', coordinates: [1, 2] } },
      ],
    },
    'Layer "1"',
  )
  assert.ok(kml.includes('<name>Layer &quot;1&quot;</name>'))
  assert.ok(kml.includes('<Placemark><name>A&amp;B</name>'))
  assert.ok(kml.includes('<Data name="note"><value>&lt;x&gt;</value></Data>'))
  assert.ok(kml.includes('<coordinates>1,2</coordinates>'))
})
