import { z } from 'zod'
import type { ProjectFile } from '@/core/schema/settings'
import { inlineRefs, resolve, walk, type Node } from './schemaNodes'
import { PROJECT_SCHEMAS } from './widgetSchemas'

// from the same Zod schemas the files are checked against
export type SchemaInfo = { description?: string; default?: unknown; defaultText?: string; see?: string }

const schemas: Partial<Record<ProjectFile, Node>> = {}

function schemaFor(file: ProjectFile): Node {
  schemas[file] ??= inlineRefs(
    z.toJSONSchema(PROJECT_SCHEMAS[file], {
      target: 'draft-7',
      io: 'input',
      unrepresentable: 'any',
    }) as Node,
  )
  return schemas[file]
}

// with `files`, a union is read through the variant the data is
function nodeAt(path: string, files?: Record<string, unknown>): Node | undefined {
  const [file, dotted] = path.split(':')
  if (!(file in PROJECT_SCHEMAS)) return undefined
  return walk(schemaFor(file as ProjectFile), dotted.replace(/\.\*$/, '').split('.').filter(Boolean), files?.[file])
}

// {} when the path isn't in a schema
export function schemaInfo(path: string, files?: Record<string, unknown>): SchemaInfo {
  const node = nodeAt(path, files)
  if (!node) return {}
  const { description, default: def, defaultText, see } = node
  return { description, default: def, defaultText, see }
}

// for a union item, like one layer, its own variant's fields
export function fieldsAt(path: string, files: Record<string, unknown>): string[] {
  const node = nodeAt(path, files)
  if (!node) return []
  const [file, dotted] = path.split(':')
  const data = dotted.split('.').filter(Boolean).reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], files[file])
  return Object.keys(resolve(node, data).properties ?? {})
}

// names as people write them, other values are turned into words
const WORDS: Record<string, string> = {
  geojson: 'GeoJSON',
  geoparquet: 'GeoParquet',
  kml: 'KML',
  csv: 'CSV',
  maptiler: 'MapTiler',
  conness: 'Conness',
}

