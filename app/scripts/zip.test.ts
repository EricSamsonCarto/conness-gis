import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { unzipSync, strFromU8, strToU8, zipSync } from 'fflate'
import { backupProject, datedName, saveBuild, zipFolder } from './zip.mjs'
import { createProject } from './new-project.mjs'
import { importProject, renameProject } from './projects-api-plugin.ts'

test('zipFolder: every file by its path inside the folder, dot-files left out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'))
  fs.mkdirSync(path.join(dir, 'assets', 'img'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>')
  fs.writeFileSync(path.join(dir, 'assets', 'img', 'a.svg'), '<svg/>')
  fs.writeFileSync(path.join(dir, '.DS_Store'), 'x')
  const files = unzipSync(zipFolder(dir))
  assert.deepEqual(Object.keys(files).sort(), ['assets/img/a.svg', 'index.html'])
  assert.equal(strFromU8(files['index.html']), '<html>')
})

test('datedName: <id>_YYYYMMDD.zip, then -2, -3 the same day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dated-'))
  const day = new Date(2026, 9, 7)
  assert.equal(datedName(dir, 'demo', day), path.join(dir, 'demo_20261007.zip'))
  fs.writeFileSync(path.join(dir, 'demo_20261007.zip'), '')
  assert.equal(datedName(dir, 'demo', day), path.join(dir, 'demo_20261007-2.zip'))
  fs.writeFileSync(path.join(dir, 'demo_20261007-2.zip'), '')
  assert.equal(datedName(dir, 'demo', day), path.join(dir, 'demo_20261007-3.zip'))
})

test('backupProject / saveBuild: a new dated zip each time, earlier ones kept', () => {
  // app/projects next to app/dist, as in the repo
  const projectsDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'app-')), 'projects')
  fs.mkdirSync(projectsDir)
  const parks = createProject('Parks', projectsDir)
  const first = backupProject(parks.id, projectsDir)
  assert.match(path.basename(first), new RegExp(`^${parks.id}_\\d{8}\\.zip$`))
  assert.equal(path.dirname(first), path.join(projectsDir, '_project-backups'))
  assert.ok('settings.json' in unzipSync(fs.readFileSync(first)))
  fs.writeFileSync(path.join(parks.dir, 'notes.md'), 'new')
  const second = backupProject(parks.id, projectsDir)
  assert.notEqual(second, first)
  assert.ok(fs.existsSync(first))
  assert.ok('notes.md' in unzipSync(fs.readFileSync(second)))

  const dist = path.join(projectsDir, '..', 'dist', parks.id)
  fs.mkdirSync(dist, { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>')
  const build = saveBuild(parks.id, projectsDir)
  assert.equal(path.dirname(build), path.join(projectsDir, '_builds'))
  assert.deepEqual(Object.keys(unzipSync(fs.readFileSync(build))), ['index.html'])
})

test('renameProject: the dated zips follow the folder, other projects keep theirs', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const parks = createProject('Parks', projectsDir)
  const backup = backupProject(parks.id, projectsDir)
  fs.mkdirSync(path.join(projectsDir, '_builds'))
  fs.writeFileSync(path.join(projectsDir, '_builds', `${parks.id}_20261007-2.zip`), '')
  fs.writeFileSync(path.join(projectsDir, '_builds', `${parks.id}-2_20261007.zip`), '')
  renameProject(parks.id, 'city-parks', projectsDir)
  assert.ok(fs.existsSync(path.join(projectsDir, '_project-backups', path.basename(backup).replace(parks.id, 'city-parks'))))
  assert.ok(!fs.existsSync(backup))
  assert.deepEqual(fs.readdirSync(path.join(projectsDir, '_builds')).sort(), [
    'city-parks_20261007-2.zip',
    `${parks.id}-2_20261007.zip`,
  ])
})

const branding = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).branding

test('importProject: a backup comes back as a project, its appId kept while free', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const parks = createProject('Parks', projectsDir)
  const zip = fs.readFileSync(backupProject(parks.id, projectsDir))
  fs.rmSync(parks.dir, { recursive: true })

  const back = importProject(zip, 'Parks', projectsDir)
  assert.deepEqual(back, { id: parks.id, problems: null, upgraded: null })
  assert.equal(branding(parks.dir).appId, parks.id)
  // imported again: the folder and the appId are both taken
  const again = importProject(zip, 'Parks again', projectsDir)
  assert.equal(again.id, 'parks-again')
  assert.deepEqual(branding(path.join(projectsDir, 'parks-again')), { ...branding(parks.dir), title: 'Parks again', appId: `${parks.id}-2` })
})

test('importProject: a folder zipped by hand (one top folder, __MACOSX) works', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const parks = createProject('Parks', projectsDir)
  const files = unzipSync(zipFolder(parks.dir))
  const zip = zipSync({
    ...Object.fromEntries(Object.entries(files).map(([at, data]) => [`parks/${at}`, data])),
    '__MACOSX/parks/._settings.json': strToU8('x'),
  })
  const { id } = importProject(zip, 'Parks', projectsDir)
  assert.equal(id, 'parks-2')
  // files, not folders: a zip has no empty ones (the template's layers/)
  assert.deepEqual(Object.keys(unzipSync(zipFolder(path.join(projectsDir, id)))).sort(), Object.keys(files).sort())
})

test('importProject: refuses a zip that is not a project or reaches outside it, writing nothing', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  assert.throws(() => importProject(zipSync({ 'notes.md': strToU8('x') }), 'Notes', projectsDir), /no settings\.json/)
  assert.throws(() => importProject(strToU8('not a zip'), 'Junk', projectsDir), /isn't a zip/)
  const evil = zipSync({ 'settings.json': strToU8('{}'), '../evil.txt': strToU8('x') })
  assert.throws(() => importProject(evil, 'Evil', projectsDir), /outside the project folder/)
  assert.throws(() => importProject(zipSync({ 'index.html': strToU8('x') }), 'Site', projectsDir), /_project-backups/)
  const future = zipSync({ 'settings.json': strToU8('{ "connessVersion": "999.0.0" }') })
  assert.throws(() => importProject(future, 'Future', projectsDir), /newer than this one/)
  assert.deepEqual(fs.readdirSync(projectsDir), [])
})

test('importProject: a project with config problems is imported and says what they are', () => {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const parks = createProject('Parks', projectsDir)
  fs.writeFileSync(path.join(parks.dir, 'layers.json'), '{ broken')
  const { id, problems } = importProject(zipFolder(parks.dir), 'Broken', projectsDir)
  assert.ok(fs.existsSync(path.join(projectsDir, id, 'layers.json')))
  assert.match(problems ?? '', /layers\.json/)
})
