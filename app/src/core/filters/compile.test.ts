import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LayerFilterState } from '../types.ts'
import { isFilterActive, restorableFilter, toExpression, toPredicate, toWhere } from './compile.ts'

const state = (columns: LayerFilterState['columns'], enabled = true): LayerFilterState => ({
  enabled,
  columns,
})

test('nothing active: no expression, predicate or where', () => {
  const off = state({ type: { kind: 'categorical', enabled: true, selected: ['a'] } }, false)
  const empty = state({ type: { kind: 'categorical', enabled: true, selected: [] } })
  for (const s of [undefined, off, empty]) {
    assert.equal(isFilterActive(s), false)
    assert.equal(toExpression(s), null)
    assert.equal(toPredicate(s), null)
    assert.equal(toWhere(s), null)
  }
})

test('categorical: exact match, so value types must line up', () => {
  const s = state({ code: { kind: 'categorical', enabled: true, selected: [12, 'x'] } })
  const passes = toPredicate(s)!
  assert.equal(passes({ code: 12 }), true)
  assert.equal(passes({ code: 'x' }), true)
  // loaders must hand features and filter values the same types
  assert.equal(passes({ code: '12' }), false)
  assert.equal(passes(null), false)
  assert.deepEqual(toExpression(s), ['in', ['get', 'code'], ['literal', [12, 'x']]])
  assert.equal(toWhere(s), "(code IN (12, 'x'))")
})

test('numeric between: inclusive, skips missing and non-numeric values', () => {
  const s = state({
    pop: { kind: 'numeric', enabled: true, op: 'between', value: '10', value2: '20' },
  })
  const passes = toPredicate(s)!
  assert.equal(passes({ pop: 10 }), true)
  assert.equal(passes({ pop: '20' }), true)
  assert.equal(passes({ pop: 21 }), false)
  assert.equal(passes({ pop: null }), false)
  assert.equal(passes({ pop: '' }), false)
  assert.equal(passes({ pop: 'n/a' }), false)
  assert.equal(toWhere(s), '(pop >= 10) AND (pop <= 20)')
})

test('numeric input that is incomplete or invalid is ignored', () => {
  const half = state({ pop: { kind: 'numeric', enabled: true, op: 'between', value: '10', value2: '' } })
  const reversed = state({ pop: { kind: 'numeric', enabled: true, op: 'between', value: '20', value2: '10' } })
  const junk = state({ pop: { kind: 'numeric', enabled: true, op: '>', value: 'abc', value2: '' } })
  for (const s of [half, reversed, junk]) assert.equal(toPredicate(s), null)
})

test('!= maps to <> in where and == in the expression for =', () => {
  const ne = state({ n: { kind: 'numeric', enabled: true, op: '!=', value: '5', value2: '' } })
  assert.equal(toPredicate(ne)!({ n: 4 }), true)
  assert.equal(toPredicate(ne)!({ n: 5 }), false)
  assert.equal(toWhere(ne), '(n <> 5)')
  const eq = state({ n: { kind: 'numeric', enabled: true, op: '=', value: '5', value2: '' } })
  assert.deepEqual(toExpression(eq), [
    'all',
    ['!=', ['get', 'n'], null],
    ['!=', ['get', 'n'], ''],
    ['==', ['to-number', ['get', 'n']], 5],
  ])
})

test('where escapes quotes and writes booleans as 1/0', () => {
  const s = state({
    name: { kind: 'categorical', enabled: true, selected: ["O'Brien"] },
    open: { kind: 'categorical', enabled: true, selected: [true, false] },
  })
  assert.equal(toWhere(s), "(name IN ('O''Brien')) AND (open IN (1, 0))")
})

test("a saved filter keeps the columns the layer still offers and drops the rest", () => {
  const saved = state({
    fuel: { kind: 'categorical', enabled: true, selected: ['Solar'] },
    mw: { kind: 'numeric', enabled: true, op: '>', value: '100', value2: '' },
    year: { kind: 'numeric', enabled: true, op: '>', value: '2000', value2: '' },
  })
  const { state: kept, dropped } = restorableFilter(saved, [
    { column: 'fuel', kind: 'categorical' },
    { column: 'mw', kind: 'categorical' },
  ])
  assert.deepEqual(Object.keys(kept!.columns), ['fuel'])
  assert.deepEqual(dropped, [
    { column: 'mw', why: 'now categorical' },
    { column: 'year', why: 'no longer a filter column' },
  ])
  assert.equal(restorableFilter(saved, []).state, undefined)
})
