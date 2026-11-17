import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Plugin, ResolvedConfig } from 'vite'
import { configError } from '../src/core/configError.ts'
import { PROJECT_FILES, projectFiles, type ProjectFile } from '../src/core/schema/settings.ts'
import type { Settings, SymbologyRegistry } from '../src/core/types.ts'
import { formatJson } from './formatJson.ts'
import { widgetSchemas, WIDGETS_DIR } from './widget-settings.ts'
import { upgradeProblem } from './upgrades.ts'
import { headTags, infoModule, llmsTxt, logoSize, ROBOTS_TXT, withTitle } from './page-meta.ts'

const FILES = Object.keys(PROJECT_FILES) as ProjectFile[]
export type ProjectDraft = Partial<Record<ProjectFile, unknown>>
// `live` changes apply in the open page, so they're sent, not reloaded
export type ProjectConfigApi = { setDraft(files: ProjectDraft | null, live?: boolean): void }
// what the @user aliases in vite.config.ts resolve to
const VIRTUAL: Record<string, 'settings' | 'symbologies' | 'layerFiles' | 'thumbnails' | 'info'> = {
  'virtual:conness-settings': 'settings',
  'virtual:conness-symbology': 'symbologies',
  'virtual:conness-layer-files': 'layerFiles',
  'virtual:conness-basemap-thumbnails': 'thumbnails',
  'virtual:conness-info': 'info',
}

// the folders whose added or removed files change those modules
const WATCHED_FOLDERS = ['layers', 'basemap-images']
const THUMBNAIL_TYPES = ['.jpg', '.jpeg', '.png', '.webp']

// an import specifier Vite resolves from the app root
const fromRoot = (root: string, file: string) => `/${path.relative(root, file).split(path.sep).join('/')}?url`

// a module of ?url imports, so a build ships only the files a project uses
function urlModule(name: string, root: string, entries: [string, string][], urls: [string, string][] = []): string {
  const imports = entries.map(([, file], i) => `import u${i} from ${JSON.stringify(fromRoot(root, file))}`)
  const fields = [
    ...entries.map(([key], i) => `${JSON.stringify(key)}: u${i}`),
    ...urls.map(([key, url]) => `${JSON.stringify(key)}: ${JSON.stringify(url)}`),
  ]
  return `${imports.join('\n')}\nexport const ${name} = { ${fields.join(', ')} }\n`
}

// a missing file is left out, resolveLayerUrl reports it with the rest
export function layerFilesModule(root: string, projectDir: string, layers: { url?: unknown }[]): string {
  const entries = new Map<string, string>()
  for (const { url } of layers) {
    if (typeof url !== 'string' || /^[a-z]+:\/\//i.test(url) || url.startsWith('//')) continue
    const key = './' + url.replace(/^\.?\//, '')
    const file = path.join(projectDir, key)
    if (fs.existsSync(file)) entries.set(key, file)
  }
  return urlModule('layerFiles', root, [...entries])
}

// thumbnails by name, project folder first, then the catalog
// a `thumbnail` that's a URL is passed through
export function thumbnailsModule(
  root: string,
  projectDir: string,
  catalogDir: string,
  basemaps: { id: string; thumbnail?: string }[],
): string {
  const entries: [string, string][] = []
  const urls: [string, string][] = []
  const images = (dir: string) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => THUMBNAIL_TYPES.includes(path.extname(f).toLowerCase())) : []
  const folders = [path.join(projectDir, 'basemap-images'), catalogDir].map((dir) => ({ dir, files: images(dir) }))
  for (const { id, thumbnail } of basemaps) {
    if (thumbnail && /[/:]/.test(thumbnail)) {
      urls.push([id, thumbnail])
      continue
    }
    const name = thumbnail ?? id
    for (const { dir, files } of folders) {
      const file = files.find((f) => f === name || f.replace(/\.[^.]+$/, '') === name)
      if (file) {
        entries.push([id, path.join(dir, file)])
        break
      }
    }
  }
  return urlModule('thumbnails', root, entries, urls)
}

export const projectFile = (dir: string, name: ProjectFile) => path.join(dir, `${name}.json`)

// "layers[3].popup", or "(top level)" for the file root
function issuePath(segments: PropertyKey[]): string {
  const text = segments.map((s) => (typeof s === 'number' ? `[${s}]` : `.${String(s)}`)).join('')
  return text.replace(/^\./, '') || '(top level)'
}

function readJson(file: string, name: string): unknown {
  if (!fs.existsSync(file)) {
    throw configError({
      where: file,
      why: 'is missing',
      fix: `every project needs ${FILES.map((f) => `${f}.json`).join(', ')}. Copy it from app/templates/basic/`,
    })
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw configError({
      where: `${name}.json`,
      why: `isn't valid JSON (${err instanceof Error ? err.message : err})`,
      fix: 'check for a missing comma or quote, or a trailing comma, near that spot',
    })
  }
}

const ENV_REF = /\$env:(VITE_[A-Z0-9_]+)/g

// "$env:VITE_X" becomes its app/.env value, so keys stay out of git
function withEnv(
  value: unknown,
  env: Record<string, string | undefined>,
  at: PropertyKey[],
  missing: (at: PropertyKey[], name: string) => void,
): unknown {
  if (typeof value === 'string') {
    return value.replace(ENV_REF, (ref, name: string) => {
      if (env[name] !== undefined) return env[name]
      missing(at, name)
      return ref
    })
  }
  if (Array.isArray(value)) return value.map((v, i) => withEnv(v, env, [...at, i], missing))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withEnv(v, env, [...at, k], missing)]))
  }
  return value
}

