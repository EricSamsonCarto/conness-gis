import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { listProjects, resolveProject } from './project.mjs'

// a temporary projects folder with these project names (+ a _project-backups folder)
function projectsDir(names: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'))
  for (const name of [...names, '_project-backups']) {
    fs.mkdirSync(path.join(dir, name))
    fs.writeFileSync(path.join(dir, name, 'settings.json'), '{}')
  }
  fs.mkdirSync(path.join(dir, 'not-a-project'))
  return dir
}

test('lists folders with a settings.json, skipping _ folders', () => {
  assert.deepEqual(listProjects(projectsDir(['b', 'a'])), ['a', 'b'])
})

test('a named project wins; an unknown name fails with the list', () => {
  const dir = projectsDir(['demo', 'parks'])
  assert.equal(resolveProject('parks', dir).id, 'parks')
  assert.equal(resolveProject('parks', dir).dir, path.join(dir, 'parks'))
  assert.throws(() => resolveProject('nope', dir), /"nope" isn't a project.*demo, parks/)
})

test('no name: the only project, else stop with the list', () => {
  assert.equal(resolveProject(undefined, projectsDir(['demo'])).id, 'demo')
  assert.throws(() => resolveProject(undefined, projectsDir(['demo', 'parks'])), /several projects \(demo, parks\)/)
})

test('no projects at all fails', () => {
  assert.throws(() => resolveProject(undefined, projectsDir([])), /has no projects.*npm run new/)
})
