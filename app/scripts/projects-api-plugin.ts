import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'
import { strFromU8, unzipSync } from 'fflate'
import { listProjects, PROJECTS_DIR } from './project.mjs'
import { copyProject, createProject, freeId, projectId } from './new-project.mjs'
import { formatJson } from './formatJson.ts'
import { closeAppServers, runningPreview, setDraft, startAppServer } from './app-servers.ts'
import { loadWidgetModules } from './widget-settings.ts'
import { loadProject } from './project-config-plugin.ts'
import { checkNotNewer, upgradeProject, type Upgraded } from './upgrades.ts'
import type { WidgetAbout } from '../src/core/widget-types.ts'

const fail = (why: string) => new Error(`[conness-gis] ${why}`)
// with an HTTP status, 409 tells the editor's picker a file exists
const failWith = (status: number, why: string) => Object.assign(fail(why), { status })

// the folders the editor lists and uploads into, and the files each takes
const FOLDERS: Record<string, string[]> = {
  public: ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'],
  'basemap-images': ['.jpg', '.jpeg', '.png', '.webp'],
  layers: ['.geojson', '.json', '.pmtiles', '.fgb', '.parquet', '.geoparquet'],
}
// images only, a layer's data file can be as big as it needs
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
}

function folderPath(projectDir: string, folder: string): string {
  if (!FOLDERS[folder]) throw failWith(404, `"${folder}" isn't a folder the editor can use`)
  return path.join(projectDir, folder)
}

// a plain file name (no paths) with an extension the folder takes
function checkName(folder: string, name: string): void {
  if (!/^[\w.-]+$/.test(name) || name.startsWith('.')) {
    throw failWith(400, `"${name}" isn't a file name. Use letters, numbers, dashes, underscores and dots`)
  }
  const allowed = FOLDERS[folder]
  if (!allowed.includes(path.extname(name).toLowerCase())) {
    throw failWith(400, `${path.extname(name) || 'files without an extension'} can't go in ${folder}/. Use ${allowed.join(', ')}`)
  }
}

// the files in a project folder the editor can offer, sorted
export function listFolder(projectDir: string, folder: string): string[] {
  const dir = folderPath(projectDir, folder)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && !f.name.startsWith('.') && FOLDERS[folder].includes(path.extname(f.name).toLowerCase()))
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b))
}

// an existing name is refused (409) unless `replace`
export function saveUpload(projectDir: string, folder: string, name: string, data: Uint8Array, replace = false): { name: string } {
  const dir = folderPath(projectDir, folder)
  checkName(folder, name)
  if (folder !== 'layers' && data.length > MAX_IMAGE_BYTES) throw failWith(413, `${name} is over ${MAX_IMAGE_BYTES / 1024 / 1024} MB`)
  const file = path.join(dir, name)
  if (!replace && fs.existsSync(file)) throw failWith(409, `${name} already exists`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, data)
  return { name }
}

// one file for the editor's previews, the editor isn't the app's server
export function readFolderFile(projectDir: string, folder: string, name: string): { data: Buffer; type: string } {
  const dir = folderPath(projectDir, folder)
  checkName(folder, name)
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) throw failWith(404, `${folder}/${name} doesn't exist`)
  return { data: fs.readFileSync(file), type: CONTENT_TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream' }
}

// the id stays as written, so it must be one, like city-parcels
export function renameProject(id: string, to: string, projectsDir = PROJECTS_DIR): { id: string } {
  let valid = false
  try {
    valid = projectId(to) === to
  } catch {
    // no letters or numbers, so not valid
  }
  if (!valid) throw fail(`"${to}" isn't a folder name. Use lowercase letters, numbers and dashes, e.g. city-parcels`)
  if (fs.readdirSync(projectsDir).includes(to)) throw fail(`app/projects/${to} already exists. Pick another name`)
  // appId stays, so visitors' saved bookmarks and drawings keep working
  fs.renameSync(path.join(projectsDir, id), path.join(projectsDir, to))
  // its builds and backups follow, the exact pattern keeps demo off demo-2's
  const dated = new RegExp(`^${id}(_\\d{8}(?:-\\d+)?\\.zip)$`)
  for (const folder of ['_builds', '_project-backups']) {
    const dir = path.join(projectsDir, folder)
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      const match = dated.exec(name)
      if (match) fs.renameSync(path.join(dir, name), path.join(dir, `${to}${match[1]}`))
    }
  }
  return { id: to }
}

