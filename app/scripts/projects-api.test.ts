import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { copyProject, createProject } from './new-project.mjs'
import { listProjects } from './project.mjs'
import { fileURLToPath } from 'node:url'
import {
  fromOtherSite,
  listFolder,
  listWidgets,
  readFolderFile,
  readProjectFiles,
  renameProject,
  renameTitle,
  saveProjectFiles,
  saveUpload,
  trashLayerFiles,
  trashProject,
} from './projects-api-plugin.ts'

const appId = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).branding.appId

function tempProjects() {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  const parks = createProject('Parks', projectsDir)
  fs.writeFileSync(path.join(parks.dir, 'layers', 'parks.geojson'), '{}')
  return { projectsDir, parks }
}

test('copyProject: own id and appId, data copied, source untouched', () => {
  const { projectsDir, parks } = tempProjects()
  const copy = copyProject(parks.dir, 'Parks copy', projectsDir)
  assert.equal(copy.id, 'parks-copy')
  assert.equal(appId(copy.dir), 'parks-copy')
  assert.ok(fs.existsSync(path.join(copy.dir, 'layers', 'parks.geojson')))
  assert.equal(appId(parks.dir), 'parks')
})

test('renameProject: refuses clashes and non-ids, keeps appId', () => {
  const { projectsDir } = tempProjects()
  createProject('Trails', projectsDir)
  assert.throws(() => renameProject('parks', 'trails', projectsDir), /already exists/)
  assert.throws(() => renameProject('parks', 'City Parks', projectsDir), /isn't a folder name/)
  assert.throws(() => renameProject('parks', '!!!', projectsDir), /isn't a folder name/)

  renameProject('parks', 'city-parks', projectsDir)
  assert.deepEqual(listProjects(projectsDir), ['city-parks', 'trails'])
  assert.equal(appId(path.join(projectsDir, 'city-parks')), 'parks')
})

test('renameTitle: new branding.title, same folder and appId; refuses broken JSON', () => {
  const { projectsDir, parks } = tempProjects()
  renameTitle('parks', 'City Parks', projectsDir)
  const settings = JSON.parse(fs.readFileSync(path.join(parks.dir, 'settings.json'), 'utf8'))
  assert.equal(settings.branding.title, 'City Parks')
  assert.equal(settings.branding.appId, 'parks')
  assert.deepEqual(listProjects(projectsDir), ['parks'])

  fs.writeFileSync(path.join(parks.dir, 'settings.json'), '{ broken')
  assert.throws(() => renameTitle('parks', 'X', projectsDir), /isn't valid JSON/)
  assert.equal(fs.readFileSync(path.join(parks.dir, 'settings.json'), 'utf8'), '{ broken')
})

test('trashProject: moves into _trash, no longer listed', () => {
  const { projectsDir } = tempProjects()
  const { trashed } = trashProject('parks', projectsDir)
  assert.deepEqual(listProjects(projectsDir), [])
  const inTrash = fs.readdirSync(path.join(projectsDir, '_trash'))
  assert.equal(inTrash.length, 1)
  assert.ok(inTrash[0].startsWith('parks-'))
  assert.ok(trashed.endsWith(inTrash[0]))
})

test('saveProjectFiles: writes changed files only, refuses a hand edit unless forced', () => {
  const { parks } = tempProjects()
  const { files, version } = readProjectFiles(parks.dir)
  const themeBefore = fs.statSync(path.join(parks.dir, 'theme.json')).mtimeMs
  const settings = files.settings as { branding: { title: string } }
  settings.branding.title = 'Saved Parks'

  const { version: next } = saveProjectFiles(parks.dir, files, version)
  assert.notEqual(next, version)
  assert.match(fs.readFileSync(path.join(parks.dir, 'settings.json'), 'utf8'), /"title": "Saved Parks"/)
  assert.equal(fs.statSync(path.join(parks.dir, 'theme.json')).mtimeMs, themeBefore)

  // a hand edit after reading: a stale version is a conflict, force overwrites
  fs.writeFileSync(path.join(parks.dir, 'theme.json'), '{ "preset": "dark" }\n')
  assert.throws(() => saveProjectFiles(parks.dir, files, next), /changed on disk/)
  saveProjectFiles(parks.dir, files, next, true)
  assert.equal(JSON.parse(fs.readFileSync(path.join(parks.dir, 'theme.json'), 'utf8')).preset, (files.theme as { preset?: string }).preset)
})

test('listWidgets: every widget folder with its label and surfaces, _template skipped', () => {
  const widgets = listWidgets(fileURLToPath(new URL('../widgets', import.meta.url)))
  const search = widgets.find((w) => w.id === 'search')
  assert.deepEqual(
    { id: search?.id, label: search?.label, surfaces: search?.surfaces, hasInfo: search?.hasInfo },
    { id: 'search', label: 'Search', surfaces: ['floating'], hasInfo: false },
  )
  assert.equal(search?.defaults?.opens, 'sideways')
  assert.equal(widgets.find((w) => w.id === 'measure')?.hasInfo, true)
  assert.equal(widgets.some((w) => w.id === '_template'), false)
})

test('saveUpload / listFolder: an image goes into public/ and is listed', () => {
  const { parks } = tempProjects()
  const png = Buffer.from('fake png')
  saveUpload(parks.dir, 'public', 'badge.png', png)
  assert.ok(listFolder(parks.dir, 'public').includes('badge.png'))
  assert.equal(readFolderFile(parks.dir, 'public', 'badge.png').type, 'image/png')
})

test('saveUpload: an existing name is refused unless replace', () => {
  const { parks } = tempProjects()
  const first = Buffer.from('one')
  saveUpload(parks.dir, 'public', 'mark.svg', first)
  assert.throws(() => saveUpload(parks.dir, 'public', 'mark.svg', first), (err: { status?: number }) => err.status === 409)
  saveUpload(parks.dir, 'public', 'mark.svg', Buffer.from('two'), true)
  assert.equal(fs.readFileSync(path.join(parks.dir, 'public', 'mark.svg'), 'utf8'), 'two')
})

test('saveUpload: paths, odd names and other file types are refused', () => {
  const { parks } = tempProjects()
  const data = Buffer.from('x')
  for (const name of ['../evil.png', 'a/b.png', '.hidden.png', 'tool.exe', 'noext']) {
    assert.throws(() => saveUpload(parks.dir, 'public', name, data), (err: { status?: number }) => err.status === 400)
  }
  assert.throws(() => saveUpload(parks.dir, 'layers', 'x.png', data), (err: { status?: number }) => err.status === 400)
  assert.throws(() => saveUpload(parks.dir, 'nowhere', 'x.png', data), (err: { status?: number }) => err.status === 404)
})

test('saveUpload: a layer file has no size cap; an image over 10 MB is refused', () => {
  const { parks } = tempProjects()
  const big = Buffer.alloc(11 * 1024 * 1024)
  saveUpload(parks.dir, 'layers', 'big.geojson', big)
  assert.ok(listFolder(parks.dir, 'layers').includes('big.geojson'))
  assert.throws(() => saveUpload(parks.dir, 'public', 'big.png', big), (err: { status?: number }) => err.status === 413)
})


test('trashLayerFiles: moves files no saved layer points at, keeps the rest', () => {
  const { projectsDir, parks } = tempProjects()
  fs.writeFileSync(path.join(parks.dir, 'layers', 'roads.geojson'), '{}')
  const layers = { layers: [{ id: 'roads', name: 'Roads', type: 'geojson', url: './layers/roads.geojson' }] }
  fs.writeFileSync(path.join(parks.dir, 'layers.json'), JSON.stringify(layers))
  const { trashed } = trashLayerFiles(parks.id, ['parks.geojson', 'roads.geojson', 'gone.geojson'], projectsDir)
  assert.equal(trashed.length, 1)
  assert.ok(!fs.existsSync(path.join(parks.dir, 'layers', 'parks.geojson')))
  assert.ok(fs.existsSync(path.join(parks.dir, 'layers', 'roads.geojson')))
  const [trashDir] = fs.readdirSync(path.join(projectsDir, '_trash'))
  assert.ok(fs.existsSync(path.join(projectsDir, '_trash', trashDir, 'layers', 'parks.geojson')))
  assert.throws(() => trashLayerFiles(parks.id, ['../settings.json'], projectsDir))
})

test('fromOtherSite: only the editor page itself gets through', () => {
  const req = (headers: Record<string, string>) => ({ headers: { host: 'localhost:5173', ...headers } })
  assert.equal(fromOtherSite(req({})), false)
  assert.equal(fromOtherSite(req({ origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' })), false)
  assert.equal(fromOtherSite(req({ origin: 'https://example.com' })), true)
  assert.equal(fromOtherSite(req({ 'sec-fetch-site': 'cross-site' })), true)
  assert.equal(fromOtherSite(req({ origin: 'http://localhost:5180', 'sec-fetch-site': 'same-site' })), true)
  assert.equal(fromOtherSite(req({ origin: 'null' })), true)
})
