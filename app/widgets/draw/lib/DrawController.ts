import type {
  Map as MapLibreMap,
  MapMouseEvent,
  GeoJSONSource,
  LngLatBoundsLike,
} from 'maplibre-gl'
import { PALETTE } from '@/core/theme/palette'
import type MapboxDraw from '@mapbox/mapbox-gl-draw'
import { bbox as turfBbox } from '@turf/turf'
import { useStore } from '@/core/store'
import {
  addMapboxDraw,
  drawEvents,
  DraftFeature,
  drawLayerIds,
  featuresWithMeta,
  finishPendingSwap,
  removeMapboxDraw,
  repaintDraw,
  setDrawHover,
  setDrawVertexColor,
  swapOverlayIn,
  swapOverlayOut,
} from '@/core/map/mapboxDraw'
import { removeOverlay } from '@/core/map/persistentOverlay'
import { drawStyles, VERTEX_LAYER_ID, shadowOpacity, shadowPaint } from './drawStyles'

export type DrawTool = 'point' | 'line' | 'polygon' | 'text'

export const DRAWINGS_LAYER_ID = '__drawings__'
const SRC_DRAWINGS = DRAWINGS_LAYER_ID
const LYR_DRAWINGS_FILL = `${DRAWINGS_LAYER_ID}-fill`
const LYR_DRAWINGS_LINE = `${DRAWINGS_LAYER_ID}-line`
const LYR_DRAWINGS_POINT = `${DRAWINGS_LAYER_ID}-point`
const LYR_DRAWINGS_LABEL = `${DRAWINGS_LAYER_ID}-label`
const LYR_DRAWINGS_SHADOW = `${DRAWINGS_LAYER_ID}-shadow`
const SRC_DRAFT_VERTICES = 'draw-draft-vertices'
const TEXT_FONT = 'Noto Sans Regular'

// cycled per new drawing, also the panel's quick swatches
export const DRAW_PALETTE = PALETTE

// text is a Point too, kind comes from the tool, not geometry
export type DrawKind = 'point' | 'line' | 'polygon' | 'text'

export interface DrawStyle {
  color: string
  width: number // line or polygon outline
  radius: number
  // the point's stroke ring or the text halo
  strokeColor: string
  strokeWidth: number
  // polygon outline, starts as `color`
  boundaryColor: string
  boundaryOpacity: number
  shadow: boolean
  shadowIntensity: number
  fillOpacity: number
  // text drawings only
  text?: string
  fontSize?: number
}

// color/boundaryColor come from the palette instead
export const DEFAULT_STYLE: Omit<DrawStyle, 'color' | 'boundaryColor'> = {
  width: 2.5,
  radius: 6,
  strokeColor: '#ffffff',
  strokeWidth: 2,
  boundaryOpacity: 1,
  shadow: false,
  shadowIntensity: 0.5,
  fillOpacity: 0.2,
}
export const DEFAULT_TEXT = 'Text'
export const DEFAULT_FONT_SIZE = 20

// backfill missing style fields so older saved sets don't crash the panel.
function normalizeStyle(s: Partial<DrawStyle> | undefined): DrawStyle {
  const color = s?.color ?? '#3b82f6'
  return {
    color,
    boundaryColor: s?.boundaryColor ?? color,
    width: s?.width ?? DEFAULT_STYLE.width,
    radius: s?.radius ?? DEFAULT_STYLE.radius,
    strokeColor: s?.strokeColor ?? DEFAULT_STYLE.strokeColor,
    strokeWidth: s?.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
    boundaryOpacity: s?.boundaryOpacity ?? DEFAULT_STYLE.boundaryOpacity,
    shadow: s?.shadow ?? DEFAULT_STYLE.shadow,
    shadowIntensity: s?.shadowIntensity ?? DEFAULT_STYLE.shadowIntensity,
    fillOpacity: s?.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
    text: s?.text,
    fontSize: s?.fontSize,
  }
}

// a list row, geometry stays in Draw
export interface Drawing {
  id: string
  kind: DrawKind
  name: string
  style: DrawStyle
}

