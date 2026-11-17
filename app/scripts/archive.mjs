// the last build step, dated zips of the app in _builds/ and the
// project folder in _project-backups/
import path from 'node:path'
import { resolveProject } from './project.mjs'
import { backupProject, saveBuild } from './zip.mjs'

const { id } = resolveProject(process.env.CONNESS_PROJECT)
const fromRepo = (file) => path.relative(path.resolve(process.cwd(), '..'), file)
console.log(`Build: ${fromRepo(saveBuild(id))}`)
console.log(`Backup: ${fromRepo(backupProject(id))}`)
