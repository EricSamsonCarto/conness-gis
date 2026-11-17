import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { isPanel, type Entry, type SettingEntry } from '../editor/settings/settingsMap.ts'
import { widgetSection } from '../editor/settings/widgetSections.ts'
import { inlineRefs, type Node as SchemaNode } from '../editor/settings/schemaNodes.ts'
import { loadWidgetModules } from './widget-settings.ts'

type Node = { type?: string; properties?: Record<string, Node>; editor?: string }

// every field of a schema, as dotted paths; a field with `editor` stops there (its screen edits the rest)
function leaves(node: Node, at: string[] = []): string[] {
  return Object.entries(node.properties ?? {}).flatMap(([key, child]) =>
    child.type === 'object' && child.properties && !child.editor ? leaves(child, [...at, key]) : [[...at, key].join('.')],
  )
}

const widgets = loadWidgetModules().flatMap((m) => (m.settings ? [{ about: m.about, schema: m.settings }] : []))
const SCREENS = ['search-layers', 'dem-source']

// a pop-out holds rows of its own; a screen's single entry stands for everything under it
const rowsOf = (entries: Entry[]): SettingEntry[] =>
  entries.flatMap((e) => (!isPanel(e) ? [e] : e.screen ? [e.sections[0].settings[0] as SettingEntry] : rowsOf(e.sections[0].settings)))
const screensOf = (entries: Entry[]): string[] =>
  entries.flatMap((e) => (!isPanel(e) ? [] : e.screen ? [e.screen] : screensOf(e.sections[0].settings)))

test('the built-in widgets declare their settings', () => {
  const ids = widgets.map((w) => w.about.id).sort()
  assert.deepEqual(ids, ['basemap', 'bookmarks', 'draw', 'layer-list', 'measure', 'search'])
})

for (const { about, schema } of widgets) {
  test(`${about.id}: every setting gets exactly one row, and what it names exists`, () => {
    const section = widgetSection(about.id, about.label, schema)
    const rows = rowsOf(section.settings)
    const paths = rows.map((e) => e.path)
    const fields = leaves(inlineRefs(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as SchemaNode) as Node).map(
      (p) => `settings:widgets.${about.id}.${p}`,
    )
    assert.deepEqual([...paths].sort(), [...fields].sort())
    // a row can only depend on another of this widget's settings, and open a screen the editor has
    const parents = rows.flatMap((e) => (e.dependsOn ? [e.dependsOn.path] : []))
    assert.deepEqual(parents.filter((p) => !fields.includes(p)), [])
    assert.deepEqual(screensOf(section.settings).filter((s) => !SCREENS.includes(s)), [])
  })
}
