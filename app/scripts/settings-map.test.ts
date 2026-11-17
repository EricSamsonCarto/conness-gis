import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonSchemas } from './project-config-plugin.ts'
import { allEntries, allSections, isPanel, labelFor, type SettingEntry } from '../editor/settings/settingsMap.ts'

type Node = { properties?: Record<string, Node>; items?: Node; anyOf?: Node[]; oneOf?: Node[]; allOf?: Node[] }

// every path in a JSON Schema: a.b, list[].c
function paths(node: Node, at: string, out: Set<string>) {
  for (const variant of [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]) paths(variant, at, out)
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    if (key === '$schema') continue
    const next = at ? `${at}.${key}` : key
    out.add(next)
    paths(child, next, out)
  }
  if (node.items && !Array.isArray(node.items)) paths(node.items, `${at}[]`, out)
}

// the files whose settings the map places one by one; layers and symbology are lists of their own
const WALKED = ['settings', 'theme', 'basemaps'] as const
const schemas = jsonSchemas()
const all = new Map<string, Set<string>>()
for (const file of WALKED) {
  const out = new Set<string>()
  paths(JSON.parse(schemas[file]), '', out)
  all.set(file, out)
}
// a leaf: no other path below it
const leaves = WALKED.flatMap((file) => {
  const set = all.get(file)!
  return [...set]
    .filter((p) => ![...set].some((q) => q.startsWith(`${p}.`) || q.startsWith(`${p}[]`)))
    .map((p) => `${file}:${p}`)
})

// panels included: a setting inside a pop-out still needs exactly one home
const entries = allEntries().filter((e): e is SettingEntry => !isPanel(e))
const toggles = allSections().flatMap((section) => (section.toggle ? [section.toggle] : []))

function covers(path: string, list: boolean | undefined, leaf: string): boolean {
  if (path.endsWith('.*')) return leaf.startsWith(path.slice(0, -1))
  if (leaf === path) return true
  return Boolean(list) && (leaf.startsWith(`${path}.`) || leaf.startsWith(`${path}[]`))
}

// widgets.* has no hand-written home: each widget's block is built from its schema
// (scripts/widget-sections.test.ts checks those)
// connessVersion is Conness's own record of the release, never edited by hand
test('every setting has exactly one home in the settings map', () => {
  const problems = leaves.filter((leaf) => !leaf.startsWith('settings:widgets.') && leaf !== 'settings:connessVersion').flatMap((leaf) => {
    const homes = entries.filter((e) => covers(e.path, e.list, leaf)).length
    return homes === 1 ? [] : [`${leaf}: ${homes === 0 ? 'no home' : `${homes} homes`}`]
  })
  assert.deepEqual(problems, [])
})

test('every map entry points at a setting that exists', () => {
  const missing = entries
    .filter((e) => (WALKED as readonly string[]).includes(e.path.split(':')[0]))
    .filter((e) => {
      const [file, path] = e.path.split(':')
      const known = all.get(file)!
      return !known.has(path.replace(/\.\*$/, ''))
    })
    .map((e) => e.path)
  const missingToggles = toggles.filter((t) => !all.get(t.split(':')[0])!.has(t.split(':')[1]))
  // a setting can only depend on one that exists
  const missingParents = allEntries()
    .flatMap((e) => (e.dependsOn ? [e.dependsOn.path] : []))
    .filter((p) => !all.get(p.split(':')[0])!.has(p.split(':')[1]))
  assert.deepEqual([...missing, ...missingToggles, ...missingParents], [])
})

test('labels come from the last key unless given', () => {
  assert.equal(labelFor({ path: 'settings:mapControls.navigation.showCompass' }), 'Show compass')
  assert.equal(labelFor({ path: 'settings:branding.appId', label: 'Storage ID' }), 'Storage ID')
})

test('labels keep acronyms in capitals', () => {
  assert.equal(labelFor({ path: 'settings:mapControls.terrain.source.url' }), 'URL')
  assert.equal(labelFor({ path: 'settings:duckdb.bundleUrl' }), 'Bundle URL')
  assert.equal(labelFor({ path: 'settings:widgets.search.geocoder.apiKey' }), 'API key')
})
