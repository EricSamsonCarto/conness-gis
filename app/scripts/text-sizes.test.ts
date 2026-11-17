import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && /\.(tsx?|css)$/.test(d.name) && !d.name.endsWith('.test.ts'))
    .map((d) => path.join(d.parentPath, d.name))
}

// Tailwind's own sizes and px/rem sizes skip ui.textSizes; only text-small / medium / large / title / button / dialogButton (and the popup's text-popupHeader / popupTitle / popupBody) follow it
const RAW_CLASS = /(?<![\w-])text-(?:xs|sm|base|lg|[2-9]?xl|\[[\d.]+(?:px|rem)\])(?![\w-])/g
const RAW_CSS = /font-size:(?!\s*(?:var\(--text-|max\(var\(--text-|inherit))[^;]+/g

test('shell and widget text uses only the text-size settings', () => {
  const found: string[] = []
  for (const file of [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'widgets'))]) {
    const text = fs.readFileSync(file, 'utf8')
    const pattern = file.endsWith('.css') ? RAW_CSS : RAW_CLASS
    for (const m of text.matchAll(pattern)) found.push(`${path.relative(ROOT, file)}: ${m[0]}`)
  }
  assert.deepEqual(found, [], 'use text-small, text-medium, text-large, text-title, text-button, text-dialogButton or a text-popup* size (var(--text-…) in CSS)')
})