// moved into _trash on Save, a file the saved layers.json uses stays
export function trashLayerFiles(id: string, names: string[], projectsDir = PROJECTS_DIR): { trashed: string[] } {
  const dir = path.join(projectsDir, id)
  const urls = ((readJson(path.join(dir, 'layers.json'))?.layers ?? []) as { url?: unknown }[]).map((l) =>
    typeof l.url === 'string' ? l.url.replace(/^\.?\//, '') : '',
  )
  const trashed: string[] = []
  const to = path.join(projectsDir, '_trash', `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`, 'layers')
  for (const name of names) {
    checkName('layers', name)
    const file = path.join(dir, 'layers', name)
    if (urls.includes(`layers/${name}`) || !fs.existsSync(file)) continue
    fs.mkdirSync(to, { recursive: true })
    fs.renameSync(file, path.join(to, name))
    trashed.push(path.relative(path.resolve(projectsDir, '../..'), path.join(to, name)))
  }
  return { trashed }
}

export function trashProject(id: string, projectsDir = PROJECTS_DIR): { trashed: string } {
  const trashDir = path.join(projectsDir, '_trash')
  fs.mkdirSync(trashDir, { recursive: true })
  const name = `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  fs.renameSync(path.join(projectsDir, id), path.join(trashDir, name))
  return { trashed: `app/projects/_trash/${name}` }
}

// loadProject's message for a project that doesn't pass, else null
function configProblems(dir: string, projectsDir: string): string | null {
  try {
    loadProject(dir, loadEnv('development', path.resolve(projectsDir, '..')))
    return null
  } catch (err) {
    return (err instanceof Error ? err.message : String(err)).replace(/^\[conness-gis\] /, '')
  }
}

// the appId is kept unless taken, so a backup keeps visitors' saved items
// a project with config problems still imports, `problems` says what
export function importProject(
  zip: Uint8Array,
  name: string,
  projectsDir = PROJECTS_DIR,
): { id: string; problems: string | null; upgraded: Upgraded | null } {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip)
  } catch {
    throw fail("that file isn't a zip")
  }
  const files = Object.entries(entries).filter(
    ([at]) => !at.endsWith('/') && // .. isn't a dot-file: it's refused below
    !at.split('/').some((part) => (part.startsWith('.') && part !== '..') || part === '__MACOSX'),
  )
  const top = files[0]?.[0].split('/')[0]
  const root =
    'settings.json' in entries ? '' : files.every(([at]) => at.startsWith(`${top}/`)) && `${top}/settings.json` in entries ? `${top}/` : null
  if (root === null) {
    if (files.some(([at]) => at === 'index.html' || at.endsWith('/index.html'))) {
      throw fail("that's a build (from app/projects/_builds/), which can't be imported. Import the project's backup from app/projects/_project-backups/ instead")
    }
    throw fail("that zip doesn't look like a project: there's no settings.json at its root")
  }
  try {
    checkNotNewer(JSON.parse(strFromU8(entries[`${root}settings.json`])))
  } catch (err) {
    if (err instanceof SyntaxError) throw fail("that zip's settings.json isn't valid JSON")
    throw err
  }

  fs.mkdirSync(projectsDir, { recursive: true })
  const existing = fs.readdirSync(projectsDir)
  const id = freeId(projectId(name), existing)
  const dir = path.join(projectsDir, id)
  // every path is checked first, none may land outside the new folder
  const out = files.map(([at, data]) => {
    const rel = at.slice(root.length)
    const file = path.resolve(dir, rel)
    if (rel.includes('\\') || path.isAbsolute(rel) || rel.split('/').includes('..') || !file.startsWith(`${dir}${path.sep}`)) {
      throw fail(`that zip has a file outside the project folder (${at}), so it wasn't imported`)
    }
    return [file, data] as const
  })
  for (const [file, data] of out) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, data)
  }

  const settingsFile = path.join(dir, 'settings.json')
  const settings = readJson(settingsFile) as { branding?: Record<string, unknown> } | null
  if (settings) {
    const taken = existing
      .filter((p) => !p.startsWith('_'))
      .map((p) => (readJson(path.join(projectsDir, p, 'settings.json')) as typeof settings)?.branding?.appId)
      .filter((a): a is string => typeof a === 'string')
    const own = settings.branding?.appId
    settings.branding = { ...settings.branding, title: name, appId: freeId(typeof own === 'string' ? own : id, taken) }
    fs.writeFileSync(settingsFile, formatJson(settings))
  }
  // a failed upgrade leaves the project imported, as its problem to fix
  let upgraded: Upgraded | null = null
  try {
    upgraded = upgradeProject(dir)
  } catch (err) {
    return { id, problems: (err instanceof Error ? err.message : String(err)).replace(/^\[conness-gis\] /, ''), upgraded }
  }
  return { id, problems: configProblems(dir, projectsDir), upgraded }
}

