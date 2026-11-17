import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsonSchemas, loadProject } from './project-config-plugin.ts'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templateDir = path.join(appDir, 'templates/basic')

// a copy of the basic template with one file's JSON changed
function templateWith(file: string, change: (json: Record<string, unknown>) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'))
  fs.cpSync(templateDir, dir, { recursive: true })
  const target = path.join(dir, file)
  const json = JSON.parse(fs.readFileSync(target, 'utf8'))
  change(json)
  fs.writeFileSync(target, JSON.stringify(json))
  return dir
}

test('the demo and the template load cleanly', () => {
  for (const dir of [path.join(appDir, 'projects/demo'), templateDir]) {
    const { settings } = loadProject(dir)
    assert.ok(settings.branding.title)
    assert.ok(Array.isArray(settings.layers) && Array.isArray(settings.basemaps))
    assert.equal('$schema' in settings, false)
  }
})

test('every problem is reported at once, with its file and path', () => {
  const dir = templateWith('settings.json', (s) => {
    ;(s.map as Record<string, unknown>).zooom = 5
    s.ui = { popups: { height: 'tall' } }
  })
  assert.throws(
    () => loadProject(dir),
    (err: Error) =>
      /has 2 problems/.test(err.message) &&
      /settings\.json → map: Unrecognized key: "zooom"/.test(err.message) &&
      /settings\.json → ui\.popups\.height/.test(err.message),
  )
})

test('invalid JSON names the file', () => {
  const dir = templateWith('theme.json', () => {})
  fs.writeFileSync(path.join(dir, 'theme.json'), '{ "preset": "dark", }')
  assert.throws(() => loadProject(dir), /theme\.json: isn't valid JSON/)
})

test('$env: references are filled from the env, and a missing one is reported', () => {
  const dir = templateWith('settings.json', (s) => {
    s.widgets = { search: { geocoder: { provider: 'maptiler', apiKey: '$env:VITE_KEY' } } }
    ;(s.map as Record<string, unknown>).style = 'https://example.com/style.json?key=$env:VITE_KEY'
  })
  const { settings } = loadProject(dir, { VITE_KEY: 'abc123' })
  assert.equal((settings.widgets?.search as { geocoder?: { apiKey?: string } }).geocoder?.apiKey, 'abc123')
  assert.equal(settings.map.style, 'https://example.com/style.json?key=abc123')
  assert.throws(
    () => loadProject(dir),
    (err: Error) =>
      /settings\.json → widgets\.search\.geocoder\.apiKey: \$env:VITE_KEY isn't set/.test(err.message) &&
      /settings\.json → map\.style: \$env:VITE_KEY isn't set/.test(err.message),
  )
})

test('restricted basemaps are dropped when commercialUse is true', () => {
  const restricted = (s: { basemaps: { license?: string }[] }) => s.basemaps.filter((b) => b.license === 'restricted')
  assert.ok(restricted(loadProject(templateDir).settings).length > 0)
  const dir = templateWith('settings.json', (s) => (s.commercialUse = true))
  assert.equal(restricted(loadProject(dir).settings).length, 0)
})

test('the committed app/schema/ files are up to date', () => {
  for (const [name, text] of Object.entries(jsonSchemas())) {
    const file = path.join(appDir, 'schema', `${name}.schema.json`)
    assert.equal(fs.readFileSync(file, 'utf8'), text, `${name}.schema.json is stale; run npm run dev once to refresh it`)
  }
})

test('overrides replace a file on disk and are checked the same way', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(templateDir, 'settings.json'), 'utf8'))
  const edited = { ...settings, branding: { ...settings.branding, title: 'Unsaved' } }
  assert.equal(loadProject(templateDir, {}, { settings: edited }).settings.branding.title, 'Unsaved')
  assert.equal(loadProject(templateDir, {}, { theme: { preset: 'ocean' } }).settings.theme?.preset, 'ocean')
  assert.throws(() => loadProject(templateDir, {}, { theme: { preset: 'neon' } }), /theme\.json → preset/)
})