interface FeatureMeta {
  kind: DrawKind
  name: string
  style: DrawStyle
}

export interface SessionFeature {
  id: string
  geometry: GeoJSON.Geometry
  meta: FeatureMeta
}

// createdCount keeps color cycling right when a loaded set grows
export interface DrawingSetPayload {
  features: SessionFeature[]
  createdCount: number
}
const drawSession: { features: SessionFeature[]; createdCount: number } = {
  features: [],
  createdCount: 0,
}

// flat [minLon, minLat, maxLon, maxLat], like the loaders' getBounds()
function boundsOfGeometries(geometries: GeoJSON.Geometry[]): LngLatBoundsLike | undefined {
  if (geometries.length === 0) return undefined
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: geometries.map((g) => ({ type: 'Feature', properties: {}, geometry: g })),
  }
  const bounds = turfBbox(fc) as LngLatBoundsLike
  const [minX, minY, maxX, maxY] = bounds as [number, number, number, number]
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return undefined
  return bounds
}

// layer bypasses registerLayers.ts, so no loader getBounds to hook
export function getDrawingsBounds(): LngLatBoundsLike | undefined {
  return boundsOfGeometries(drawSession.features.map((sf) => sf.geometry))
}

function toolToMode(tool: DrawTool): string {
  if (tool === 'line') return 'draw_line_string'
  if (tool === 'polygon') return 'draw_polygon'
  return 'draw_point'
}
function createdKind(tool: DrawTool | null, type: GeoJSON.Geometry['type']): DrawKind {
  if (type === 'LineString') return 'line'
  if (type === 'Polygon') return 'polygon'
  return tool === 'text' ? 'text' : 'point'
}

export class DrawController {
  private map: MapLibreMap
  private draw: MapboxDraw
  private tool: DrawTool | null = null
  private draft: DraftFeature

  private createdCount = 0
  private highlightedId: string | null = null
  private editingId: string | null = null

  private meta = new Map<string, FeatureMeta>()

  private onChange: (drawings: Drawing[]) => void
  private onFinish: () => void
  private onSelect: (id: string | null) => void
  private createStyle: Omit<DrawStyle, 'color' | 'boundaryColor'>
  private createTextSize: number

  constructor(
    map: MapLibreMap,
    opts: {
      onChange: (drawings: Drawing[]) => void
      onFinish: () => void
      onSelect: (id: string | null) => void
      defaultStyle?: Partial<Omit<DrawStyle, 'color' | 'boundaryColor'>> & {
        fontSize?: number
      }
    },
  ) {
    this.map = map
    this.onChange = opts.onChange
    this.onFinish = opts.onFinish
    this.onSelect = opts.onSelect
    const ds = opts.defaultStyle ?? {}
    this.createStyle = {
      width: ds.width ?? DEFAULT_STYLE.width,
      radius: ds.radius ?? DEFAULT_STYLE.radius,
      strokeColor: ds.strokeColor ?? DEFAULT_STYLE.strokeColor,
      strokeWidth: ds.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
      boundaryOpacity: ds.boundaryOpacity ?? DEFAULT_STYLE.boundaryOpacity,
      shadow: ds.shadow ?? DEFAULT_STYLE.shadow,
      shadowIntensity: ds.shadowIntensity ?? DEFAULT_STYLE.shadowIntensity,
      fillOpacity: ds.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
    }
    this.createTextSize = ds.fontSize ?? DEFAULT_FONT_SIZE

    this.draw = addMapboxDraw(this.map, drawStyles)
    this.draft = new DraftFeature(map, this.draw, VERTEX_LAYER_ID, SRC_DRAFT_VERTICES)

    this.bind()
    this.restoreSession()
    if (this.meta.size === 0) uninstallDrawingsLayer(this.map)
    else swapOverlayOut(map, () => uninstallDrawingsLayer(map))
  }

