// which project (app/projects/<name>/) a command runs on
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../projects')

// folders with a settings.json, _ folders are never projects
export function listProjects(projectsDir = PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) return []
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .filter((d) => fs.existsSync(path.join(projectsDir, d.name, 'settings.json')))
    .map((d) => d.name)
    .sort()
}

const fail = (why, fix) => new Error(`[conness-gis] Project: ${why}. ${fix.charAt(0).toUpperCase() + fix.slice(1)}`)

// the requested name, else the only project. several or none stop
export function resolveProject(requested, projectsDir = PROJECTS_DIR) {
  const projects = listProjects(projectsDir)
  if (projects.length === 0) {
    throw fail('app/projects/ has no projects', 'create one with npm run new "My Map"')
  }
  const list = projects.join(', ')
  if (requested) {
    if (!projects.includes(requested)) {
      throw fail(`"${requested}" isn't a project`, `projects: ${list}. Run e.g. npm run dev ${projects[0]}`)
    }
    return { id: requested, dir: path.join(projectsDir, requested) }
  }
  if (projects.length > 1) {
    throw fail(`there are several projects (${list})`, `pick one, e.g. npm run dev ${projects[0]}`)
  }
  return { id: projects[0], dir: path.join(projectsDir, projects[0]) }
}
