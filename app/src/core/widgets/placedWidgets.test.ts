import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Settings } from '../types.ts'
import { placedWidgetIds } from './placedWidgets.ts'

const settings = (placements: Partial<Settings>): Settings =>
  ({ topBarWidgets: [], sidePanelWidgets: [], floatingWidgets: [], ...placements }) as Settings

test('collects every placement list, each id once', () => {
  const ids = placedWidgetIds(
    settings({
      topBarWidgets: [{ widgetName: 'measure' }],
      sidePanelWidgets: [{ widgetName: 'layer-list' }, { widgetName: 'legend' }],
      floatingWidgets: [
        { slot: 'top-left', widgets: [{ widgetName: 'search' }] },
        { slot: 'top-right', widgets: [{ widgetName: 'coordinates' }, { widgetName: 'legend' }] },
      ],
      mobileWidgets: ['layer-list', 'draw'],
    }),
  )
  assert.deepEqual(ids, ['measure', 'layer-list', 'legend', 'search', 'coordinates', 'draw'])
})

test('no mobileWidgets and nothing placed: no ids', () => {
  assert.deepEqual(placedWidgetIds(settings({})), [])
})
