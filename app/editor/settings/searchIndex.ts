import { SETTINGS_MAP, isPanel, labelFor, type PanelEntry, type Section, type SettingEntry } from './settingsMap.ts'

// names and JSON keys only, not descriptions (decided 2026-10-22)
export type SearchEntry = {
  kind: 'setting' | 'section' | 'panel' | 'layer'
  label: string
  // group › pop-outs › section › block
  where: string
  // lowercased label, and the JSON key for settings
  terms: string[]
  group: string
  // pop-out screens to open, bottom first, empty for sidebar items
  panels: PanelEntry[]
  // the data-reveal id of the row to scroll to and flash
  target: string
  widget?: string
}
export type SearchResult = SearchEntry & { notPlaced: boolean }

type Layer = { id: string; name?: string; type: string }

// each widget's block, searched under Widgets
export function buildIndex(layers: Layer[] = [], widgetSections: Section[] = []): SearchEntry[] {
  const out: SearchEntry[] = []
  let layersPanel: PanelEntry | undefined

  function walk(sections: Section[], group: string, trail: string[], panels: PanelEntry[], widget?: string) {
    for (const section of sections) {
      const at = section.name ? [...trail, section.name] : trail
      const sectionWidget = section.widget ?? widget
      if (section.name) {
        out.push({
          kind: 'section',
          label: section.name,
          where: trail.join(' › '),
          terms: [section.name.toLowerCase()],
          group,
          panels,
          // section names are unique across the map (scripts/search-index.test.ts)
          target: `section:${section.name}`,
          widget: sectionWidget,
        })
      }
      for (const entry of section.settings) {
        if (isPanel(entry)) {
          if (entry.panel === 'layers') layersPanel = entry
          // picking a pop-out link opens its pop-out
          out.push({
            kind: 'panel',
            label: entry.label,
            where: at.join(' › '),
            terms: [entry.label.toLowerCase()],
            group,
            panels: [...panels, entry],
            target: `panel:${entry.panel}`,
            widget: sectionWidget,
          })
          // a custom screen's sections only record what it covers
          if (!entry.screen) walk(entry.sections, group, [...at, entry.label], [...panels, entry], sectionWidget)
        } else {
          out.push(settingEntry(entry, group, at, panels, sectionWidget))
        }
      }
      if (section.blocks) walk(section.blocks, group, at, panels, sectionWidget)
    }
  }

  for (const group of SETTINGS_MAP) walk(group.sections, group.name, [group.name], [])
  walk(widgetSections, 'Widgets', ['Widgets'], [])

  for (const layer of layers) {
    const name = layer.name ?? layer.id
    out.push({
      kind: 'layer',
      label: name,
      where: `Layers › ${layer.type}`,
      terms: [name.toLowerCase(), layer.id.toLowerCase()],
      group: 'Layers',
      panels: layersPanel
        ? [layersPanel, { panel: `layer:${layer.id}`, label: name, screen: 'layer', param: layer.id, sections: [] }]
        : [],
      target: `layer:${layer.id}`,
    })
  }
  return out
}

function settingEntry(entry: SettingEntry, group: string, at: string[], panels: PanelEntry[], widget?: string): SearchEntry {
  const label = labelFor(entry)
  const key = entry.path.split(':')[1].replace(/\.\*$/, '').split('.').pop() ?? ''
  return {
    kind: 'setting',
    label,
    where: at.join(' › '),
    terms: [label.toLowerCase(), key.toLowerCase()],
    group,
    panels,
    target: entry.path,
    widget,
  }
}

// lower is better, the whole label, a word start, anywhere, then the key
function rank(entry: SearchEntry, q: string): number {
  const [label, ...rest] = entry.terms
  if (label === q) return 0
  if (label.startsWith(q) || label.includes(` ${q}`)) return 1
  if (label.includes(q)) return 2
  if (rest.some((t) => t.includes(q.replace(/\s+/g, '')))) return 3
  return -1
}

export function search(index: SearchEntry[], query: string, placed: string[], limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return index
    .map((entry, i) => ({ entry, i, score: rank(entry, q) }))
    .filter((m) => m.score >= 0)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map(({ entry }) => ({ ...entry, notPlaced: Boolean(entry.widget && !placed.includes(entry.widget)) }))
}
