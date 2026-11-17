import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProject } from './new-project.mjs'
import { compareVersions, upgradeFiles, upgradeProblem, upgradeProject, type ProjectJson, type Upgrade } from './upgrades.ts'

const RENAME: Upgrade[] = [
  { to: '1.1.0', changes: ['old → new'], run: (f) => { f.settings.new = f.settings.old; delete f.settings.old } },
  { to: '1.2.0', changes: ['new → newer'], run: (f) => { f.settings.newer = f.settings.new; delete f.settings.new } },
  { to: '2.0.0', changes: ['not yet'], run: () => assert.fail('a later release ran') },
]
const project = (settings: object): ProjectJson => ({ settings, layers: { layers: [] }, basemaps: { basemaps: [] }, theme: {}, symbology: {} })

test('compareVersions: numeric, not textual', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0)
  assert.equal(compareVersions('2.3.4', '2.3.4'), 0)
})

test('upgradeFiles: runs only the releases after the stamp, up to this one, then stamps it', () => {
  const files = project({ $schema: 's', connessVersion: '1.0.0', old: 1 })
  const done = upgradeFiles(files, RENAME, '1.2.0')
  assert.deepEqual(done?.files.settings, { $schema: 's', connessVersion: '1.2.0', newer: 1 })
  assert.deepEqual(done?.changes, ['old → new', 'new → newer'])
  assert.equal(done?.from, '1.0.0')
  assert.deepEqual(files.settings, { $schema: 's', connessVersion: '1.0.0', old: 1 }, 'the input is left alone')
})

test('upgradeFiles: nothing due is null, a missing stamp is 0.0.0, a newer stamp is refused', () => {
  assert.equal(upgradeFiles(project({ connessVersion: '1.2.0' }), RENAME, '1.3.0'), null)
  assert.equal(upgradeFiles(project({ old: 1 }), RENAME, '1.1.0')?.files.settings.new, 1)
  assert.throws(() => upgradeFiles(project({ connessVersion: '1.4.0' }), RENAME, '1.3.0'), /newer than this one/)
})

test('upgradeProblem: names npm run upgrade only when something is due', () => {
  assert.equal(upgradeProblem({ connessVersion: '1.0.0' }, 'parks', [], '1.5.0'), null)
  assert.match(upgradeProblem({ connessVersion: '1.0.0' }, 'parks', RENAME, '1.1.0')?.fix ?? '', /npm run upgrade parks/)
  assert.match(upgradeProblem({ connessVersion: '9.0.0' }, 'parks', RENAME, '1.1.0')?.why ?? '', /newer/)
})

test('upgradeProject: writes only the files that changed', () => {
  const { dir } = createProject('Parks', fs.mkdtempSync(path.join(os.tmpdir(), 'projects-')))
  const file = (f: string) => path.join(dir, `${f}.json`)
  const settings = JSON.parse(fs.readFileSync(file('settings'), 'utf8'))
  fs.writeFileSync(file('settings'), JSON.stringify({ ...settings, connessVersion: '1.0.0', old: 1 }))
  const layers = fs.readFileSync(file('layers'), 'utf8')
  fs.writeFileSync(file('theme'), '{ broken')

  assert.equal(upgradeProject(dir, [], '1.1.0'), null, 'nothing due: the broken theme.json is never read')
  fs.writeFileSync(file('theme'), '{}')
  assert.deepEqual(upgradeProject(dir, RENAME, '1.1.0'), { from: '1.0.0', to: '1.1.0', changes: ['old → new'] })
  const after = JSON.parse(fs.readFileSync(file('settings'), 'utf8'))
  assert.equal(after.new, 1)
  assert.equal(after.connessVersion, '1.1.0')
  assert.equal(fs.readFileSync(file('layers'), 'utf8'), layers)
  assert.equal(upgradeProject(dir, RENAME, '1.1.0'), null, 'a second run has nothing to do')
})