// every problem in every file is reported at once. the JSON passes through
// as written, the engine applies defaults. `overrides` are unsaved edits
export function loadProject(
  dir: string,
  env: Record<string, string | undefined> = {},
  overrides: ProjectDraft = {},
  widgetsDir = WIDGETS_DIR,
): { settings: Settings; symbologies: SymbologyRegistry } {
  if (!('settings' in overrides)) {
    // an older project is checked once upgraded, its problems now are noise
    const problem = upgradeProblem(readJson(projectFile(dir, 'settings'), 'settings'), path.basename(dir))
    if (problem) throw configError({ where: path.relative(process.cwd(), dir) || dir, ...problem })
  }
  const schemas = projectFiles(widgetSchemas(widgetsDir))
  const issues: string[] = []
  const data: Partial<Record<ProjectFile, unknown>> = {}
  for (const name of FILES) {
    const raw = name in overrides ? overrides[name] : readJson(projectFile(dir, name), name)
    const value = withEnv(raw, env, [], (at, variable) =>
      issues.push(`  ${name}.json → ${issuePath(at)}: $env:${variable} isn't set. Add ${variable}=… to app/.env`),
    )
    if (value && typeof value === 'object') delete (value as Record<string, unknown>).$schema
    const result = schemas[name].safeParse(value)
    if (result.success) data[name] = value
    else issues.push(...result.error.issues.map((i) => `  ${name}.json → ${issuePath(i.path)}: ${i.message}`))
  }
  if (issues.length > 0) {
    throw configError({
      where: path.relative(process.cwd(), dir) || dir,
      why: `${issues.length === 1 ? 'has a problem' : `has ${issues.length} problems`} in its JSON:\n${issues.join('\n')}\n`,
      fix: 'fix each one and save. In VS Code, hover a key to see what it takes',
    })
  }
  const file = data as {
    settings: Omit<Settings, 'theme' | 'basemaps' | 'layers'>
    layers: { layers: Settings['layers'] }
    basemaps: { basemaps: Settings['basemaps'] }
    theme: Settings['theme']
    symbology: SymbologyRegistry
  }
  // dropped at build time, so restricted basemaps never ship
  const basemaps = file.settings.commercialUse
    ? file.basemaps.basemaps.filter((b) => b.license !== 'restricted')
    : file.basemaps.basemaps
  return {
    settings: { ...file.settings, theme: file.theme, basemaps, layers: file.layers.layers },
    symbologies: file.symbology,
  }
}

// markdownDescription is what VS Code shows on hover
function withHoverText(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withHoverText)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) out[key] = withHoverText(value)
  const { description, default: def, defaultText, see } = out
  if (typeof description === 'string' || defaultText !== undefined || see !== undefined || 'default' in out) {
    const parts = [
      typeof description === 'string' ? description : undefined,
      'default' in out ? `Default: \`${JSON.stringify(def)}\`` : defaultText !== undefined ? `Default: ${defaultText}` : undefined,
      typeof see === 'string' ? `[Docs](${see})` : undefined,
    ].filter(Boolean)
    if (parts.length > 0) out.markdownDescription = parts.join('\n\n')
  }
  delete out.defaultText
  delete out.see
  return out
}

