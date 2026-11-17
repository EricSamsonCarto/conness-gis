import type { Map as MapLibreMap } from 'maplibre-gl'
import type { LayerConfig } from '../types'
import { useStore } from '../store'
import { registerLayers, restackLayers, unregisterLayer } from './registerLayers'
import { canRestyle, restyleLayer } from './restyle'

// the editor's live layers.json changes, one layer at a time
// so the other layers keep their loaded data

// a layer's fields by what changing them takes. anything else is data
const LOOK = ['symbology', 'label', 'minZoom', 'maxZoom', 'geometryType', 'legend', 'hideFromLegend', 'popup', 'sourceLayers', 'collapsed']
const LIST = ['name', 'group']
const RANK = { none: 0, list: 1, look: 2, data: 3 } as const
type Change = keyof typeof RANK

// visible at start only matters when the app starts
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a, (key, value) => (key === 'visible' ? undefined : value)) ===
  JSON.stringify(b, (key, value) => (key === 'visible' ? undefined : value))

// what a layer draws from beyond its config, named styles and Label defaults
type Shared = { refs: boolean; labels: boolean }
const usesRef = (layer: LayerConfig) => JSON.stringify(layer).includes('"kind":"ref"')
const hasLabels = (layer: LayerConfig) => JSON.stringify(layer).includes('"label":')

function changeOf(before: LayerConfig, after: LayerConfig, shared: Shared): Change {
  let change: Change = (shared.refs && usesRef(after)) || (shared.labels && hasLabels(after)) ? 'look' : 'none'
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'visible' || same(a[key], b[key])) continue
    // added, removed or moved source layers need a redraw, a new look doesn't
    const names = (v: unknown) => JSON.stringify(((v ?? []) as { sourceLayer: string }[]).map((s) => s.sourceLayer))
    const next: Change =
      key === 'sourceLayers' && names(a[key]) !== names(b[key]) ? 'data' : LOOK.includes(key) ? 'look' : LIST.includes(key) ? 'list' : 'data'
    if (RANK[next] > RANK[change]) change = next
  }
  return change
}

export function applyLayerChanges(map: MapLibreMap, before: LayerConfig[], after: LayerConfig[], shared: Shared): void {
  const old = new Map(before.map((l) => [l.id, l]))
  const kept = new Set(after.map((l) => l.id))
  for (const layer of before) if (!kept.has(layer.id)) unregisterLayer(map, layer.id)

  const fresh: LayerConfig[] = []
  for (const layer of after) {
    const prev = old.get(layer.id)
    const change = prev ? changeOf(prev, layer, shared) : 'data'
    if (change === 'none') continue
    if (change === 'list') {
      useStore.getState().updateLayerMetadata(layer.id, { name: layer.name, group: layer.group })
      continue
    }
    if (change === 'look' && canRestyle(layer)) {
      restyleLayer(map, layer)
      continue
    }
    if (prev) unregisterLayer(map, layer.id)
    fresh.push(layer)
  }

  const moved = JSON.stringify(before.map((l) => l.id)) !== JSON.stringify(after.map((l) => l.id))
  if (fresh.length > 0) {
    const entries = registerLayers(map, fresh)
    // layers drawn when their data arrives (Esri) land on top, so place them
    for (const entry of entries) void entry.ready?.then(() => restackLayers(map, after))
  }
  if (fresh.length > 0 || moved) restackLayers(map, after)
}
