import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Settings } from '../src/core/types.ts'
import { headTags, imageSize, infoModule, llmsTxt, withTitle } from './page-meta.ts'

const svg = (tag: string) => Buffer.from(`<?xml version="1.0"?>\n${tag}<path d="M0 0"/></svg>`)

test('an svg is sized by width and height, else by its viewBox', () => {
  assert.deepEqual(imageSize(svg('<svg width="120px" height="40" viewBox="0 0 64 64">'), '.svg'), { width: 120, height: 40 })
  assert.deepEqual(imageSize(svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32.4">'), '.svg'), { width: 64, height: 32 })
  assert.deepEqual(imageSize(svg('<svg width="100%" height="100%" viewBox="0,0,24,24">'), '.svg'), { width: 24, height: 24 })
  assert.deepEqual(imageSize(svg('<svg stroke-width="2" viewBox="0 0 10 20">'), '.svg'), { width: 10, height: 20 })
  assert.equal(imageSize(svg('<svg width="50%">'), '.svg'), undefined)
})

test('a png is sized from its header, other files give nothing', () => {
  const png = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png)
  png.writeUInt32BE(300, 16)
  png.writeUInt32BE(90, 20)
  assert.deepEqual(imageSize(png, '.png'), { width: 300, height: 90 })
  assert.equal(imageSize(Buffer.from('not a png at all, really'), '.png'), undefined)
  assert.equal(imageSize(png, '.webp'), undefined)
})

const settings = (branding: Partial<Settings['branding']>, style: Settings['map']['style'] = 'https://tiles.example.org/styles/x.json') =>
  ({ branding: { title: 'Trails', ...branding }, map: { style } }) as Settings

const attrs = (tags: ReturnType<typeof headTags>) => tags.map((t) => t.attrs)

test('head tags follow what branding sets', () => {
  assert.deepEqual(attrs(headTags(settings({}, { version: 8, sources: {}, layers: [] }))), [
    { property: 'og:title', content: 'Trails' },
    { property: 'og:type', content: 'website' },
  ])
  const full = attrs(headTags(settings({ description: 'Hikes near "here"' })))
  assert.deepEqual(full, [
    { name: 'description', content: 'Hikes near "here"' },
    { property: 'og:title', content: 'Trails' },
    { property: 'og:type', content: 'website' },
    { property: 'og:description', content: 'Hikes near "here"' },
    { rel: 'preconnect', href: 'https://tiles.example.org' },
  ])
})

test('the title is escaped into the html, llms.txt has the description when set', () => {
  assert.equal(withTitle('<head><title>Conness GIS</title></head>', 'A & <B>'), '<head><title>A &amp; &lt;B&gt;</title></head>')
  const made = 'An interactive web map made with [Conness GIS](https://conness-gis.com).\n'
  assert.equal(llmsTxt({ ...settings({}), layers: [] }), `# Trails\n\n${made}`)
  const layers = [{ id: 'trails', name: 'Trails' }, { id: 'peaks' }] as Settings['layers']
  assert.equal(llmsTxt({ ...settings({ description: 'Hikes.' }), layers }), `# Trails\n\n> Hikes.\n\n${made}\n## Layers\n\n- Trails\n- peaks\n`)
})

test('info.md: the first # heading is the title, the rest html with raw html escaped', () => {
  const mod = infoModule('# Trails\n\nSome **bold** <script>x</script>\n')
  assert.match(mod, /export const title = "Trails"/)
  assert.match(mod, /<strong>bold<\/strong>/)
  assert.doesNotMatch(mod, /<script>/)
  assert.match(infoModule('no heading'), /export const title = ""/)
})
