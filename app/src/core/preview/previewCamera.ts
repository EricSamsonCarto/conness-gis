import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl'
import { popupTemplates } from '@user/popups'
import { settings } from '@user/settings'
import { isGlobeActive } from '../map/globe'
import { applyLiveSettings } from './liveSettings'
import { useStore } from '../store'

// kept under the editor page's id, since sessionStorage outlives an editor
// reload, which should start at the configured camera
const preview = new URLSearchParams(location.search).get('conness-preview')
const active = import.meta.env.DEV && preview !== null
const PREFIX = 'conness-preview:'
const KEY = `${PREFIX}camera:${preview}`
const STATE_KEY = `${PREFIX}state:${preview}`
if (active) {
  try {
    // cameras and states saved by earlier editor pages
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX) && !key.endsWith(`:${preview}`)) sessionStorage.removeItem(key)
    }
  } catch {
    // storage blocked, nothing saved anyway
  }
}

type Camera = { center: [number, number]; zoom: number; bearing: number; pitch: number; globe: boolean }

function saved(): Camera | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

export function restorePreviewCamera(options: MapOptions): void {
  const camera = active ? saved() : null
  if (!camera) return
  const { center, zoom, bearing, pitch } = camera
  Object.assign(options, { center, zoom, bearing, pitch })
}

const round = (n: number, places: number) => Number(n.toFixed(places))

// the pane says when it's listening, the map can come after the iframe's load
export function connectPreview(map: MapLibreMap): () => void {
  if (!active) return () => {}
  map.scrollZoom.disable()
  // the wheel zooms only with the editor's Map Zoom and scrollZoom both on
  let pillOn = false
  const applyWheel = () =>
    pillOn && (settings.map.scrollZoom ?? true) ? map.scrollZoom.enable() : map.scrollZoom.disable()

  // what the editor can ask, by question
  const answers: Record<string, (details: Record<string, unknown>) => unknown> = {
    // "Use current view"
    view: () => {
      const { lng, lat } = map.getCenter()
      const b = map.getBounds()
      return {
        center: [round(lng, 5), round(lat, 5)],
        zoom: round(map.getZoom(), 2),
        bearing: round(map.getBearing(), 1),
        pitch: round(map.getPitch(), 1),
        bounds: [
          [round(b.getWest(), 5), round(b.getSouth(), 5)],
          [round(b.getEast(), 5), round(b.getNorth(), 5)],
        ],
      }
    },
    // search code loads only when asked, so built apps don't carry it
    columns: ({ layerId }) =>
      import('../search/featureSearch').then(({ layerColumns }) => layerColumns(String(layerId), settings.layers)),
    // any layer's columns, a source layer's for vector tiles
    'layer-columns': ({ layerId, sourceLayer }) =>
      import('../layers/layerColumns').then(({ layerColumns }) =>
        layerColumns(map, String(layerId), typeof sourceLayer === 'string' ? sourceLayer : undefined, settings.layers),
      ),
    // by type and URL, the layer may not be drawn yet
    'source-layers': ({ layerType, url }) =>
      import('../layers/sourceLayerNames').then(({ sourceLayerNames }) => sourceLayerNames(String(layerType), String(url))),
    // popups.tsx's templates, named by displayName or their key in words
    'popup-templates': () =>
      Object.entries(popupTemplates).map(([name, template]) => {
        const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
        return { name, label: template.displayName ?? words.charAt(0).toUpperCase() + words.slice(1) }
      }),
  }

  const onMessage = (e: MessageEvent) => {
    if (e.source !== window.parent) return
    if (e.data?.type === 'conness:map-zoom') {
      pillOn = Boolean(e.data.on)
      applyWheel()
    }
    if (e.data?.type === 'conness:ask') {
      const { id, question, ...details } = e.data
      const reply = (body: { value?: unknown; error?: string }) =>
        window.parent.postMessage({ type: 'conness:answer', id, ...body }, '*')
      const answer = answers[question]
      if (!answer) return reply({ error: `The preview can't answer "${question}".` })
      Promise.resolve()
        .then(() => answer(details))
        .then(
          (value) => reply({ value }),
          (err: unknown) => reply({ error: err instanceof Error ? err.message : String(err) }),
        )
    }
  }
  // changes that apply without a reload, sent instead of reloading
  const onLive = (next: Parameters<typeof applyLiveSettings>[0]) => {
    try {
      applyLiveSettings(next)
      applyWheel()
      window.parent.postMessage({ type: 'conness:applied' }, '*')
    } catch {
      window.location.reload()
    }
  }
  import.meta.hot?.on('conness:live', onLive)
  window.addEventListener('message', onMessage)
  window.parent.postMessage({ type: 'conness:ready' }, '*')
  return () => {
    window.removeEventListener('message', onMessage)
    import.meta.hot?.off('conness:live', onLive)
  }
}

