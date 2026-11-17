import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

// plain-DOM .ts files hold map control markup; .tsx icons sit in panels
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts') && !d.name.endsWith('.test.ts'))
    .map((d) => path.join(d.parentPath, d.name))
}

const FIXED_SVG = /<svg\b[^>]*\s(?:width|height)=["'][^"']*["'][^>]*>/g

test('map control icons follow the icon size', () => {
  const found: string[] = []
  for (const file of [...files(path.join(ROOT, 'src/shell')), ...files(path.join(ROOT, 'widgets'))]) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(FIXED_SVG)) found.push(`${path.relative(ROOT, file)}: ${m[0]}`)
  }
  assert.deepEqual(found, [], 'size control icons in CSS, not with width or height on the svg')
})