// one JSON Schema per project file, for hover and autocomplete
export function jsonSchemas(widgetsDir = WIDGETS_DIR): Record<ProjectFile, string> {
  const files = projectFiles(widgetSchemas(widgetsDir))
  const entries = FILES.map((name) => {
    const schema = z.toJSONSchema(files[name], {
      target: 'draft-7',
      io: 'input',
      unrepresentable: 'any',
    }) as Record<string, unknown>
    schema.properties = {
      $schema: { type: 'string', description: "This file's JSON Schema, for editor hover help." },
      ...(schema.properties as object | undefined),
    }
    return [name, formatJson(withHoverText(schema))]
  })
  return Object.fromEntries(entries) as Record<ProjectFile, string>
}

// app/schema/ is committed so hover works before any command runs
export function writeJsonSchemas(schemaDir: string): void {
  fs.mkdirSync(schemaDir, { recursive: true })
  for (const [name, text] of Object.entries(jsonSchemas())) {
    const file = path.join(schemaDir, `${name}.schema.json`)
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text)
  }
}

// api.setDraft serves the editor's unsaved edits until cleared with null
export function projectConfig(projectDir: string, schemaDir: string): Plugin<ProjectConfigApi> {
  let config: ResolvedConfig
  let draft: ProjectDraft = {}
  let reload = () => {}
  let sendLive = () => {}

  return {
    name: 'conness-project-config',
    api: {
      setDraft(files, live = false) {
        draft = files ?? {}
        if (live) sendLive()
        else reload()
      },
    },
    configResolved(resolved) {
      config = resolved
    },
    buildStart() {
      writeJsonSchemas(schemaDir)
      if (config.command === 'build') {
        loadProject(projectDir, config.env)
        return
      }
      // in dev, report at startup but keep serving, so a fix recovers
      try {
        loadProject(projectDir, config.env)
      } catch (err) {
        config.logger.error(err instanceof Error ? err.message : String(err))
      }
    },
    resolveId(id) {
      return id in VIRTUAL ? '\0' + id : undefined
    },
    load(id) {
      const name = id.startsWith('\0') ? VIRTUAL[id.slice(1)] : undefined
      if (!name) return
      if (name === 'info') {
        const file = path.join(projectDir, 'info.md')
        this.addWatchFile(file)
        return infoModule(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
      }
      for (const file of FILES) this.addWatchFile(projectFile(projectDir, file))
      const project = loadProject(projectDir, config.env, draft)
      if (name === 'layerFiles') return layerFilesModule(config.root, projectDir, project.settings.layers as { url?: unknown }[])
      if (name === 'thumbnails') {
        const catalog = path.join(config.root, 'widgets', 'basemap', 'assets', 'basemap-images')
        return thumbnailsModule(config.root, projectDir, catalog, project.settings.basemaps)
      }
      const code = `export const ${name} = ${JSON.stringify(project[name])}\n`
      if (name !== 'settings') return code
      return code + `export const logoSize = ${JSON.stringify(logoSize(projectDir, project.settings.branding.logo) ?? null)}\n`
    },
    transformIndexHtml(html) {
      let settings: Settings
      try {
        settings = loadProject(projectDir, config.env, draft).settings
      } catch {
        // dev with a broken config, already reported
        return html
      }
      return { html: withTitle(html, settings.branding.title), tags: headTags(settings) }
    },
    generateBundle() {
      const { settings } = loadProject(projectDir, config.env)
      // a file in the project's public/ wins, Vite copies it as is
      const files = { 'robots.txt': ROBOTS_TXT, 'llms.txt': llmsTxt(settings) }
      for (const [fileName, source] of Object.entries(files)) {
        if (!fs.existsSync(path.join(projectDir, 'public', fileName))) this.emitFile({ type: 'asset', fileName, source })
      }
    },
    configureServer(server) {
      const files = new Set([...FILES.map((f) => projectFile(projectDir, f)), path.join(projectDir, 'info.md')])
      const invalidate = () => {
        for (const id of Object.keys(VIRTUAL)) {
          const mod = server.moduleGraph.getModuleById('\0' + id)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
      }
      reload = () => {
        invalidate()
        server.ws.send({ type: 'full-reload' })
      }
      // to the open page, a later reload reads the same draft
      sendLive = () => {
        invalidate()
        try {
          const { settings, symbologies } = loadProject(projectDir, config.env, draft)
          server.ws.send({ type: 'custom', event: 'conness:live', data: { settings, symbologies } })
        } catch {
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('change', (file) => {
        if (files.has(file)) reload()
      })
      // a file added or removed (an upload) changes what's imported
      const inWatchedFolder = (file: string) =>
        WATCHED_FOLDERS.some((folder) => file.startsWith(path.join(projectDir, folder) + path.sep))
      server.watcher.on('add', (file) => inWatchedFolder(file) && reload())
      server.watcher.on('unlink', (file) => inWatchedFolder(file) && reload())
    },
  }
}
