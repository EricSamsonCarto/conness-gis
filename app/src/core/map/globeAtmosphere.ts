import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GlobeConfig } from '../types'
import { isGlobeActive } from './globe'

// canvas overlays, not MapLibre's sky. technique from
// https://leoneljdias.github.io/posts/globe-atmosphere-halo-comets/

const DEFAULT_ZOOM_CUTOFF = 7.3

const STAR_DENSITY_PX2 = 900 // ~1 star per this many px²
const STAR_MIN_RADIUS = 0.2
const STAR_MAX_RADIUS = 1.5
const STAR_MIN_ALPHA = 0.15
const STAR_MAX_ALPHA = 0.75
const STAR_GLOW_RADIUS_THRESHOLD = 1.1
const STAR_GLOW_MULTIPLIER = 3
const STAR_PARALLAX_PX_PER_DEG = 8

const COMET_SPAWN_CHANCE_PER_FRAME = 0.005
const COMET_LEN_MIN = 150
const COMET_LEN_MAX = 350
const COMET_SPEED_MIN = 6
const COMET_SPEED_MAX = 14
const COMET_LIFE_MIN = 80
const COMET_LIFE_MAX = 120
const COMET_HEAD_GLOW_RADIUS = 6

const EARTH_RADIUS_KM = 6371
// 90° of arc, the true limb of an orthographic sphere, close enough
const HALO_LIMB_ARC_KM = (Math.PI * EARTH_RADIUS_KM) / 2
const HALO_BEARING_SAMPLES = [0, 45, 90, 135, 180, 225, 270, 315]
const HALO_INNER_MULTIPLIER = 1.06
const HALO_OUTER_MULTIPLIER = 1.50
// drawHalo's radius overshoots at high pitch and zoom and the ring
// brightens, so cut it off before stars and comets
const HALO_ZOOM_CUTOFF = 3.3
// internal only. ramp to 0 at the cutoff so the ring eases out
const HALO_FADE_START_ZOOM = 2.3

interface AtmosphereCanvases {
  stars: HTMLCanvasElement
  comets: HTMLCanvasElement
  halo: HTMLCanvasElement
}

interface Star {
  x: number
  y: number
  r: number
  color: string
}

interface Comet {
  x: number
  y: number
  angle: number
  speed: number
  len: number
  life: number
  maxLife: number
}

function destinationPoint(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const angular = distanceKm / EARTH_RADIUS_KM
  const bearing = (bearingDeg * Math.PI) / 180
  const phi1 = (lat * Math.PI) / 180
  const lambda1 = (lng * Math.PI) / 180

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angular) +
      Math.cos(phi1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(phi1),
      Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2),
    )
  return [(lambda2 * 180) / Math.PI, (phi2 * 180) / Math.PI]
}

function generateStars(width: number, height: number): Star[] {
  const count = Math.round((width * height) / STAR_DENSITY_PX2)
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const r = STAR_MIN_RADIUS + Math.random() * (STAR_MAX_RADIUS - STAR_MIN_RADIUS)
    const alpha = STAR_MIN_ALPHA + Math.random() * (STAR_MAX_ALPHA - STAR_MIN_ALPHA)
    const roll = Math.random()
    const color =
      roll < 0.1
        ? `hsla(220, 70%, 85%, ${alpha})`
        : roll < 0.2
          ? `hsla(40, 70%, 85%, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`
    stars.push({ x: Math.random() * width, y: Math.random() * height, r, color })
  }
  return stars
}

