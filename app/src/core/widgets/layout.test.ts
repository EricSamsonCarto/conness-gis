import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLayout, topBarOpenOnLoad, validateLayout } from './layout.ts'
import type { Settings } from '../types.ts'

const widget = (widgetName: string) => ({ widgetName })
const project = (layout: object, top = [widget('measure')], rail = [widget('legend')]) =>
  ({ ui: { layout }, topBarWidgets: top, sidePanelWidgets: rail, floatingWidgets: [] }) as unknown as Settings

test('the top-bar panel opens opposite the side rail unless set', () => {
  assert.equal(resolveLayout(project({})).topBarPanelSide, 'right')
  assert.equal(resolveLayout(project({ sideRailSide: 'right' })).topBarPanelSide, 'left')
  assert.equal(resolveLayout(project({ sideRailSide: 'right', topBarPanelSide: 'right' })).topBarPanelSide, 'right')
})

test('every layout case from the bug list is allowed', () => {
  // 1 default, 2 mirrored (rail moved alone), 3 all in the rail with the title right, 5 title and buttons on the rail's side
  validateLayout(project({}))
  validateLayout(project({ sideRailSide: 'right', topBarWidgetsSide: 'left' }))
  validateLayout(project({ sideRailSide: 'right', topBarWidgetsSide: 'left' }, []))
  validateLayout(project({ topBarWidgetsSide: 'left' }))
  // 4 no rail: the panel can be on either side, even the rail's
  validateLayout(project({ topBarPanelSide: 'left' }, [widget('measure')], []))
})

test('the rail and the panel on one side, both with widgets, is an error', () => {
  assert.throws(() => validateLayout(project({ topBarPanelSide: 'left' })), /would overlap/)
})

test('a hidden bar never overlaps the other', () => {
  validateLayout(project({ topBarPanelSide: 'left', showSideRail: false }))
  validateLayout(project({ topBarPanelSide: 'left', showTopBar: false }))
})

test('topBarOpenOnLoad opens a placed widget on a shown bar only', (t) => {
  t.mock.method(console, 'warn', () => {})
  assert.equal(topBarOpenOnLoad(project({})), null)
  assert.equal(topBarOpenOnLoad(project({ topBarOpenOnLoad: 'measure' })), 'measure')
  assert.equal(topBarOpenOnLoad(project({ topBarOpenOnLoad: 'measure', showTopBar: false })), null)
  assert.equal(topBarOpenOnLoad(project({ topBarOpenOnLoad: 'legend' })), null)
})
