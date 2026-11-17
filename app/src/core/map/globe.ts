import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GlobeConfig } from '../types'
import { useStore } from '../store'

const DEFAULT_SPIN_SPEED = 6 // deg longitude/sec (~1 rev/min)

export function isGlobeActive(map: MapLibreMap): boolean {
  const projection = map.getProjection?.()
  return projection?.type === 'globe'
}

// `enabled` forces the globe, otherwise keep the user's toggle
export function applyGlobe(map: MapLibreMap, config: GlobeConfig): void {
  if (config.enabled) {
    map.setProjection({ type: 'globe' })
  }
}

const RESUME_DELAY_MS = 500

// spins center longitude, not bearing (which would tilt north)
export function startGlobeSpin(
  map: MapLibreMap,
  config: GlobeConfig,
): () => void {
  const noop = () => {}
  // setProjection's type lags a frame, so trust config.enabled too
  if (!config.spin || !(config.enabled || isGlobeActive(map))) return noop

  const continuous = Boolean(config.spin.continuous)
  const speed = config.spin.speed ?? DEFAULT_SPIN_SPEED
  // 'east' surface motion = map scrolls west (decreasing lng)
  const sign = config.spin.direction === 'west' ? 1 : -1
  const degPerMs = (speed * sign) / 1000

  let rafId = 0
  let lastTs: number | null = null
  let running = true
  let disposed = false
  let resumeTimer: ReturnType<typeof setTimeout> | null = null
  // true during our own setCenter, so onMoveStart can ignore it
  let spinning = false
  // reduced motion starts paused, so the play button can still spin it
  useStore.getState().setSpinPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const frame = (ts: number) => {
    if (disposed) return
    // setCenter calls stop(), which would cancel a flyTo or fight a drag
    const turning = running && !useStore.getState().spinPaused && !map.isMoving()
    if (turning && lastTs !== null) {
      const delta = ts - lastTs
      const center = map.getCenter()
      let lng = center.lng + degPerMs * delta
      if (lng > 180) lng -= 360
      else if (lng < -180) lng += 360
      spinning = true
      map.setCenter([lng, center.lat])
      spinning = false
    }
    // track ts only while turning, so resume doesn't jump
    lastTs = turning ? ts : null
    rafId = requestAnimationFrame(frame)
  }

  // any other camera move counts, don't spin away from where the app flew
  const onMoveStart = () => {
    if (!spinning) onInteract()
  }

  // a press with no camera move counts too, except on a control
  const container = map.getContainer()
  const interactionEvents = ['pointerdown', 'wheel', 'touchstart'] as const
  const onPress = (e: Event) => {
    if (!(e.target instanceof Element && e.target.closest('.maplibregl-ctrl'))) onInteract()
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(rafId)
    map.off('idle', start)
    if (resumeTimer) clearTimeout(resumeTimer)
    for (const ev of interactionEvents) {
      container.removeEventListener(ev, onPress)
    }
    map.off('movestart', onMoveStart)
  }

  const onInteract = () => {
    if (disposed) return
    // paused, not stopped, so the pause / play button can start it again
    if (!continuous) {
      useStore.getState().setSpinPaused(true)
      return
    }
    running = false
    if (resumeTimer) clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      resumeTimer = null
      running = true
    }, RESUME_DELAY_MS)
  }

  for (const ev of interactionEvents) {
    container.addEventListener(ev, onPress, { passive: true })
  }
  map.on('movestart', onMoveStart)

  // the first idle, so spin frames don't hold up the first tiles
  const start = () => {
    if (!disposed) rafId = requestAnimationFrame(frame)
  }
  map.once('idle', start)
  // an already idle map renders once more, which fires idle
  map.triggerRepaint()
  return dispose
}
