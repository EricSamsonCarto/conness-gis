// npm run upgrade [project], the editor's open and import run the same code
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROJECT_FILES, type ProjectFile } from '../src/core/schema/settings.ts'
import { formatJson } from './formatJson.ts'
import { resolveProject } from './project.mjs'

// a project's five JSON files, parsed, an upgrade changes them in place
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- an upgrade reads files of an older shape than the types
export type ProjectJson = Record<ProjectFile, any>
export type Upgrade = { to: string; changes: string[]; run: (files: ProjectJson) => void }

// one entry per config-changing release, oldest first. `changes` is user text
// the demo and template are rewritten by hand, the template has no stamp
export const UPGRADES: Upgrade[] = []

export const VERSION: string = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const FILES = Object.keys(PROJECT_FILES) as ProjectFile[]
const fail = (why: string) => new Error(`[conness-gis] ${why}`)

// x.y.z only (the release Action refuses anything else)
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

// no stamp means it was made before releases had one
const stampOf = (settings: unknown): string => {
  const v = (settings as { connessVersion?: unknown } | null)?.connessVersion
  return typeof v === 'string' ? v : '0.0.0'
}
const due = (from: string, upgrades: Upgrade[], current: string) =>
  upgrades.filter((u) => compareVersions(u.to, from) > 0 && compareVersions(u.to, current) <= 0)

const newer = (from: string, current: string) => ({
  why: `was made with Conness GIS ${from}, newer than this one (${current})`,
  fix: `update Conness GIS to ${from} or later`,
})

// a newer project is never opened or run, it may hold settings this drops
export function checkNotNewer(settings: unknown, current = VERSION): void {
  const from = stampOf(settings)
  if (compareVersions(from, current) > 0) {
    const { why, fix } = newer(from, current)
    throw fail(`this project ${why}. To open it, ${fix}`)
  }
}

// why dev or build can't run it as it is, else null
// only a pending upgrade counts, other releases leave the stamp alone
export function upgradeProblem(settings: unknown, id: string, upgrades = UPGRADES, current = VERSION): { why: string; fix: string } | null {
  const from = stampOf(settings)
  if (compareVersions(from, current) > 0) return newer(from, current)
  if (due(from, upgrades, current).length === 0) return null
  return {
    why: `was made with Conness GIS ${from} and needs upgrading to ${current}`,
    fix: `run npm run upgrade ${id}, or open it in the editor (npm start), which upgrades it`,
  }
}

export type Upgraded = { from: string; to: string; changes: string[] }

export function upgradeFiles(files: ProjectJson, upgrades = UPGRADES, current = VERSION): ({ files: ProjectJson } & Upgraded) | null {
  checkNotNewer(files.settings, current)
  const from = stampOf(files.settings)
  const steps = due(from, upgrades, current)
  if (steps.length === 0) return null
  const out = structuredClone(files)
  for (const step of steps) step.run(out)
  const { $schema, ...rest } = out.settings
  delete rest.connessVersion
  out.settings = { ...($schema !== undefined && { $schema }), connessVersion: current, ...rest }
  return { files: out, from, to: current, changes: steps.flatMap((s) => s.changes) }
}

// writes only the changed files, null when nothing was due
// settings.json goes first, so a project with nothing due stops there
export function upgradeProject(dir: string, upgrades = UPGRADES, current = VERSION): Upgraded | null {
  const read = (f: ProjectFile) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, `${f}.json`), 'utf8'))
    } catch {
      throw fail(`${path.basename(dir)}/${f}.json isn't valid JSON. Fix it by hand, then try again`)
    }
  }
  const settings = read('settings')
  checkNotNewer(settings, current)
  if (due(stampOf(settings), upgrades, current).length === 0) return null
  const files = Object.fromEntries(FILES.map((f) => [f, f === 'settings' ? settings : read(f)])) as ProjectJson
  const result = upgradeFiles(files, upgrades, current)
  if (!result) return null
  for (const f of FILES) {
    if (JSON.stringify(result.files[f]) !== JSON.stringify(files[f])) {
      fs.writeFileSync(path.join(dir, `${f}.json`), formatJson(result.files[f]))
    }
  }
  return { from: result.from, to: result.to, changes: result.changes }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { id, dir } = resolveProject(process.argv.slice(2).find((arg) => !arg.startsWith('-')))
    const done = upgradeProject(dir)
    if (!done) console.log(`app/projects/${id}/ is up to date for Conness GIS ${VERSION}.`)
    else console.log(`Upgraded app/projects/${id}/ from ${done.from} to ${done.to}:\n${done.changes.map((c) => `  - ${c}`).join('\n')}`)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