  setTool(tool: DrawTool | null): void {
    this.tool = tool
    this.draft.clear()
    this.applyCursor()
    if (tool === null) {
      this.draw.changeMode('simple_select')
      return
    }
    ;(this.draw.changeMode as (mode: string) => void)(toolToMode(tool))
  }

  // direct_select throws on points, so branch on geometry, not kind
  editDrawing(id: string): void {
    const m = this.meta.get(id)
    if (!m) return
    this.tool = null
    this.applyCursor()
    const feature = this.draw.get(id)
    if (feature?.geometry.type === 'Point') {
      this.draw.changeMode('simple_select', { featureIds: [id] })
    } else {
      this.draw.changeMode('direct_select', { featureId: id })
    }
    // programmatic changeMode doesn't reliably fire selectionchange
    this.editingId = id
    setDrawVertexColor(this.map, VERTEX_LAYER_ID, m.style.color)
    this.onSelect(id)
  }

  // programmatic changeMode doesn't fire selectionchange
  deselect(): void {
    this.draw.changeMode('simple_select', { featureIds: [] })
    this.editingId = null
    this.onSelect(null)
  }

  setHighlight(id: string | null): void {
    if (this.highlightedId === id) return
    setDrawHover(this.draw, this.highlightedId, id)
    this.highlightedId = id
  }

  renameDrawing(id: string, name: string): void {
    const m = this.meta.get(id)
    if (!m) return
    m.name = name
    this.refresh()
  }

  setDrawingStyle(id: string, patch: Partial<DrawStyle>): void {
    const m = this.meta.get(id)
    if (!m) return
    m.style = { ...m.style, ...patch }
    if (m.kind === 'text' && patch.text !== undefined) {
      m.name = patch.text.trim() || DEFAULT_TEXT
    }
    this.applyStyleProps(id, m.style)
    if (patch.color !== undefined && this.editingId === id) {
      setDrawVertexColor(this.map, VERTEX_LAYER_ID, m.style.color)
    }
    repaintDraw(this.draw)
    this.refresh()
  }

  deleteDrawing(id: string): void {
    if (this.highlightedId === id) this.highlightedId = null
    if (this.editingId === id) this.editingId = null
    this.meta.delete(id)
    this.draw.delete(id)
    this.refresh()
  }

  clearAll(): void {
    this.highlightedId = null
    this.editingId = null
    this.meta.clear()
    this.draw.deleteAll()
    this.refresh()
  }

  exportDrawings(): DrawingSetPayload {
    // a copy, live meta mutates and a saved set changes only on save
    return structuredClone({ features: this.collectSessionFeatures(), createdCount: this.createdCount })
  }

  loadDrawings(payload: DrawingSetPayload): void {
    this.highlightedId = null
    this.editingId = null
    this.meta.clear()
    this.draw.deleteAll()
    this.createdCount = payload.createdCount
    for (const sf of payload.features) {
      this.draw.add({ type: 'Feature', id: sf.id, properties: {}, geometry: sf.geometry })
      const meta = { ...sf.meta, style: normalizeStyle(sf.meta.style) }
      this.meta.set(sf.id, meta)
      this.applyStyleProps(sf.id, meta.style)
    }
    repaintDraw(this.draw)
    this.refresh()
    this.fitToDrawings(payload.features.map((sf) => sf.geometry))
  }

