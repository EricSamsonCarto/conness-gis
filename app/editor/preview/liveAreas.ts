// changes the pane applies without a reload. no imports, so tests run it

type Files = Record<string, unknown>

// a changed leaf is live at one of these paths or under one
const LIVE = [
  'theme:',
  // layer changes go one layer at a time, named styles redraw their layers
  'layers:',
  'symbology:',
  'settings:layerGroups',
  'settings:branding.title',
  'settings:branding.description',
  'settings:branding.logo',
  'settings:branding.favicon',
  'settings:ui.topBar',
  'settings:ui.mobile',
  'settings:ui.hideWidgetInfo',
  // every layer with labels is redrawn
  'settings:ui.layerDefaults',
  // applied to the map, the globe's projection, stars and spin, wheel zoom
  'settings:map.globe',
  'settings:map.scrollZoom',
  'settings:map.backgroundColor',
  // restricted basemaps leave the list, and the geocoder is checked again
  'settings:commercialUse',
  // read while the shell and widgets draw, or (popups) on the next click
  'settings:ui.info.width',
  'settings:ui.info.maxHeight',
  'settings:ui.info.watermark',
  'settings:ui.info.allowDismiss',
  'settings:ui.popups',
  'settings:contextMenu',
  'settings:widgets.search',
  'settings:widgets.basemap',
  'settings:widgets.layer-list',
  'settings:widgets.bookmarks',
  // mounted again with their new settings (WidgetBoundary)
  'settings:widgets.draw',
  'settings:widgets.measure',
  // a basemap's name or style switches again, map controls are swapped
  'basemaps:',
  'settings:map.style',
  'settings:mapControls',
  // layout and widget places, read while it draws, and camera limits
  'settings:ui.layout',
  'settings:ui.widgetHeader',
  'settings:ui.loader',
  'settings:topBarWidgets',
  'settings:sidePanelWidgets',
  'settings:floatingWidgets',
  'settings:mobileWidgets',
  'settings:map.minZoom',
  'settings:map.maxZoom',
  'settings:map.maxBounds',
  // only read at start, the preview keeps its own state across reloads
  'settings:map.center',
  'settings:map.zoom',
  'settings:map.bearing',
  'settings:map.pitch',
  'settings:map.onlyVisibleOnLoad',
  'settings:ui.info.autoOpen',
  'settings:ui.layout.sideRailOpenOnLoad',
  'settings:ui.layout.topBarOpenOnLoad',
  'settings:ui.textSizes',
  // the sizes core/theme/uiVars.ts turns into CSS variables
  'settings:ui.floatingControls.iconSize',
  'settings:ui.floatingControls.mobileIconSize',
  'settings:ui.layout.sideRailIconSize',
  'settings:ui.buttonCursor',
]

// same items in the same order compare one by one, any other list
// counts as one leaf, so an added, removed or moved layer reloads
function sameIds(a: unknown, b: unknown): a is Files[] {
  const keyOf = (item: object) => ('id' in item ? item.id : 'sourceLayer' in item ? item.sourceLayer : undefined)
  const ids = (v: unknown) =>
    Array.isArray(v) && v.every((item) => item !== null && typeof item === 'object' && keyOf(item) !== undefined)
      ? v.map((item) => keyOf(item as object))
      : null
  const x = ids(a)
  return x !== null && JSON.stringify(x) === JSON.stringify(ids(b))
}

// every leaf whose value differs between the two, as 'file:dotted.path'
export function changedPaths(before: Files, after: Files): string[] {
  const out: string[] = []
  const walk = (a: unknown, b: unknown, at: string) => {
    const objects = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v)
    // a group on one side only is its leaves, an empty one is a leaf itself
    const filled = (v: unknown) => objects(v) && Object.keys(v as object).length > 0
    if (a === undefined && filled(b)) a = {}
    if (b === undefined && filled(a)) b = {}
    if (sameIds(a, b)) {
      a.forEach((item, i) => walk(item, (b as Files[])[i], `${at}.${i}`))
    } else if (objects(a) && objects(b)) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
      for (const key of keys) walk((a as Files)[key], (b as Files)[key], at.endsWith(':') ? `${at}${key}` : `${at}.${key}`)
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push(at)
    }
  }
  for (const file of new Set([...Object.keys(before), ...Object.keys(after)])) walk(before[file], after[file], `${file}:`)
  return out
}

// not live, since thumbnails are built into the app at load
const NOT_LIVE = [/^basemaps:basemaps\.\d+\.thumbnail$/]

const basemapIds = (files: Files | undefined) =>
  ((files?.basemaps as { basemaps?: { id?: unknown }[] } | undefined)?.basemaps ?? []).map((b) => b.id)

// a reordered or shortened basemap list is live, an added one waits
export function livePath(path: string, before?: Files, after?: Files): boolean {
  if (path === 'basemaps:basemaps') {
    const had = basemapIds(before)
    return before !== undefined && basemapIds(after).every((id) => had.includes(id))
  }
  if (NOT_LIVE.some((pattern) => pattern.test(path))) return false
  return LIVE.some((live) => path === live || path.startsWith(live.endsWith(':') ? live : `${live}.`))
}

export function isLive(before: Files, after: Files): boolean {
  const changed = changedPaths(before, after)
  return changed.length > 0 && changed.every((path) => livePath(path, before, after))
}

// `before` with only the live changes of `after`, or null when there are none
export function liveChanges(before: Files, after: Files): Files | null {
  const live = changedPaths(before, after).filter((path) => livePath(path, before, after))
  if (live.length === 0) return null
  const out = structuredClone(before)
  for (const path of live) {
    const [file, dotted] = path.split(/:(.*)/s)
    const keys = dotted.split('.')
    const value = keys.reduce<unknown>((v, k) => (v as Files | undefined)?.[k], after[file])
    let node = (out[file] ??= {}) as Files
    const parents = [node]
    for (const key of keys.slice(0, -1)) parents.push((node = (node[key] ??= {}) as Files))
    if (value !== undefined) {
      node[keys.at(-1)!] = structuredClone(value)
      continue
    }
    delete node[keys.at(-1)!]
    // an emptied parent `after` lacks goes too, {} would turn a block on
    for (let i = keys.length - 1; i > 0; i--) {
      const gone = keys.slice(0, i).reduce<unknown>((v, k) => (v as Files | undefined)?.[k], after[file]) === undefined
      if (!gone || Object.keys(parents[i]).length > 0) break
      delete parents[i - 1][keys[i - 1]]
    }
  }
  return out
}