type PreviewState = {
  map: import('../map/mapState').MapState
  openWidgetId: string | null
  activeFloatingWidgetId: string | null
  sideRailWidgetId?: string | null
}

// what was set while testing, saved when Refresh Settings reloads the pane
// mapState loads only here, so built apps without bookmarks don't carry it
export function keepPreviewState(map: MapLibreMap): () => void {
  if (!active) return () => {}
  let capture: ((map: MapLibreMap) => PreviewState['map']) | undefined
  void import('../map/mapState').then((m) => (capture = m.captureMapState))
  // unsaved until 2 frames after load, projection lags one
  // an earlier reload, like vite's cold start, would save a flat globe
  let ready = false
  map.once('load', () => requestAnimationFrame(() => requestAnimationFrame(() => (ready = true))))
  const save = () => {
    if (!capture || !ready) return
    const { openWidgetId, activeFloatingWidgetId, sideRailWidgetId } = useStore.getState()
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ map: capture(map), openWidgetId, activeFloatingWidgetId, sideRailWidgetId }))
    } catch {
      // storage blocked, the pane reloads as the settings say
    }
  }
  window.addEventListener('pagehide', save)
  return () => window.removeEventListener('pagehide', save)
}

// after the layers register, at the camera already restored, so nothing flies
export async function restorePreviewState(map: MapLibreMap): Promise<void> {
  if (!active) return
  let state: PreviewState | null
  try {
    state = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null')
  } catch {
    return
  }
  if (!state) return
  const store = useStore.getState()
  // null is a panel the user closed, so the setting doesn't reopen it
  if (state.openWidgetId !== undefined) store.setOpenWidget(state.openWidgetId)
  if (state.activeFloatingWidgetId) store.setActiveFloatingWidget(state.activeFloatingWidgetId)
  // null is a rail the user closed, undefined one they never touched
  if (state.sideRailWidgetId !== undefined) store.setSideRailWidget(state.sideRailWidgetId)
  const exists = ([id]: [string, unknown]) => store.layerMetadata[id] !== undefined
  const { lng, lat } = map.getCenter()
  const { applyMapState } = await import('../map/mapState')
  await applyMapState(
    map,
    {
      ...state.map,
      layers: Object.fromEntries(Object.entries(state.map.layers).filter(exists)),
      ...(state.map.filters ? { filters: Object.fromEntries(Object.entries(state.map.filters).filter(exists)) } : {}),
      center: { lng, lat },
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      roll: map.getRoll(),
    },
    'preview',
  )
}

export function trackPreviewCamera(map: MapLibreMap): void {
  if (!active) return
  // shortcut: only turns the globe back on, settings can bring it back
  if (saved()?.globe) map.once('load', () => map.setProjection({ type: 'globe' }))
  map.on('moveend', () => {
    const { lng, lat } = map.getCenter()
    const camera: Camera = {
      center: [lng, lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      globe: isGlobeActive(map),
    }
    try {
      sessionStorage.setItem(KEY, JSON.stringify(camera))
    } catch {
      // storage blocked, the pane reloads at the configured camera
    }
  })
}
