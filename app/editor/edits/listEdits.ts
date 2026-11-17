// reordering list settings in place. no imports, so tests run it in node

// placements.ts's CornerItem, by shape
type CornerItem = { kind: 'control'; key: string } | { kind: 'widget'; id: string; param: string }

// moves one item, out-of-range indexes do nothing
export function move<T>(list: T[], from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
}

type Placement = { widgetName: string; order?: number } & Record<string, unknown>
type Settings = {
  floatingWidgets?: { slot: string; widgets: Placement[] }[]
  mapControls?: Record<string, { order?: number } | undefined>
}

// `order` values with gaps (10, 20) to slot between. the credits
// button's block is the only one this creates
export function setCornerOrder(settings: Settings, items: CornerItem[]): void {
  items.forEach((item, i) => {
    const order = (i + 1) * 10
    if (item.kind === 'control') {
      const controls = (settings.mapControls ??= {})
      ;(controls[item.key] ??= {}).order = order
    } else {
      const [, slot, index] = item.param.split('|')
      const placement = settings.floatingWidgets?.[Number(slot)]?.widgets[Number(index)]
      if (placement) placement.order = order
    }
  })
}

// "Mount Conness (OSM)" → "mount-conness-osm", "-2" on a clash
// `fallback` when the name has no latin letters or digits
export function freeSlug(name: string, taken: string[], fallback: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback
  let slug = base
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`
  return slug
}

type LayerLike = { id: string; group?: string; symbology?: unknown }
export type LayerItem = { kind: 'layer'; id: string } | { kind: 'group'; name: string; ids: string[] }
// `position` is an empty group's spot in the top level
export type GroupMap = Record<string, { position?: number } & Record<string, unknown>>

// a group sits at its first layer, as the layer list shows it
// empty groups sit at `position`
export function layerItems(layers: LayerLike[], groups?: GroupMap): LayerItem[] {
  const items: LayerItem[] = []
  for (const layer of layers) {
    const group = layer.group ? items.find((i) => i.kind === 'group' && i.name === layer.group) : undefined
    if (group?.kind === 'group') group.ids.push(layer.id)
    else if (layer.group) items.push({ kind: 'group', name: layer.group, ids: [layer.id] })
    else items.push({ kind: 'layer', id: layer.id })
  }
  const empty = Object.entries(groups ?? {})
    .filter(([name]) => !layers.some((l) => l.group === name))
    .sort(([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0))
  for (const [name, g] of empty) items.splice(Math.min(g.position ?? 0, items.length), 0, { kind: 'group', name, ids: [] })
  return items
}

export type LayerRow =
  | { kind: 'group'; name: string; count: number; span: number }
  | { kind: 'layer'; id: string; group?: string }
  | { kind: 'slot'; group: string }

// a layer dropped above an empty group's slot joins it, below doesn't
export function flatRows(items: LayerItem[]): LayerRow[] {
  return items.flatMap((i): LayerRow[] => {
    if (i.kind === 'layer') return [{ kind: 'layer', id: i.id }]
    const header = { kind: 'group' as const, name: i.name, count: i.ids.length, span: Math.max(1, i.ids.length) }
    if (i.ids.length === 0) return [header, { kind: 'slot', group: i.name }]
    return [header, ...i.ids.map((id) => ({ kind: 'layer' as const, id, group: i.name }))]
  })
}

// an empty group stores its spot, a filled one drops it
function syncGroups(items: LayerItem[], groups: GroupMap): void {
  items.forEach((item, i) => {
    if (item.kind !== 'group') return
    if (item.ids.length === 0) (groups[item.name] ??= {}).position = i
    else if (groups[item.name]) {
      delete groups[item.name].position
      if (Object.keys(groups[item.name]).length === 0) delete groups[item.name]
    }
  })
}

const itemKey = (i: LayerItem) => (i.kind === 'group' ? `group:${i.name}` : i.id)

// an empty group stays above what was below it in `before`
// `keepEmpty` keeps a group the change emptied
export function placeEmptyGroups(before: LayerItem[], layers: LayerLike[], groups: GroupMap, keepEmpty = true): void {
  const isEmpty = (name: string) => !layers.some((l) => l.group === name)
  const wasThere = (name: string) => before.some((i) => i.kind === 'group' && i.name === name)
  if (keepEmpty) for (const i of before) if (i.kind === 'group' && isEmpty(i.name)) groups[i.name] ??= {}
  const items = layerItems(layers)
  for (const [name, g] of Object.entries(groups)) {
    if (isEmpty(name) && !wasThere(name)) items.splice(Math.min(g.position ?? 0, items.length), 0, { kind: 'group', name, ids: [] })
  }
  before.forEach((item, i) => {
    if (item.kind !== 'group' || !isEmpty(item.name) || !groups[item.name]) return
    const below = new Set(before.slice(i + 1).map(itemKey))
    const at = items.findIndex((x) => below.has(itemKey(x)))
    items.splice(at < 0 ? items.length : at, 0, { kind: 'group', name: item.name, ids: [] })
  })
  syncGroups(items, groups)
}

// a layer joins the group of the row above, `out` puts it just below
// a group moves whole, never into another. the drag preview asks too
export function landing(rows: LayerRow[], from: number, to: number, out: boolean): { at: number; group?: string } {
  const moving = rows[from]
  const rest = rows.filter((_, i) => i < from || i > from + (moving.kind === 'group' ? moving.span : 0))
  const at = Math.max(0, Math.min(to, rest.length))
  const headerOf = (name: string) => rest.findIndex((r) => r.kind === 'group' && r.name === name)
  // the group a row sits inside (a header doesn't)
  const memberOf = (r: LayerRow | undefined) => (r && r.kind !== 'group' ? r.group : undefined)
  if (moving.kind !== 'layer') {
    const inside = memberOf(rest[at])
    return { at: inside ? headerOf(inside) : at }
  }
  if (to === from && !out) return { at, group: moving.group }
  const above = rest[at - 1]
  // below an empty group's slot is outside it
  const group = above?.kind === 'group' ? above.name : above?.kind === 'layer' ? above.group : undefined
  if (!out || !group) return { at, group }
  let end = headerOf(group)
  while (memberOf(rest[end + 1]) === group) end++
  return { at: end + 1 }
}

export function moveRow(layers: LayerLike[], groups: GroupMap, from: number, to: number, out = false): void {
  const rows = flatRows(layerItems(layers, groups))
  const moving = rows[from]
  const { at, group } = landing(rows, from, to, out)
  if (moving.kind === 'slot') return
  const block = rows.splice(from, 1 + (moving.kind === 'group' ? moving.span : 0))
  if (moving.kind === 'layer') {
    moving.group = group
    const layer = layers.find((l) => l.id === moving.id)!
    if (group) layer.group = group
    else delete layer.group
  }
  rows.splice(at, 0, ...block)
  const byId = new Map(layers.map((l) => [l.id, l]))
  layers.splice(0, layers.length, ...rows.flatMap((r) => (r.kind === 'layer' ? [byId.get(r.id)!] : [])))
  const items: LayerItem[] = []
  for (const r of rows) {
    if (r.kind === 'slot') continue
    if (r.kind === 'group') items.push({ kind: 'group', name: r.name, ids: [] })
    else if (!r.group) items.push({ kind: 'layer', id: r.id })
    else (items.findLast((i) => i.kind === 'group' && i.name === r.group) as { ids: string[] }).ids.push(r.id)
  }
  syncGroups(items, groups)
}

type Groups = Record<string, unknown> | undefined

// every member follows, and so does the group's layerGroups entry
export function renameGroup(layers: LayerLike[], groups: Groups, from: string, to: string): void {
  for (const layer of layers) if (layer.group === from) layer.group = to
  if (groups && from in groups) {
    groups[to] = groups[from]
    delete groups[from]
  }
}

export function ungroup(layers: LayerLike[], groups: Groups, name: string): void {
  for (const layer of layers) if (layer.group === name) delete layer.group
  if (groups) delete groups[name]
}

// the others draw automatic colors or the service's own style
export const LAYER_KINDS: Record<string, { label: string; fields: Record<string, unknown>; styled?: true }> = {
  geojson: { label: 'GeoJSON file', fields: { type: 'geojson' }, styled: true },
  pmtiles: { label: 'PMTiles archive', fields: { type: 'pmtiles' } },
  'pmtiles-raster': { label: 'PMTiles archive (images)', fields: { type: 'pmtiles', raster: true } },
  flatgeobuf: { label: 'FlatGeobuf file', fields: { type: 'flatgeobuf' }, styled: true },
  geoparquet: { label: 'GeoParquet file', fields: { type: 'geoparquet' }, styled: true },
  tiles: { label: 'Tile server', fields: { type: 'tiles' } },
  'tiles-raster': { label: 'Tile server (images)', fields: { type: 'tiles', raster: true } },
  'esri-feature': { label: 'Esri feature service', fields: { type: 'esri', service: 'feature' } },
  'esri-dynamic': { label: 'Esri map service', fields: { type: 'esri', service: 'dynamic' } },
  'esri-tiled': { label: 'Esri tiled service', fields: { type: 'esri', service: 'tiled' } },
}

// by its fixed fields, the kinds with more of them first
export function kindOf(layer: Record<string, unknown>): string | undefined {
  return Object.entries(LAYER_KINDS)
    .sort(([, a], [, b]) => Object.keys(b.fields).length - Object.keys(a.fields).length)
    .find(([, k]) => Object.entries(k.fields).every(([field, value]) => layer[field] === value))?.[0]
}

// by extension, then Esri's URL shapes, else a tile server
export function guessKind(source: string): string {
  const bare = source.split(/[?#]/)[0].toLowerCase()
  if (/\.(geo)?json$/.test(bare)) return 'geojson'
  if (bare.endsWith('.pmtiles')) return 'pmtiles'
  if (bare.endsWith('.fgb')) return 'flatgeobuf'
  if (bare.endsWith('.parquet') || bare.endsWith('.geoparquet')) return 'geoparquet'
  if (/\/featureserver\/\d+\/?$/.test(bare)) return 'esri-feature'
  if (/\/mapserver\/?$/.test(bare)) return 'esri-dynamic'
  return 'tiles'
}

const NEW_LAYER_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

// the first color no simple symbology uses yet
export function unusedColor(layers: LayerLike[]): string {
  const used = layers.map((l) => {
    const style = l.symbology as { kind?: string; color?: string } | undefined
    return style?.kind === 'simple' ? style.color?.toLowerCase() : undefined
  })
  return NEW_LAYER_COLORS.find((c) => !used.includes(c)) ?? NEW_LAYER_COLORS[layers.length % NEW_LAYER_COLORS.length]
}

export function newLayer(kind: string, name: string, url: string, layers: LayerLike[]): Record<string, unknown> {
  const { fields, styled } = LAYER_KINDS[kind]
  return {
    id: freeSlug(name, layers.map((l) => l.id), 'layer'),
    name,
    ...fields,
    url,
    ...(styled ? { symbology: { kind: 'simple', color: unusedColor(layers) } } : {}),
  }
}

// named for what they paint, the same field is a ring or a border
export function simpleFields(geometry: string | undefined): [string, string][] {
  if (geometry === 'point') {
    return [['color', 'Dot color'], ['radius', 'Dot radius'], ['strokeColor', 'Ring color'], ['strokeWidth', 'Ring width'], ['opacity', 'Opacity'], ['strokeOpacity', 'Ring opacity']]
  }
  if (geometry === 'line') return [['color', 'Line color'], ['width', 'Line width'], ['opacity', 'Opacity']]
  if (geometry === 'polygon') {
    return [['color', 'Fill color'], ['opacity', 'Fill opacity'], ['strokeColor', 'Border color'], ['strokeWidth', 'Border width'], ['strokeOpacity', 'Border opacity']]
  }
  return [
    ['color', 'Color'],
    ['width', 'Line width'],
    ['radius', 'Dot radius'],
    ['strokeColor', 'Ring or border color'],
    ['strokeWidth', 'Ring or border width'],
    ['opacity', 'Opacity'],
    ['strokeOpacity', 'Ring or border opacity'],
  ]
}

// the section and index row `from` lands at, null above the first header
export function sectionTarget(headers: boolean[], from: number, to: number): { section: number; index: number } | null {
  const order = headers.map((header, i) => ({ header, i }))
  move(order, from, to)
  const at = order.findIndex((row) => row.i === from)
  let section = -1
  let start = -1
  for (let k = 0; k < at; k++) {
    if (order[k].header) {
      section++
      start = k
    }
  }
  return section < 0 ? null : { section, index: at - start - 1 }
}