  private fitToDrawings(geometries: GeoJSON.Geometry[]): void {
    const bounds = boundsOfGeometries(geometries)
    if (!bounds) return
    this.map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 })
  }

  destroy(persist = true, visible = true, opacity = 1): void {
    finishPendingSwap()
    this.unbind()
    this.draft.remove()
    this.map.getContainer().classList.remove('draw-drawing', 'draw-vertex-hover', 'draw-feature-hover')
    const { map, draw } = this
    if (persist && this.meta.size > 0) {
      drawDrawingsLayer(map, { fc: this.buildDrawingsFC(), visible, opacity })
      swapOverlayIn(map, [SRC_DRAWINGS], () => removeMapboxDraw(map, draw))
    } else {
      uninstallDrawingsLayer(map)
      removeMapboxDraw(map, draw)
    }
  }

  private onDrawCreate = (e: { features: GeoJSON.Feature[] }): void => {
    for (const f of e.features) {
      if (typeof f.id !== 'string') continue
      const kind = createdKind(this.tool, f.geometry.type)
      const color = DRAW_PALETTE[this.createdCount % DRAW_PALETTE.length]
      const n = this.createdCount + 1
      this.createdCount += 1
      const style: DrawStyle = { color, boundaryColor: color, ...this.createStyle }
      if (kind === 'text') {
        style.text = DEFAULT_TEXT
        style.fontSize = this.createTextSize
      }
      const name = kind === 'text' ? DEFAULT_TEXT : `${kindLabel(kind)} ${n}`
      this.meta.set(f.id, { kind, name, style })
      this.applyStyleProps(f.id, style)
    }
    this.tool = null
    this.draft.clear()
    this.applyCursor()
    this.refresh()
    this.onFinish()
  }

  private onDrawUpdate = (): void => {
    this.refresh()
  }

  private onDrawDelete = (): void => {
    this.refresh()
  }

  private onDrawSelectionChange = (e: { features: GeoJSON.Feature[] }): void => {
    const sel = e.features[0]
    const id = sel && typeof sel.id === 'string' ? sel.id : null
    const editing = id && this.meta.has(id) ? id : null
    if (editing) {
      this.tool = null
      this.applyCursor()
      const m = this.meta.get(editing)
      if (m) setDrawVertexColor(this.map, VERTEX_LAYER_ID, m.style.color)
    }
    this.editingId = editing
    this.onSelect(editing)
  }

  private onDrawRender = (): void => {
    if (!this.tool) return
    this.draft.update(this.meta, DRAW_PALETTE[this.createdCount % DRAW_PALETTE.length])
  }

  private applyStyleProps(id: string, style: DrawStyle): void {
    this.draw.setFeatureProperty(id, 'color', style.color)
    this.draw.setFeatureProperty(id, 'width', style.width)
    this.draw.setFeatureProperty(id, 'radius', style.radius)
    this.draw.setFeatureProperty(id, 'strokeColor', style.strokeColor)
    this.draw.setFeatureProperty(id, 'strokeWidth', style.strokeWidth)
    this.draw.setFeatureProperty(id, 'boundaryColor', style.boundaryColor)
    this.draw.setFeatureProperty(id, 'boundaryOpacity', style.boundaryOpacity)
    this.draw.setFeatureProperty(id, 'shadow', style.shadow)
    this.draw.setFeatureProperty(id, 'shadowIntensity', style.shadowIntensity)
    this.draw.setFeatureProperty(id, 'fillOpacity', style.fillOpacity)
    // isText makes the style filter draw a label, not a dot
    const meta = this.meta.get(id)
    if (meta?.kind === 'text') {
      this.draw.setFeatureProperty(id, 'text', style.text ?? DEFAULT_TEXT)
      this.draw.setFeatureProperty(id, 'fontSize', style.fontSize ?? DEFAULT_FONT_SIZE)
      this.draw.setFeatureProperty(id, 'isText', true)
    }
  }

  private applyCursor(): void {
    const c = this.map.getContainer().classList
    c.toggle('draw-drawing', this.tool !== null)
    if (this.tool !== null) c.remove('draw-vertex-hover', 'draw-feature-hover')
  }

  private refresh(): void {
    const fc = this.draw.getAll()
    const drawings: Drawing[] = []
    for (const f of fc.features) {
      if (typeof f.id !== 'string') continue
      const meta = this.meta.get(f.id)
      if (!meta) continue
      drawings.push({ id: f.id, kind: meta.kind, name: meta.name, style: meta.style })
    }
    this.onChange(drawings)
    this.saveSession()
  }

  private collectSessionFeatures(): SessionFeature[] {
    return featuresWithMeta(this.draw, this.meta)
  }

  private saveSession(): void {
    drawSession.features = this.collectSessionFeatures()
    drawSession.createdCount = this.createdCount
  }

  private restoreSession(): void {
    if (drawSession.features.length === 0) return
    this.createdCount = drawSession.createdCount
    for (const sf of drawSession.features) {
      this.draw.add({ type: 'Feature', id: sf.id, properties: {}, geometry: sf.geometry })
      this.meta.set(sf.id, sf.meta)
      this.applyStyleProps(sf.id, sf.meta.style)
    }
    this.refresh()
  }

  private buildDrawingsFC(): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = this.collectSessionFeatures().map((sf) => {
      const s = sf.meta.style
      const isText = sf.meta.kind === 'text'
      return {
        type: 'Feature',
        properties: {
          color: s.color,
          width: s.width,
          radius: s.radius,
          strokeColor: s.strokeColor,
          strokeWidth: s.strokeWidth,
          boundaryColor: s.boundaryColor,
          boundaryOpacity: s.boundaryOpacity,
          shadow: s.shadow,
          shadowIntensity: s.shadowIntensity,
          fillOpacity: s.fillOpacity,
          isText,
          text: isText ? s.text ?? DEFAULT_TEXT : '',
          fontSize: s.fontSize ?? DEFAULT_FONT_SIZE,
        },
        geometry: sf.geometry,
      }
    })
    return { type: 'FeatureCollection', features }
  }

  // Draw cancels the geometry on Escape, but not our tool state
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.tool) {
      this.setTool(null)
      this.onFinish()
    }
  }

  // crosshair over a vertex/midpoint beats pointer over a feature
  private onMouseMove = (e: MapMouseEvent): void => {
    if (this.tool) {
      this.map.getContainer().classList.remove('draw-vertex-hover', 'draw-feature-hover')
      return
    }
    const hits = this.map.queryRenderedFeatures(e.point, { layers: drawLayerIds(this.map, drawStyles) })
    const onHandle = hits.some(
      (f) => f.properties?.meta === 'vertex' || f.properties?.meta === 'midpoint',
    )
    const onFeature = !onHandle && hits.some((f) => f.properties?.meta === 'feature')
    const c = this.map.getContainer().classList
    c.toggle('draw-vertex-hover', onHandle)
    c.toggle('draw-feature-hover', onFeature)
  }

  private bind(): void {
    drawEvents(this.map).on('draw.create', this.onDrawCreate)
    drawEvents(this.map).on('draw.update', this.onDrawUpdate)
    drawEvents(this.map).on('draw.delete', this.onDrawDelete)
    drawEvents(this.map).on('draw.selectionchange', this.onDrawSelectionChange)
    drawEvents(this.map).on('draw.render', this.onDrawRender)
    this.map.on('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKeyDown)
  }

  private unbind(): void {
    drawEvents(this.map).off('draw.create', this.onDrawCreate)
    drawEvents(this.map).off('draw.update', this.onDrawUpdate)
    drawEvents(this.map).off('draw.delete', this.onDrawDelete)
    drawEvents(this.map).off('draw.selectionchange', this.onDrawSelectionChange)
    drawEvents(this.map).off('draw.render', this.onDrawRender)
    this.map.off('mousemove', this.onMouseMove)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}

function kindLabel(kind: DrawKind): string {
  return kind === 'point'
    ? 'Point'
    : kind === 'line'
      ? 'Line'
      : kind === 'polygon'
        ? 'Polygon'
        : 'Text'
}

interface DrawingsSnapshot {
  fc: GeoJSON.FeatureCollection
  // the layer list's state at close, the store's value wins when set
  visible: boolean
  opacity: number
}

function drawDrawingsLayer(map: MapLibreMap, snapshot: DrawingsSnapshot): void {
  const meta = useStore.getState().layerMetadata[DRAWINGS_LAYER_ID]
  const { fc } = snapshot
  const visible = meta?.visible ?? snapshot.visible
  const opacity = meta?.opacity ?? snapshot.opacity
  const vis: 'visible' | 'none' = visible ? 'visible' : 'none'
  const src = map.getSource(SRC_DRAWINGS) as GeoJSONSource | undefined
  if (src) {
    src.setData(fc)
    return
  }
  map.addSource(SRC_DRAWINGS, { type: 'geojson', data: fc })
  const color = ['coalesce', ['get', 'color'], '#3b82f6'] as unknown
  const width = ['coalesce', ['get', 'width'], 2.5] as unknown
  const radius = ['coalesce', ['get', 'radius'], 6] as unknown
  const boundaryColor = ['coalesce', ['get', 'boundaryColor'], color] as unknown
  const strokeColor = ['coalesce', ['get', 'strokeColor'], '#ffffff'] as unknown
  const strokeWidth = ['coalesce', ['get', 'strokeWidth'], 1.5] as unknown
  const fillOpacity = ['*', ['coalesce', ['get', 'fillOpacity'], 0.2], opacity] as unknown
  const boundaryOpacity = ['*', ['coalesce', ['get', 'boundaryOpacity'], 1], opacity] as unknown
  // added first so it draws beneath its drawing
  map.addLayer({
    id: LYR_DRAWINGS_SHADOW,
    type: 'line',
    source: SRC_DRAWINGS,
    filter: ['all', ['!=', ['geometry-type'], 'Point'], ['==', ['get', 'shadow'], true]],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
    paint: {
      ...shadowPaint(['coalesce', ['get', 'width'], 2.5], ['get', 'shadowIntensity']),
      'line-opacity': [
        '*',
        shadowOpacity(['get', 'shadowIntensity']),
        opacity,
      ] as unknown as number,
    },
  })
  map.addLayer({
    id: LYR_DRAWINGS_FILL,
    type: 'fill',
    source: SRC_DRAWINGS,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { visibility: vis },
    paint: { 'fill-color': color as string, 'fill-opacity': fillOpacity as number },
  })
  map.addLayer({
    id: LYR_DRAWINGS_LINE,
    type: 'line',
    source: SRC_DRAWINGS,
    filter: ['!=', ['geometry-type'], 'Point'],
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: vis },
    paint: {
      'line-color': [
        'case',
        ['==', ['geometry-type'], 'Polygon'],
        boundaryColor,
        color,
      ] as unknown as string,
      'line-width': width as number,
      'line-opacity': [
        'case',
        ['==', ['geometry-type'], 'Polygon'],
        boundaryOpacity,
        opacity,
      ] as unknown as number,
    },
  })
  map.addLayer({
    id: LYR_DRAWINGS_POINT,
    type: 'circle',
    source: SRC_DRAWINGS,
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'isText'], true]],
    layout: { visibility: vis },
    paint: {
      'circle-radius': radius as number,
      'circle-color': color as string,
      'circle-stroke-color': strokeColor as string,
      'circle-stroke-width': strokeWidth as number,
      'circle-opacity': opacity,
      'circle-stroke-opacity': opacity,
    },
  })
  map.addLayer({
    id: LYR_DRAWINGS_LABEL,
    type: 'symbol',
    source: SRC_DRAWINGS,
    filter: ['==', ['get', 'isText'], true],
    layout: {
      'text-field': ['coalesce', ['get', 'text'], ''],
      'text-font': [TEXT_FONT],
      'text-size': ['coalesce', ['get', 'fontSize'], 16] as unknown as number,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      visibility: vis,
    },
    paint: {
      'text-color': color as string,
      'text-halo-color': strokeColor as string,
      'text-halo-width': strokeWidth as number,
      'text-opacity': opacity,
    },
  })
  if (map.getLayer(LYR_DRAWINGS_LABEL)) map.moveLayer(LYR_DRAWINGS_LABEL)
}

function uninstallDrawingsLayer(map: MapLibreMap): void {
  removeOverlay(map, {
    layers: [LYR_DRAWINGS_SHADOW, LYR_DRAWINGS_FILL, LYR_DRAWINGS_LINE, LYR_DRAWINGS_POINT, LYR_DRAWINGS_LABEL],
    sources: [SRC_DRAWINGS],
  })
}