// the app's name, the folder and appId stay
export function renameTitle(id: string, title: string, projectsDir = PROJECTS_DIR): { id: string; title: string } {
  const file = path.join(projectsDir, id, 'settings.json')
  let settings
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw fail(`app/projects/${id}/settings.json isn't valid JSON. Fix it by hand first`)
  }
  settings.branding = { ...settings.branding, title }
  fs.writeFileSync(file, formatJson(settings))
  return { id, title }
}

// no validation, so a broken file still lists, with nulls
function readJson(file: string): { branding?: { title?: unknown }; layers?: unknown } | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const FILES = ['settings', 'layers', 'basemaps', 'theme', 'symbology']
type Files = Record<string, unknown>

// the hash tells Save whether the files changed since they were read
function diskFiles(dir: string): { texts: Record<string, string>; version: string } {
  const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
  const texts = Object.fromEntries(FILES.map((f) => [f, read(path.join(dir, `${f}.json`))]))
  const version = crypto.createHash('sha1').update(JSON.stringify(texts)).digest('hex')
  return { texts, version }
}

// an older project is upgraded on disk first, `upgraded` says what changed
export function readProjectFiles(dir: string): { files: Files; version: string; upgraded: Upgraded | null } {
  const upgraded = upgradeProject(dir)
  const { texts, version } = diskFiles(dir)
  const files: Files = {}
  for (const f of FILES) {
    try {
      files[f] = JSON.parse(texts[f])
    } catch {
      throw fail(`${path.basename(dir)}/${f}.json isn't valid JSON. Fix it by hand, then reopen the project`)
    }
  }
  return { files, version, upgraded }
}

const sameJson = (value: unknown, text: string) => {
  try {
    return JSON.stringify(value) === JSON.stringify(JSON.parse(text))
  } catch {
    return false
  }
}

// only changed files are written, so untouched ones keep their formatting
// a hand edit since `version` is a conflict unless `force`
export function saveProjectFiles(dir: string, files: Files, version: string, force = false): { version: string } {
  const disk = diskFiles(dir)
  if (disk.version !== version && !force) {
    throw Object.assign(fail('these files changed on disk since you opened the project'), { status: 409 })
  }
  for (const f of FILES) {
    if (f in files && !sameJson(files[f], disk.texts[f])) {
      fs.writeFileSync(path.join(dir, `${f}.json`), formatJson(files[f]))
    }
  }
  return { version: diskFiles(dir).version }
}