function wrap(value: number, max: number): number {
  return ((value % max) + max) % max
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  backgroundColor: string,
): void {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)

  for (const star of stars) {
    const x = wrap(star.x - offsetX, width)
    const y = wrap(star.y - offsetY, height)

    if (star.r > STAR_GLOW_RADIUS_THRESHOLD) {
      const glowR = star.r * STAR_GLOW_MULTIPLIER
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR)
      glow.addColorStop(0, star.color)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, glowR, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = star.color
    ctx.beginPath()
    ctx.arc(x, y, star.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function spawnComet(width: number, height: number): Comet {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    angle: Math.random() * Math.PI * 2,
    speed: COMET_SPEED_MIN + Math.random() * (COMET_SPEED_MAX - COMET_SPEED_MIN),
    len: COMET_LEN_MIN + Math.random() * (COMET_LEN_MAX - COMET_LEN_MIN),
    life: 0,
    maxLife: COMET_LIFE_MIN + Math.random() * (COMET_LIFE_MAX - COMET_LIFE_MIN),
  }
}

function cometAlpha(comet: Comet): number {
  const fadeIn = comet.maxLife * 0.2
  if (comet.life < fadeIn) return comet.life / fadeIn
  return 1 - (comet.life - fadeIn) / (comet.maxLife - fadeIn)
}

function drawComet(ctx: CanvasRenderingContext2D, comet: Comet): void {
  const alpha = cometAlpha(comet)
  const tailX = comet.x - Math.cos(comet.angle) * comet.len
  const tailY = comet.y - Math.sin(comet.angle) * comet.len

  const trail = ctx.createLinearGradient(tailX, tailY, comet.x, comet.y)
  trail.addColorStop(0, 'rgba(255, 255, 255, 0)')
  trail.addColorStop(1, `rgba(255, 255, 255, ${alpha})`)
  ctx.strokeStyle = trail
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(comet.x, comet.y)
  ctx.stroke()

  const glow = ctx.createRadialGradient(
    comet.x, comet.y, 0,
    comet.x, comet.y, COMET_HEAD_GLOW_RADIUS,
  )
  glow.addColorStop(0, `rgba(200, 220, 255, ${alpha})`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(comet.x, comet.y, COMET_HEAD_GLOW_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

function haloAlpha(zoom: number): number {
  if (zoom <= HALO_FADE_START_ZOOM) return 1
  if (zoom >= HALO_ZOOM_CUTOFF) return 0
  return 1 - (zoom - HALO_FADE_START_ZOOM) / (HALO_ZOOM_CUTOFF - HALO_FADE_START_ZOOM)
}

// box of points 90° away in 8 directions, so it stays aligned with pitch
function drawHalo(
  ctx: CanvasRenderingContext2D,
  map: MapLibreMap,
  width: number,
  height: number,
  alpha: number,
): void {
  ctx.clearRect(0, 0, width, height)

  const center = map.getCenter()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const bearing of HALO_BEARING_SAMPLES) {
    const [lng, lat] = destinationPoint(center.lng, center.lat, bearing, HALO_LIMB_ARC_KM)
    const point = map.project([lng, lat])
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  if (!Number.isFinite(minX)) return

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radius = Math.max(maxX - minX, maxY - minY) / 2
  if (radius <= 0) return

  const gradient = ctx.createRadialGradient(
    cx, cy, radius * HALO_INNER_MULTIPLIER,
    cx, cy, radius * HALO_OUTER_MULTIPLIER,
  )
  gradient.addColorStop(0, 'rgba(200, 235, 255, 0.5)')
  gradient.addColorStop(1, 'rgba(160, 210, 255, 0)')

  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = alpha
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

// drawing coordinates stay in CSS px
function sizeCanvas(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { width, height }
}

// past starsZoomCutoff the canvas clears and the wrapper's CSS background
// (same color) shows through, so space never reads as a gap
export function startGlobeAtmosphere(
  map: MapLibreMap,
  canvases: AtmosphereCanvases,
  config: GlobeConfig,
  // must match the wrapper's CSS background, or a seam shows
  backgroundColor: string,
): () => void {
  const zoomCutoff = config.starsZoomCutoff ?? DEFAULT_ZOOM_CUTOFF
  const wantStars = Boolean(config.stars)
  // their loop draws every frame, so reduced motion goes without
  const wantComets =
    Boolean(config.comets) && wantStars && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const wantHalo = config.atmosphere ?? true

  const starsCtx = canvases.stars.getContext('2d')
  const cometsCtx = canvases.comets.getContext('2d')
  const haloCtx = canvases.halo.getContext('2d')
  if (!starsCtx || !cometsCtx || !haloCtx) return () => {}

  let stars: Star[] = []
  let starsSize = { width: 0, height: 0 }
  let baseCenter = map.getCenter()
  // summed the short way round, the raw difference jumps 360° at the
  // date line and would skip the stars sideways
  let lastLng = baseCenter.lng
  let travelledLng = 0
  let active = false
  let cometRafId = 0
  let activeComet: Comet | null = null
  let disposed = false

  function isVisible(): boolean {
    return isGlobeActive(map) && map.getZoom() <= zoomCutoff
  }

  function clearAll(): void {
    starsCtx!.clearRect(0, 0, starsSize.width, starsSize.height)
    cometsCtx!.clearRect(0, 0, canvases.comets.clientWidth, canvases.comets.clientHeight)
    haloCtx!.clearRect(0, 0, canvases.halo.clientWidth, canvases.halo.clientHeight)
  }

  function resizeAll(): void {
    starsSize = sizeCanvas(canvases.stars)
    sizeCanvas(canvases.comets)
    sizeCanvas(canvases.halo)
    stars = generateStars(starsSize.width, starsSize.height)
    baseCenter = map.getCenter()
    lastLng = baseCenter.lng
    travelledLng = 0
  }

  function redrawStars(): void {
    const center = map.getCenter()
    travelledLng += ((center.lng - lastLng + 540) % 360) - 180
    lastLng = center.lng
    const offsetX = travelledLng * STAR_PARALLAX_PX_PER_DEG
    const offsetY = (center.lat - baseCenter.lat) * STAR_PARALLAX_PX_PER_DEG
    drawStars(
      starsCtx!,
      wantStars ? stars : [],
      starsSize.width,
      starsSize.height,
      offsetX,
      offsetY,
      backgroundColor,
    )
  }

  function redrawHalo(): void {
    const alpha = wantHalo ? haloAlpha(map.getZoom()) : 0
    if (alpha <= 0) {
      haloCtx!.clearRect(0, 0, canvases.halo.clientWidth, canvases.halo.clientHeight)
      return
    }
    drawHalo(haloCtx!, map, canvases.halo.clientWidth, canvases.halo.clientHeight, alpha)
  }

  function cometFrame(): void {
    if (!active || !wantComets) return
    const { clientWidth: width, clientHeight: height } = canvases.comets
    cometsCtx!.clearRect(0, 0, width, height)

    if (!activeComet && Math.random() < COMET_SPAWN_CHANCE_PER_FRAME) {
      activeComet = spawnComet(width, height)
    }
    if (activeComet) {
      activeComet.life += 1
      activeComet.x += Math.cos(activeComet.angle) * activeComet.speed
      activeComet.y += Math.sin(activeComet.angle) * activeComet.speed
      drawComet(cometsCtx!, activeComet)
      if (activeComet.life >= activeComet.maxLife) activeComet = null
    }
    cometRafId = requestAnimationFrame(cometFrame)
  }

  function updateActive(): void {
    const visible = isVisible()
    if (visible === active) {
      if (visible) {
        redrawStars()
        redrawHalo()
      }
      return
    }
    active = visible
    if (active) {
      redrawStars()
      redrawHalo()
      if (wantComets) cometRafId = requestAnimationFrame(cometFrame)
    } else {
      cancelAnimationFrame(cometRafId)
      activeComet = null
      clearAll()
    }
  }

  const onMove = () => {
    if (!active) return
    redrawStars()
    redrawHalo()
  }
  const onProjectionOrStyle = () => updateActive()
  // zoom frames also fire `move`, which redraws
  // only a visibility flip needs work here
  const onZoom = () => {
    if (isVisible() !== active) updateActive()
  }

  const resizeObserver = new ResizeObserver(() => {
    resizeAll()
    if (active) {
      redrawStars()
      redrawHalo()
    }
  })
  resizeObserver.observe(canvases.stars)

  resizeAll()
  updateActive()

  map.on('move', onMove)
  map.on('zoom', onZoom)
  map.on('projectiontransition', onProjectionOrStyle)

  return () => {
    if (disposed) return
    disposed = true
    resizeObserver.disconnect()
    map.off('move', onMove)
    map.off('zoom', onZoom)
    map.off('projectiontransition', onProjectionOrStyle)
    cancelAnimationFrame(cometRafId)
  }
}
