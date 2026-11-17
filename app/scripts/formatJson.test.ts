import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatJson } from './formatJson.ts'

test('short containers stay on one line, long ones break', () => {
  const value = { center: [-98.5, 39.5], empty: {}, list: [], skipped: undefined, long: ['a'.repeat(30), 'b'.repeat(30)] }
  assert.equal(
    formatJson(value, 40),
    [
      '{',
      '  "center": [-98.5, 39.5],',
      '  "empty": {},',
      '  "list": [],',
      '  "long": [',
      `    "${'a'.repeat(30)}",`,
      `    "${'b'.repeat(30)}"`,
      '  ]',
      '}',
      '',
    ].join('\n'),
  )
})

test('round-trips to the same value', () => {
  const value = { a: [1, { b: 'x"y', c: [true, null] }], d: { e: 'é\n' } }
  assert.deepEqual(JSON.parse(formatJson(value, 10)), value)
  // fits in the default width: one line plus the trailing newline
  assert.equal(formatJson(value).split('\n').length, 2)
})
