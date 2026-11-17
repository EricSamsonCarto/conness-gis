// npm run new "City Parcels" copies the basic template into app/projects/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROJECTS_DIR } from './project.mjs'
import { formatJson } from './formatJson.ts'

export const TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates/basic')

// "City Parcels!" -> city-parcels
export function projectId(name) {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!id) throw new Error(`[conness-gis] New project: "${name}" has no letters or numbers to name a folder with`)
  return id
}

// city-parcels, city-parcels-2, … : never an existing folder
export function freeId(id, existing) {
  if (!existing.includes(id)) return id
  let n = 2
  while (existing.includes(`${id}-${n}`)) n++
  return `${id}-${n}`
}

const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// upgrades read the stamp, so a duplicate keeps its source's
export function createProject(name, projectsDir = PROJECTS_DIR, templateDir = TEMPLATE_DIR) {
  return copyProject(templateDir, name, projectsDir, version)
}

// a new project from the template or a duplicate, with its own id and appId
export function copyProject(sourceDir, name, projectsDir = PROJECTS_DIR, stamp) {
  fs.mkdirSync(projectsDir, { recursive: true })
  const id = freeId(projectId(name), fs.readdirSync(projectsDir))
  const dir = path.join(projectsDir, id)
  fs.cpSync(sourceDir, dir, { recursive: true, errorOnExist: true, force: false })

  const settingsFile = path.join(dir, 'settings.json')
  const { $schema, ...settings } = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  settings.branding = { ...settings.branding, title: name, appId: id }
  fs.writeFileSync(settingsFile, formatJson({ ...($schema && { $schema }), ...(stamp && { connessVersion: stamp }), ...settings }))
  return { id, dir }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv.slice(2).join(' ').trim()
  if (!name) {
    console.error('Usage: npm run new "My Map"')
    process.exit(1)
  }
  try {
    const { id } = createProject(name)
    console.log(`Created app/projects/${id}/ ("${name}"). Next: npm run dev ${id}`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