// 'top-left' reads "Top left", 'text' reads "Muted text"
export function humanizeOption(value: string): string {
  if (WORDS[value]) return WORDS[value]
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type Control =
  | { kind: 'switch' }
  | { kind: 'select'; options: string[] }
  | { kind: 'number'; unit?: string; min?: number; max?: number; step?: number }
  | { kind: 'slider' }
  | { kind: 'text' }
  | { kind: 'multi'; options: string[] }
  // a number, or one of a few words like "auto"
  | { kind: 'number-or-word'; words: string[] }
  | { kind: 'color' }
  | { kind: 'lnglat' }
  | { kind: 'bounds' }
  | { kind: 'basemap' }
  | { kind: 'side-widget' }
  | { kind: 'top-widget' }
  // a free list of words, typed comma-separated (a searchable layer's fields)
  | { kind: 'text-list' }
  // one of the project's GeoJSON layers (a searchable layer's layerId)
  | { kind: 'layer' }
  // one column of that entry's layer, read from its data
  | { kind: 'column' }
  // a style URL as text, an inline style object stays read-only
  | { kind: 'style' }
  // a FilePicker whose empty choice names the default image
  | { kind: 'thumbnail' }
  // a popup template from the project's popups.tsx (ui.popups.displayType)
  | { kind: 'popup-template' }
  // any CSS color on the map, picked or typed
  | { kind: 'map-color' }
  // one of a layer's columns, read by the preview
  | { kind: 'layer-column' }
  // whole numbers typed comma-separated (an Esri layer's sublayer ids)
  | { kind: 'number-list' }
  // off, on, or on as vector tiles ({ mvt: true })
  | { kind: 'duckdb' }
  // a file from a project folder, with Upload (the logo, a basemap's thumbnail)
  | { kind: 'file'; folder: string }
  | { kind: 'readonly' }

// settings whose value means more than its JSON type says
const SPECIAL: Record<string, Control> = {
  'settings:map.center': { kind: 'lnglat' },
  'settings:map.maxBounds': { kind: 'bounds' },
  'settings:map.style': { kind: 'basemap' },
  'settings:ui.layout.sideRailOpenOnLoad': { kind: 'side-widget' },
  'settings:ui.layout.topBarOpenOnLoad': { kind: 'top-widget' },
  'settings:ui.popups.displayType': { kind: 'popup-template' },
  'settings:branding.logo': { kind: 'file', folder: 'public' },
  'settings:branding.favicon': { kind: 'file', folder: 'public' },
  'settings:ui.layerDefaults.label.color': { kind: 'map-color' },
  'settings:ui.layerDefaults.label.haloColor': { kind: 'map-color' },
  'settings:map.backgroundColor': { kind: 'map-color' },
}
// the same for list items, whose paths carry an index
const SPECIAL_ITEMS: [RegExp, Control][] = [
  [/^settings:widgets\.search\.layers\.\d+\.layerId$/, { kind: 'layer' }],
  [/^settings:widgets\.search\.layers\.\d+\.(fields|labelField)$/, { kind: 'column' }],
  [/^basemaps:basemaps\.\d+\.style$/, { kind: 'style' }],
  [/^layers:layers\.\d+\.layers$/, { kind: 'number-list' }],
  // opacities as numbers stepping by 0.1 (the arrows stay within 0 to 1)
  [/^layers:layers\.\d+(\.sourceLayers\.\d+)?\.(symbology\.(opacity|strokeOpacity)|rasterOpacity|esriOpacity)$/, { kind: 'number', min: 0, max: 1, step: 0.1 }],
  // a layer's or one of its source layers' (layers.3.sourceLayers.1)
  [/^layers:layers\.\d+(\.sourceLayers\.\d+)?\.(symbology\.(color|strokeColor)|label\.(color|haloColor))$/, { kind: 'map-color' }],
  [/^layers:layers\.\d+(\.sourceLayers\.\d+)?\.(label\.field|popup\.title)$/, { kind: 'layer-column' }],
  [/^layers:layers\.\d+\.filters\.\d+\.column$/, { kind: 'layer-column' }],
  [/^layers:layers\.\d+(\.sourceLayers\.\d+)?\.popup\.displayType$/, { kind: 'popup-template' }],
  [/^layers:layers\.\d+\.duckdb$/, { kind: 'duckdb' }],
  [/^basemaps:basemaps\.\d+\.thumbnail$/, { kind: 'thumbnail' }],
  [/^settings:widgets\.basemap\.(hillshade\.(highlight|shadow|accent)Color|contours\.(line|label)Color)$/, { kind: 'map-color' }],
]

// what's left, like objects and lists, stays read-only
export function controlFor(path: string, files?: Record<string, unknown>): Control {
  if (SPECIAL[path]) return SPECIAL[path]
  const item = SPECIAL_ITEMS.find(([pattern]) => pattern.test(path))
  if (item) return item[1]
  // theme colors are Tailwind color names ("blue-900"), picked from the palette
  if (path.startsWith('theme:colors.')) return { kind: 'color' }
  const node = nodeAt(path, files)
  if (!node || path.endsWith('.*')) return { kind: 'readonly' }
  if (node.enum) return { kind: 'select', options: node.enum }
  if (node.type === 'boolean') return { kind: 'switch' }
  if (node.type === 'number' || node.type === 'integer') {
    if (node.minimum === 0 && node.maximum === 1) return { kind: 'slider' }
    const text = node.description ?? ''
    return { kind: 'number', unit: /\bpx\b/.test(text) ? 'px' : /degree/i.test(text) ? '°' : undefined }
  }
  if (node.type === 'string') return { kind: 'text' }
  const items = Array.isArray(node.items) ? undefined : node.items
  if (node.type === 'array' && items?.enum) return { kind: 'multi', options: items.enum }
  if (node.type === 'array' && items?.type === 'string') return { kind: 'text-list' }
  const variants = node.anyOf ?? []
  const words = variants.flatMap((v) => (typeof v.const === 'string' ? [v.const] : []))
  if (words.length > 0 && words.length === variants.length - 1 && variants.some((v) => v.type === 'number')) {
    return { kind: 'number-or-word', words }
  }
  return { kind: 'readonly' }
}
