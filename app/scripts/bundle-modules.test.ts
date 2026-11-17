import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { layerFilesModule, thumbnailsModule } from './project-config-plugin.ts'

// an app root with a project and a catalog folder, as the build sees them
function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-'))
  const project = path.join(root, 'projects', 'parks')
  const catalog = path.join(root, 'widgets', 'basemap', 'assets', 'basemap-images')
  for (const dir of [path.join(project, 'layers'), path.join(project, 'basemap-images'), catalog]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return { root, project, catalog }
}

test('layerFilesModule: imports only the local files layers.json points at', () => {
  const { root, project } = tempRoot()
  fs.writeFileSync(path.join(project, 'layers', 'parks.geojson'), '{}')
  fs.writeFileSync(path.join(project, 'layers', 'unused.geojson'), '{}')
  const code = layerFilesModule(root, project, [
    { url: './layers/parks.geojson' },
    { url: 'https://example.com/remote.geojson' },
    { url: './layers/missing.geojson' },
  ])
  assert.match(code, /import u0 from "\/projects\/parks\/layers\/parks\.geojson\?url"/)
  assert.match(code, /"\.\/layers\/parks\.geojson": u0/)
  assert.doesNotMatch(code, /unused|remote|missing/)
})

test("thumbnailsModule: the project's image wins, then the catalog's, by id or by thumbnail name", () => {
  const { root, project, catalog } = tempRoot()
  fs.writeFileSync(path.join(catalog, 'positron.jpg'), '')
  fs.writeFileSync(path.join(catalog, 'dark.jpg'), '')
  fs.writeFileSync(path.join(catalog, 'unused.jpg'), '')
  fs.writeFileSync(path.join(project, 'basemap-images', 'dark.png'), '')
  fs.writeFileSync(path.join(project, 'basemap-images', 'my-topo.webp'), '')
  const code = thumbnailsModule(root, project, catalog, [
    { id: 'positron' },
    { id: 'dark' },
    { id: 'topo', thumbnail: 'my-topo.webp' },
    { id: 'remote', thumbnail: 'https://example.com/t.png' },
    { id: 'none' },
  ])
  assert.match(code, /widgets\/basemap\/assets\/basemap-images\/positron\.jpg\?url/)
  assert.match(code, /projects\/parks\/basemap-images\/dark\.png\?url/)
  assert.doesNotMatch(code, /basemap-images\/dark\.jpg/)
  assert.match(code, /projects\/parks\/basemap-images\/my-topo\.webp\?url/)
  assert.match(code, /"remote": "https:\/\/example\.com\/t\.png"/)
  assert.doesNotMatch(code, /unused|"none"/)
})
