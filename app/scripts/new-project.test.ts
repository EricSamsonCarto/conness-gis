import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProject, freeId, projectId, TEMPLATE_DIR } from './new-project.mjs'

test('projectId: lowercase, dashes for anything else, no edge dashes', () => {
  assert.equal(projectId('City Parcels'), 'city-parcels')
  assert.equal(projectId("  Eric's Map: 2026! "), 'eric-s-map-2026')
  assert.throws(() => projectId('!!!'), /no letters or numbers/)
})

test('freeId: adds -2, -3 on a clash', () => {
  assert.equal(freeId('parks', ['demo']), 'parks')
  assert.equal(freeId('parks', ['parks']), 'parks-2')
  assert.equal(freeId('parks', ['parks', 'parks-2']), 'parks-3')
})

test('createProject copies the template, rewrites branding, never overwrites', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const first = createProject("Eric's Map", projectsDir)
  assert.equal(first.id, 'eric-s-map')
  const settings = JSON.parse(fs.readFileSync(path.join(first.dir, 'settings.json'), 'utf8'))
  assert.equal(settings.branding.title, "Eric's Map")
  assert.equal(settings.branding.appId, 'eric-s-map')
  assert.equal(settings.$schema, '../../schema/settings.schema.json')
  const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(settings.connessVersion, version)
  assert.ok(fs.existsSync(path.join(first.dir, 'public', 'logo.svg')))
  assert.ok(fs.existsSync(path.join(first.dir, 'layers', '.gitkeep')))

  const second = createProject("Eric's Map", projectsDir)
  assert.equal(second.id, 'eric-s-map-2')
  // the template itself is untouched
  assert.equal(JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'settings.json'), 'utf8')).branding.title, 'Basic')
})
