import * as maplibregl from 'maplibre-gl'
import type { ControlPosition, IControl, Map as MapLibreMap } from 'maplibre-gl'
import { settings } from '@user/settings'
import type { MapControlsConfig } from '@/core/types'
import { TERRAIN_SOURCE_ID } from '@/core/map/terrain'
import { useStore } from '@/core/store'
import { showBusy } from '@/ui/showBusy'
import { ScaleBarControl } from './scaleBar'

// the zoom readout, styled by .kit-zoom-level in index.css
class ZoomLevelControl implements IControl {
  private el = document.createElement('div')
  private map: MapLibreMap | undefined
  private readonly precision: number

  constructor(precision: number) {
    this.precision = precision
  }

  private update = () => {
    if (this.map) this.el.textContent = `z ${this.map.getZoom().toFixed(this.precision)}`
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map
    this.el.className = 'maplibregl-ctrl kit-zoom-level'
    this.el.setAttribute('aria-label', 'Zoom level')
    map.on('zoom', this.update)
    this.update()
    return this.el
  }

  onRemove(): void {
    this.map?.off('zoom', this.update)
    this.el.remove()
    this.map = undefined
  }
}

// a globe with a turning arrow, and pause or play inside it
const SPIN_ICON = (paused: boolean) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M18 2.8v3.6h-3.6" />
  ${paused ? '<path d="M10 8.8v6.4l5-3.2z" fill="currentColor" stroke="none" />' : '<path d="M10 9v6M14 9v6" />'}
</svg>`

// pauses and plays the globe's spin, hidden while there's no spin
class SpinControl implements IControl {
  private el = document.createElement('div')
  private button = document.createElement('button')
  private unsubscribe: (() => void) | undefined

  private update = () => {
    const paused = useStore.getState().spinPaused
    const label = paused ? 'Spin globe' : 'Pause globe spin'
    this.el.hidden = !settings.map.globe?.spin
    this.button.innerHTML = SPIN_ICON(paused)
    this.button.title = label
    this.button.setAttribute('aria-label', label)
    this.button.setAttribute('aria-pressed', String(paused))
  }

  onAdd(): HTMLElement {
    this.el.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    this.button.type = 'button'
    this.button.className = 'kit-spin-control'
    this.button.addEventListener('click', () => useStore.getState().setSpinPaused(!useStore.getState().spinPaused))
    this.el.append(this.button)
    this.update()
    this.unsubscribe = useStore.subscribe((s, prev) => {
      if (s.spinPaused !== prev.spinPaused || s.settingsVersion !== prev.settingsVersion) this.update()
    })
    return this.el
  }

  onRemove(): void {
    this.unsubscribe?.()
    this.el.remove()
  }
}

// MapLibre puts bottom-corner controls first and others last
// so the new element is found by what wasn't in the corner before
const added: IControl[] = []

function add(map: MapLibreMap, control: IControl, position: ControlPosition, order = 0): Element | undefined {
  added.push(control)
  const corner = map.getContainer().querySelector(`.maplibregl-ctrl-${position}`)
  const before = new Set(corner ? Array.from(corner.children) : [])
  map.addControl(control, position)
  const element = corner && Array.from(corner.children).find((el) => !before.has(el))
  if (element instanceof HTMLElement && order !== 0) element.style.order = String(order)
  return element ?? undefined
}

const BUSY_CAP_MS = 10_000

// the click waits 2 frames to paint the spinner
// tiles, not idle, as a spinning globe never idles
function busyOnToggle(map: MapLibreMap, element: Element | undefined) {
  const button = element?.querySelector('button')
  if (!button) return
  let busy = false
  let replaying = false
  button.addEventListener(
    'click',
    (e) => {
      if (replaying) return
      e.stopImmediatePropagation()
      if (busy) return
      busy = true
      const done = showBusy(button)
      const finish = () => {
        map.off('render', check)
        clearTimeout(cap)
        done()
        busy = false
      }
      const check = () => {
        if (map.areTilesLoaded()) finish()
      }
      const cap = setTimeout(finish, BUSY_CAP_MS)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          replaying = true
          button.click()
          replaying = false
          map.on('render', check)
          map.triggerRepaint()
        }),
      )
    },
    { capture: true },
  )
}

export function registerMapControls(
  map: MapLibreMap,
  config: MapControlsConfig | undefined,
): void {
  // one map at a time (StrictMode makes two)
  added.length = 0
  // always on for licenses, a high order keeps it at the corner's edge
  const { position = 'bottom-right', order = 1000 } = config?.attribution ?? {}
  const credit = '<a href="https://conness-gis.com" target="_blank" rel="noopener">Made with Conness GIS</a>'
  add(map, new maplibregl.AttributionControl({ compact: true, customAttribution: credit }), position, order)
  if (!config) {
    repaintInvertedIcons(map)
    return
  }

  if (config.navigation) {
    // default off. reset turns the map north and flattens 3D to 2D
    const { position = 'top-left', order, ...options } = config.navigation
    add(map, new maplibregl.NavigationControl({ visualizePitch: true, ...options }), position, order)
  }

  if (config.geolocate) {
    const { position = 'top-left', order, ...options } = config.geolocate
    add(map, new maplibregl.GeolocateControl(options), position, order)
  }

  if (config.fullscreen) {
    const { position = 'top-right', order } = config.fullscreen
    add(map, new maplibregl.FullscreenControl(), position, order)
  }

  if (config.globe) {
    const { position = 'top-right', order } = config.globe
    busyOnToggle(map, add(map, new maplibregl.GlobeControl(), position, order))
  }

  if (config.spin) {
    const { position = 'top-right', order } = config.spin
    add(map, new SpinControl(), position, order)
  }

  if (config.scale) {
    const { position = 'bottom-left', order, ...options } = config.scale
    add(map, new ScaleBarControl(options), position, order)
  }

  if (config.zoomLevel) {
    const { position = 'bottom-left', precision = 1, order } = config.zoomLevel
    add(map, new ZoomLevelControl(precision), position, order)
  }

  if (config.terrain) {
    const { position = 'top-right', exaggeration, order } = config.terrain
    const element = add(
      map,
      new maplibregl.TerrainControl({
        source: TERRAIN_SOURCE_ID,
        ...(exaggeration !== undefined ? { exaggeration } : {}),
      }),
      position,
      order,
    )
    busyOnToggle(map, element)
  }
  repaintInvertedIcons(map)
}

// safari leaves a filtered data-uri icon blank if it decodes late
function repaintInvertedIcons(map: MapLibreMap) {
  if (document.documentElement.dataset.mapControls !== 'dark') return
  const icons = map.getContainer().querySelectorAll<HTMLElement>('.maplibregl-ctrl-icon, .maplibregl-ctrl-attrib-button')
  for (const el of icons) {
    const url = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]
    if (!url) continue
    const img = new Image()
    img.src = url
    img
      .decode()
      .then(() => {
        el.style.transform = 'translateZ(0)'
        requestAnimationFrame(() => (el.style.transform = ''))
      })
      .catch(() => {})
  }
}

// a live change turns every control off, then on as the settings say
export function replaceMapControls(map: MapLibreMap, config: MapControlsConfig | undefined): void {
  for (const control of added.splice(0)) map.removeControl(control)
  registerMapControls(map, config)
}
