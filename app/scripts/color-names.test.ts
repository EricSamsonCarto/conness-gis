import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isColorName } from '../editor/colorNames.ts'

test('isColorName: palette names, plain names and other colors, case-sensitive', () => {
  const tokens = ['primary', 'text']
  for (const ok of ['blue-700', 'slate-50', 'rose-950', 'white', 'black', 'transparent', 'primaryDarker', 'primary', 'text']) {
    assert.equal(isColorName(ok, tokens), true, ok)
  }
  for (const bad of ['Text', 'bleu-700', 'blue-750', 'blue', '#ffffff', 'rgb(0,0,0)', '']) {
    assert.equal(isColorName(bad, tokens), false, bad)
  }
})
