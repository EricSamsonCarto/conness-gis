import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelTextExpression } from './labelText.ts'

const col = (name: string) => ['coalesce', ['to-string', ['get', name]], '']

test('labelTextExpression: {column} placeholders between literal text', () => {
  assert.deepEqual(labelTextExpression('{faa_id}: {name}'), ['concat', col('faa_id'), ': ', col('name')])
  assert.deepEqual(labelTextExpression('departures = { departures }'), ['concat', 'departures = ', col('departures')])
  assert.equal(labelTextExpression('Airport'), 'Airport')
})
