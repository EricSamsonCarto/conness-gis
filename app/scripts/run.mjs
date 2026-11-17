// npm run <dev|build|preview> [project] picks the project, then runs the step
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProject } from './project.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [command, ...rest] = process.argv.slice(2)
// the first plain word is the project, flags (--yes, --host) go to the step
const requested = rest.find((arg) => !arg.startsWith('-'))
const flags = rest.filter((arg) => arg.startsWith('-'))

if (!['dev', 'build', 'preview'].includes(command)) {
  console.error(`[conness-gis] unknown command "${command}". Use dev, build or preview`)
  process.exit(1)
}

let project
try {
  project = resolveProject(requested)
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

console.log(`project: ${project.id}`)
const env = { ...process.env, CONNESS_PROJECT: project.id }
const bin = (pkg, file) => path.join(appDir, 'node_modules', pkg, 'bin', file)
const script = (name) => path.join(appDir, 'scripts', name)

const steps = {
  dev: [[bin('vite', 'vite.js'), ...flags]],
  build: [
    [bin('typescript', 'tsc'), '-b'],
    [bin('vite', 'vite.js'), 'build'],
    [script('build-report.mjs')],
    [script('check-keys.mjs')],
    [script('archive.mjs')],
  ],
  preview: [[bin('vite', 'vite.js'), 'preview', ...flags]],
}[command]

for (const args of steps) {
  const { status } = spawnSync(process.execPath, args, { cwd: appDir, env, stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}