function projectSummary(id: string, projectsDir: string) {
  const dir = path.join(projectsDir, id)
  const title = readJson(path.join(dir, 'settings.json'))?.branding?.title
  const layers = readJson(path.join(dir, 'layers.json'))?.layers
  const modified = Math.max(
    ...FILES.map((f) => fs.statSync(path.join(dir, `${f}.json`), { throwIfNoEntry: false })?.mtimeMs ?? 0),
  )
  return {
    id,
    title: typeof title === 'string' ? title : null,
    layers: Array.isArray(layers) ? layers.length : null,
    modified: modified || null,
    problems: configProblems(dir, projectsDir) !== null,
  }
}

// each widget's facts, and whether any of its files renders an InfoSection
export function listWidgets(
  widgetsDir: string,
): { id: string; label: string; surfaces: string[]; defaults: WidgetAbout['defaults']; hasInfo: boolean }[] {
  return loadWidgetModules(widgetsDir)
    .map(({ about }) => {
      const dir = path.join(widgetsDir, about.id)
      const hasInfo = fs
        .readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .some((f) => f.endsWith('.tsx') && fs.readFileSync(path.join(dir, f), 'utf8').includes('<InfoSection'))
      return { id: about.id, label: about.label, surfaces: about.surfaces, defaults: about.defaults ?? {}, hasInfo }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let text = ''
  for await (const chunk of req) text += chunk
  const body = text ? JSON.parse(text) : {}
  return body && typeof body === 'object' ? body : {}
}

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw fail(`"${field}" is required`)
  return value.trim()
}

// the build's last line, read by BuildDialog, `@@conness-build {"ok":true}`
export const BUILD_MARK = '@@conness-build'

// another site's request, a text/plain POST needs no CORS preflight
export function fromOtherSite(req: Pick<IncomingMessage, 'headers'>): boolean {
  const { origin, host } = req.headers
  const site = req.headers['sec-fetch-site']
  if (site === 'cross-site' || site === 'same-site') return true
  if (!origin) return false
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

const refuse = (res: ServerResponse) => {
  res.statusCode = 403
  res.end(JSON.stringify({ error: 'only the editor itself can use this' }))
}

// dev-only endpoints, /api/projects[/<id>[/<action>]]
export function projectsApi(projectsDir = PROJECTS_DIR): Plugin {
  const appDir = path.resolve(projectsDir, '..')
  let building = false

  // output streamed as it runs, then the result line. one at a time
  function runBuild(id: string, res: ServerResponse) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    if (building) {
      res.statusCode = 409
      res.end('A build is already running.')
      return
    }
    building = true
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
    // the dev server's NODE_ENV would bundle React's development build
    delete env.NODE_ENV
    const child = spawn(process.execPath, [path.join(appDir, 'scripts', 'run.mjs'), 'build', id], { cwd: appDir, env })
    child.stdout.on('data', (chunk) => res.write(chunk))
    child.stderr.on('data', (chunk) => res.write(chunk))
    const finish = (result: object) => {
      building = false
      res.end(`\n${BUILD_MARK} ${JSON.stringify(result)}\n`)
    }
    child.on('close', (code) => finish(code === 0 ? { ok: true } : { ok: false, code }))
    child.on('error', (err) => finish({ ok: false, error: err.message }))
  }

  async function handle(req: IncomingMessage, url: string) {
    const [id, action, folder] = url.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
    if (!id) {
      if (req.method === 'GET') {
        return listProjects(projectsDir).map((p) => projectSummary(p, projectsDir))
      }
      if (req.method === 'POST') return createProject(text((await readBody(req)).name, 'name'), projectsDir)
    } else {
      // only listed projects, which blocks ../ and _ folders
      if (!listProjects(projectsDir).includes(id)) throw fail(`"${id}" isn't a project`)
      if (!action && req.method === 'GET') return projectSummary(id, projectsDir)
      if (!action && req.method === 'DELETE') return trashProject(id, projectsDir)
      if (action === 'duplicate' && req.method === 'POST') {
        return copyProject(path.join(projectsDir, id), text((await readBody(req)).name, 'name'), projectsDir)
      }
      if (action === 'title' && req.method === 'POST') {
        return renameTitle(id, text((await readBody(req)).title, 'title'), projectsDir)
      }
      const dir = path.join(projectsDir, id)
      if (action === 'files' && req.method === 'GET') return readProjectFiles(dir)
      if (action === 'preview' && req.method === 'POST') {
        const { files, live } = await readBody(req)
        const { server, url } = await startAppServer('preview', id)
        setDraft(server, files && typeof files === 'object' ? (files as Files) : null, live === true)
        return { url }
      }
      if (action === 'saved' && req.method === 'POST') return { url: (await startAppServer('saved', id)).url }
      if (action === 'save' && req.method === 'POST') {
        const { files, version, force, trash } = await readBody(req)
        if (!files || typeof files !== 'object') throw fail('"files" is required')
        const saved = saveProjectFiles(dir, files as Files, text(version, 'version'), force === true)
        // data files of layers removed in this draft, asked for in Remove layer
        if (Array.isArray(trash)) trashLayerFiles(id, trash.filter((n): n is string => typeof n === 'string'), projectsDir)
        // the files now hold the edits, the watcher reloads the pane
        const preview = runningPreview(id)
        if (preview) setDraft(preview, null)
        return saved
      }
      if (action === 'rename' && req.method === 'POST') {
        return renameProject(id, text((await readBody(req)).to, 'to'), projectsDir)
      }
      // the extensions an upload may have, the file chooser filters by them
      if (action === 'folder' && req.method === 'GET') return { files: listFolder(dir, folder), extensions: FOLDERS[folder] }
    }
    throw fail(`no endpoint for ${req.method} /api/projects${url}`)
  }

  return {
    name: 'conness-projects-api',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.on('close', () => void closeAppServers())
      server.middlewares.use('/api/widgets', (req, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json')
        if (fromOtherSite(req)) return refuse(res)
        res.end(JSON.stringify(listWidgets(path.join(projectsDir, '..', 'widgets'))))
      })
      server.middlewares.use('/api/projects', async (req, res: ServerResponse) => {
        if (fromOtherSite(req)) return refuse(res)
        // GET /<id>/folder/<folder>/<name>: the file itself, not JSON
        const parts = (req.url ?? '/').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
        // the import and uploads send the file itself as the body, not JSON
        const isImport = parts.length === 1 && parts[0] === 'import'
        const isUpload = parts.length === 3 && parts[1] === 'folder' && listProjects(projectsDir).includes(parts[0])
        if (req.method === 'POST' && (isImport || isUpload)) {
          res.setHeader('Content-Type', 'application/json')
          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            const body = new Uint8Array(Buffer.concat(chunks))
            const query = new URLSearchParams((req.url ?? '').split('?')[1])
            const name = text(query.get('name'), 'name')
            res.end(
              JSON.stringify(
                isImport
                  ? importProject(body, name, projectsDir)
                  : saveUpload(path.join(projectsDir, parts[0]), parts[2], name, body, query.get('replace') === '1'),
              ),
            )
          } catch (err) {
            res.statusCode = (err as { status?: number }).status ?? 400
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
          }
          return
        }
        // the build streams text, not JSON either
        if (parts.length === 2 && parts[1] === 'build' && req.method === 'POST' && listProjects(projectsDir).includes(parts[0]))
          return runBuild(parts[0], res)
        if (req.method === 'GET' && parts[1] === 'folder' && parts.length === 4 && listProjects(projectsDir).includes(parts[0])) {
          try {
            const { data, type } = readFolderFile(path.join(projectsDir, parts[0]), parts[2], parts[3])
            res.setHeader('Content-Type', type)
            res.setHeader('Cache-Control', 'no-cache')
            res.end(data)
          } catch (err) {
            res.statusCode = (err as { status?: number }).status ?? 400
            res.end(err instanceof Error ? err.message : String(err))
          }
          return
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          res.end(JSON.stringify(await handle(req, req.url ?? '/')))
        } catch (err) {
          res.statusCode = (err as { status?: number }).status ?? 400
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
        }
      })
    },
  }
}
