// zips of the built app in _builds/ and the project in _project-backups/
import fs from 'node:fs'
import path from 'node:path'
import { zipSync } from 'fflate'
import { PROJECTS_DIR } from './project.mjs'

// every file under `dir` but dot-files, keyed by its relative path
function filesIn(dir, at = '') {
  const out = {}
  for (const entry of fs.readdirSync(path.join(dir, at), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const rel = at ? `${at}/${entry.name}` : entry.name
    if (entry.isDirectory()) Object.assign(out, filesIn(dir, rel))
    else if (entry.isFile()) out[rel] = fs.readFileSync(path.join(dir, rel))
  }
  return out
}

// a zip of the folder's files, as bytes
export function zipFolder(dir) {
  return zipSync(filesIn(dir))
}

// <id>_YYYYMMDD.zip, then -2, -3 on the same day, so earlier zips stay
export function datedName(dir, id, date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  let file = path.join(dir, `${id}_${stamp}.zip`)
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${id}_${stamp}-${n}.zip`)
  return file
}

// a new dated zip in app/projects/<folder>/, a _ folder is never a project
function saveDated(from, folder, id, projectsDir) {
  const dir = path.join(projectsDir, folder)
  fs.mkdirSync(dir, { recursive: true })
  const file = datedName(dir, id)
  fs.writeFileSync(file, zipFolder(from))
  return file
}

// the whole project folder, in _project-backups/
export function backupProject(id, projectsDir = PROJECTS_DIR) {
  return saveDated(path.join(projectsDir, id), '_project-backups', id, projectsDir)
}

// the built app, app/dist/<id>, in _builds/
export function saveBuild(id, projectsDir = PROJECTS_DIR) {
  return saveDated(path.join(projectsDir, '..', 'dist', id), '_builds', id, projectsDir)
}
