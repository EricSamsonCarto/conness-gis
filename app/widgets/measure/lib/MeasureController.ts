import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent, GeoJSONSource } from 'maplibre-gl'
import type MapboxDraw from '@mapbox/mapbox-gl-draw'
import { length as turfLength, area as turfArea, centroid as turfCentroid } from '@turf/turf'
import {
  formatLinear,
  formatArea,
  type LinearUnit,
  type AreaUnit,
} from './units'
import { drawStyles, SHADOW_PAINT, VERTEX_LAYER_ID } from './drawStyles'
import {
  addMapboxDraw,
  drawEvents,
  DraftFeature,
  drawLayerIds,
  featuresWithMeta,
  finishPendingSwap,
  removeMapboxDraw,
  setDrawHover,
  setDrawVertexColor,
  swapOverlayIn,
  swapOverlayOut,
} from '@/core/map/mapboxDraw'
import { removeOverlay } from '@/core/map/persistentOverlay'

export type MeasureTool =
  | 'distance'
  | 'area'
  | 'freehand-polyline'
  | 'freehand-polygon'

// id is Draw's feature id, geometry lives in Draw
export interface Measurement {
  id: string
  kind: 'distance' | 'area'
  rawValue: number
  label: string
  color: string
}

export interface LiveState {
  kind: 'distance' | 'area'
  rawValue: number
}

// no warm hues, they'd clash with the amber hover
export const MEASURE_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
  '#6366f1',
  '#84cc16',
]

const SRC_LABELS = 'measure-labels'
const LYR_LABELS = 'measure-labels-text'
const SRC_FREEHAND = 'measure-freehand-draft'
const LYR_FREEHAND_FILL = 'measure-freehand-draft-fill'
const LYR_FREEHAND_LINE = 'measure-freehand-draft-line'
const SRC_DRAFT_VERTICES = 'measure-draft-vertices'
const SRC_PERSIST = 'measure-persist'
const LYR_PERSIST_FILL = 'measure-persist-fill'
const LYR_PERSIST_SHADOW = 'measure-persist-shadow'
const LYR_PERSIST_LINE = 'measure-persist-line'
const SRC_PERSIST_LABELS = 'measure-persist-labels'
const LYR_PERSIST_LABELS = 'measure-persist-labels-text'

interface PersistSnapshot {
  geometry: GeoJSON.FeatureCollection
  labels: GeoJSON.FeatureCollection
}

function drawPersistOverlay(map: MapLibreMap, { geometry, labels }: PersistSnapshot): void {
  const geomSrc = map.getSource(SRC_PERSIST) as GeoJSONSource | undefined
  if (geomSrc) {
    geomSrc.setData(geometry)
  } else {
    map.addSource(SRC_PERSIST, { type: 'geojson', data: geometry })
    const color = ['coalesce', ['get', 'color'], '#3b82f6'] as unknown
    map.addLayer({
      id: LYR_PERSIST_FILL,
      type: 'fill',
      source: SRC_PERSIST,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': color as string, 'fill-opacity': 0.15 },
    })
    map.addLayer({
      id: LYR_PERSIST_SHADOW,
      type: 'line',
      source: SRC_PERSIST,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: SHADOW_PAINT,
    })
    map.addLayer({
      id: LYR_PERSIST_LINE,
      type: 'line',
      source: SRC_PERSIST,
      // lines + polygon outlines
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color as string, 'line-width': 2.5 },
    })
  }

  const labelSrc = map.getSource(SRC_PERSIST_LABELS) as GeoJSONSource | undefined
  if (labelSrc) {
    labelSrc.setData(labels)
  } else {
    map.addSource(SRC_PERSIST_LABELS, { type: 'geojson', data: labels })
    map.addLayer({
      id: LYR_PERSIST_LABELS,
      type: 'symbol',
      source: SRC_PERSIST_LABELS,
      layout: {
        'text-field': ['get', 'text'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['case', ['==', ['get', 'kind'], 'total'], 15, 13],
        'text-anchor': 'center',
        'text-offset': [
          'case',
          ['==', ['get', 'kind'], 'total'],
          ['literal', [0, -0.6]],
          ['literal', [0, 0]],
        ],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'kind'], 'total'], '#1e40af', '#334155'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.8,
      },
    })
  }
  if (map.getLayer(LYR_PERSIST_LABELS)) map.moveLayer(LYR_PERSIST_LABELS)
}

function uninstallPersistOverlay(map: MapLibreMap): void {
  removeOverlay(map, {
    layers: [LYR_PERSIST_FILL, LYR_PERSIST_SHADOW, LYR_PERSIST_LINE, LYR_PERSIST_LABELS],
    sources: [SRC_PERSIST, SRC_PERSIST_LABELS],
  })
}

function isFreehand(tool: MeasureTool): boolean {
  return tool === 'freehand-polyline' || tool === 'freehand-polygon'
}
function toolKind(tool: MeasureTool): 'distance' | 'area' {
  return tool === 'area' || tool === 'freehand-polygon' ? 'area' : 'distance'
}

interface FeatureMeta {
  kind: 'distance' | 'area'
  freehand: boolean
  color: string
}

interface SessionFeature {
  id: string
  geometry: GeoJSON.Geometry
  meta: FeatureMeta
}

export interface MeasurePrefs {
  linearUnit: LinearUnit
  areaUnit: AreaUnit
  showEdgeLabels: boolean
  showTotal: boolean
  persistOnClose: boolean
  // the defaults these were chosen under, so new defaults win
  madeWith?: string
}

const measureSession: {
  features: SessionFeature[]
  drawnCount: number
  prefs: MeasurePrefs | null
} = {
  features: [],
  drawnCount: 0,
  prefs: null,
}

export function getMeasurePrefs(): MeasurePrefs | null {
  return measureSession.prefs
}

export function setMeasurePrefs(prefs: MeasurePrefs): void {
  measureSession.prefs = prefs
}

export class MeasureController {
  private map: MapLibreMap
  private draw: MapboxDraw
  private tool: MeasureTool | null = null
  private freehandActive = false
  private freehandCoords: [number, number][] = []
  private draft: DraftFeature

  private drawnCount = 0
  private linearUnit: LinearUnit
  private areaUnit: AreaUnit
  private showEdgeLabels: boolean
  private showTotal: boolean
  private highlightedId: string | null = null
  private editingId: string | null = null

  private meta = new Map<string, FeatureMeta>()

  private onLive: (live: LiveState | null) => void
  private onChange: (measurements: Measurement[]) => void
  private onFinish: () => void
  private onSelect: (id: string | null) => void

  constructor(
    map: MapLibreMap,
    opts: {
      linearUnit: LinearUnit
      areaUnit: AreaUnit
      showEdgeLabels: boolean
      showTotal: boolean
      onLive: (live: LiveState | null) => void
      onChange: (measurements: Measurement[]) => void
      onFinish: () => void
      onSelect: (id: string | null) => void
    },
  ) {
    this.map = map
    this.linearUnit = opts.linearUnit
    this.areaUnit = opts.areaUnit
    this.showEdgeLabels = opts.showEdgeLabels
    this.showTotal = opts.showTotal
    this.onLive = opts.onLive
    this.onChange = opts.onChange
    this.onFinish = opts.onFinish
    this.onSelect = opts.onSelect

    this.draw = addMapboxDraw(this.map, drawStyles)
    this.draft = new DraftFeature(map, this.draw, VERTEX_LAYER_ID, SRC_DRAFT_VERTICES)

    this.ensureLabelLayer()
    this.bind()
    this.restoreSession()
    if (this.meta.size === 0) uninstallPersistOverlay(this.map)
    else swapOverlayOut(map, () => uninstallPersistOverlay(map), [SRC_LABELS])
  }

  setTool(tool: MeasureTool | null): void {
    this.cancelFreehand()
    this.draft.clear()
    this.tool = tool
    this.applyCursor()

    if (tool === null) {
      this.draw.changeMode('simple_select')
      this.map.dragPan.enable()
      this.map.doubleClickZoom.enable()
      return
    }

    if (isFreehand(tool)) {
      this.draw.changeMode('simple_select')
      this.map.dragPan.disable()
      this.map.doubleClickZoom.disable()
    } else {
      this.map.dragPan.enable()
      this.map.doubleClickZoom.disable() // dblclick finishes Draw line/polygon
      // @types changeMode overloads reject a string union, valid at runtime
      ;(this.draw.changeMode as (mode: string) => void)(
        tool === 'distance' ? 'draw_line_string' : 'draw_polygon',
      )
    }
  }

  setLinearUnit(unit: LinearUnit): void {
    this.linearUnit = unit
    this.refresh()
  }

  setAreaUnit(unit: AreaUnit): void {
    this.areaUnit = unit
    this.refresh()
  }

  setShowEdgeLabels(show: boolean): void {
    this.showEdgeLabels = show
    this.refreshLabels()
  }

  setShowTotal(show: boolean): void {
    this.showTotal = show
    this.refreshLabels()
  }

  editMeasurement(id: string): void {
    if (!this.meta.has(id)) return
    this.tool = null
    this.applyCursor()
    this.draw.changeMode('direct_select', { featureId: id })
  }

  setHighlight(id: string | null): void {
    if (this.highlightedId === id) return
    setDrawHover(this.draw, this.highlightedId, id)
    this.highlightedId = id
  }

  deleteMeasurement(id: string): void {
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
    this.cancelFreehand()
    this.refresh()
  }

  destroy(persist = false): void {
    finishPendingSwap()
    this.cancelFreehand()
    this.unbind()

    this.draft.remove()
    for (const id of [LYR_FREEHAND_LINE, LYR_FREEHAND_FILL]) {
      if (this.map.getLayer(id)) this.map.removeLayer(id)
    }
    if (this.map.getSource(SRC_FREEHAND)) this.map.removeSource(SRC_FREEHAND)

    const c = this.map.getContainer().classList
    c.remove('measure-drawing', 'measure-freehand', 'measure-vertex-hover')
    this.map.dragPan.enable()
    this.map.doubleClickZoom.enable()

    const { map, draw } = this
    const removeLive = () => {
      if (map.getLayer(LYR_LABELS)) map.removeLayer(LYR_LABELS)
      if (map.getSource(SRC_LABELS)) map.removeSource(SRC_LABELS)
      removeMapboxDraw(map, draw)
    }
    if (persist && this.meta.size > 0) {
      drawPersistOverlay(map, this.buildPersistSnapshot())
      swapOverlayIn(map, [SRC_PERSIST, SRC_PERSIST_LABELS], removeLive)
    } else {
      uninstallPersistOverlay(map)
      removeLive()
    }
  }

  private buildPersistSnapshot(): PersistSnapshot {
    const geomFeatures: GeoJSON.Feature[] = this.collectSessionFeatures().map((sf) => ({
      type: 'Feature',
      properties: { color: sf.meta.color },
      geometry: sf.geometry,
    }))

    // not source.serialize(): it returns the addSource data, not setData's
    const labelFeatures: GeoJSON.Feature[] = this.buildLabelFeatures().map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        kind: f.properties?.kind === 'segment-edit' ? 'segment' : f.properties?.kind,
      },
    }))

    return {
      geometry: { type: 'FeatureCollection', features: geomFeatures },
      labels: { type: 'FeatureCollection', features: labelFeatures },
    }
  }

  private onDrawCreate = (e: { features: GeoJSON.Feature[] }): void => {
    for (const f of e.features) {
      if (typeof f.id !== 'string') continue
      const kind = f.geometry.type === 'Polygon' ? 'area' : 'distance'
      const color = MEASURE_PALETTE[this.drawnCount % MEASURE_PALETTE.length]
      this.drawnCount += 1
      this.meta.set(f.id, { kind, freehand: false, color })
      this.draw.setFeatureProperty(f.id, 'color', color)
    }
    this.tool = null
    this.applyCursor()
    this.onLive(null)
    this.draft.clear()
    // defer past the finishing dblclick, else it zooms
    setTimeout(() => {
      if (!this.tool) this.map.doubleClickZoom.enable()
    }, 0)
    this.refresh()
    this.onFinish()
  }

  private onDrawUpdate = (): void => {
    this.refresh()
  }

  private onDrawRender = (): void => {
    if (!this.tool || isFreehand(this.tool)) {
      this.draft.clear()
      return
    }
    const kind = toolKind(this.tool)
    const draft = this.draft.update(this.meta, MEASURE_PALETTE[this.drawnCount % MEASURE_PALETTE.length])
    if (!draft) {
      this.onLive(null)
      return
    }
    const ring = this.featureRing(draft)
    const minPts = kind === 'distance' ? 2 : 3
    if (ring.length < minPts) {
      this.onLive(null)
      return
    }
    this.onLive({ kind, rawValue: this.measureRaw(ring, kind) })
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
    }
    this.editingId = editing
    if (editing) {
      const m = this.meta.get(editing)
      if (m) setDrawVertexColor(this.map, VERTEX_LAYER_ID, m.color)
    }
    this.refreshLabels()
    this.onSelect(editing)
  }

  private onMouseDown = (e: MapMouseEvent | MapTouchEvent): void => {
    if (!this.tool || !isFreehand(this.tool)) return
    e.preventDefault()
    this.freehandActive = true
    this.freehandCoords = [[e.lngLat.lng, e.lngLat.lat]]
  }

  private onMouseMove = (e: MapMouseEvent | MapTouchEvent): void => {
    if (this.tool) this.applyCursor()
    if (!this.tool) {
      const hits = this.map.queryRenderedFeatures(e.point, { layers: drawLayerIds(this.map, drawStyles) })
      const onHandle = hits.some(
        (f) => f.properties?.meta === 'vertex' || f.properties?.meta === 'midpoint',
      )
      this.map.getContainer().classList.toggle('measure-vertex-hover', onHandle)
    }
    if (!this.tool || !isFreehand(this.tool) || !this.freehandActive) return
    this.freehandCoords.push([e.lngLat.lng, e.lngLat.lat])
    const kind = toolKind(this.tool)
    this.renderFreehandDraft(kind)
    this.onLive({ kind, rawValue: this.measureRaw(this.freehandCoords, kind) })
  }

  private renderFreehandDraft(kind: 'distance' | 'area'): void {
    const coords = this.freehandCoords
    const features: GeoJSON.Feature[] = []
    if (coords.length >= 2) {
      if (kind === 'area') {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
        })
      }
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      })
    }
    const src = this.map.getSource(SRC_FREEHAND) as GeoJSONSource | undefined
    if (src) src.setData({ type: 'FeatureCollection', features })
  }

  private clearFreehandDraft(): void {
    const src = this.map.getSource(SRC_FREEHAND) as GeoJSONSource | undefined
    if (src) src.setData({ type: 'FeatureCollection', features: [] })
  }

  private onMouseUp = (): void => {
    if (!this.tool || !isFreehand(this.tool) || !this.freehandActive) return
    const kind = toolKind(this.tool)
    const coords = this.freehandCoords
    this.cancelFreehand()
    const minPts = kind === 'distance' ? 2 : 3
    if (coords.length < minPts) {
      this.onLive(null)
      this.setTool(null)
      this.onFinish()
      return
    }
    const geometry: GeoJSON.Geometry =
      kind === 'area'
        ? { type: 'Polygon', coordinates: [[...coords, coords[0]]] }
        : { type: 'LineString', coordinates: coords }
    const color = MEASURE_PALETTE[this.drawnCount % MEASURE_PALETTE.length]
    this.drawnCount += 1
    const [id] = this.draw.add({ type: 'Feature', properties: {}, geometry })
    this.meta.set(id, { kind, freehand: true, color })
    this.draw.setFeatureProperty(id, 'color', color)
    this.onLive(null)
    this.setTool(null)
    this.refresh()
    this.onFinish()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.cancelFreehand()
      this.setTool(null)
      this.onLive(null)
      this.onFinish()
    }
  }

  private cancelFreehand(): void {
    this.freehandActive = false
    this.freehandCoords = []
    this.clearFreehandDraft()
  }

  // a class with !important CSS, Draw clobbers the inline canvas cursor
  private applyCursor(): void {
    const c = this.map.getContainer().classList
    c.toggle('measure-drawing', this.tool !== null)
    c.toggle('measure-freehand', this.tool !== null && isFreehand(this.tool))
    if (this.tool === null) c.remove('measure-vertex-hover')
  }

  private measureRaw(coords: [number, number][], kind: 'distance' | 'area'): number {
    if (kind === 'distance') {
      if (coords.length < 2) return 0
      return turfLength(
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        { units: 'meters' },
      )
    }
    if (coords.length < 3) return 0
    return turfArea({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
    })
  }

  private refresh(): void {
    const fc = this.draw.getAll()
    const measurements: Measurement[] = []
    let distCount = 0
    let areaCount = 0
    for (const f of fc.features) {
      if (typeof f.id !== 'string') continue
      const meta = this.meta.get(f.id)
      if (!meta) continue
      const raw = this.rawForFeature(f, meta.kind)
      const n = meta.kind === 'distance' ? ++distCount : ++areaCount
      measurements.push({
        id: f.id,
        kind: meta.kind,
        rawValue: raw,
        color: meta.color,
        label: `${meta.kind === 'distance' ? 'Distance' : 'Area'} ${n}`,
      })
    }
    this.onChange(measurements)
    this.refreshLabels()
    this.saveSession()
  }

  private collectSessionFeatures(): SessionFeature[] {
    return featuresWithMeta(this.draw, this.meta)
  }

  private saveSession(): void {
    measureSession.features = this.collectSessionFeatures()
    measureSession.drawnCount = this.drawnCount
  }

  private restoreSession(): void {
    if (measureSession.features.length === 0) return
    this.drawnCount = measureSession.drawnCount
    for (const sf of measureSession.features) {
      this.draw.add({ type: 'Feature', id: sf.id, properties: {}, geometry: sf.geometry })
      this.meta.set(sf.id, sf.meta)
      this.draw.setFeatureProperty(sf.id, 'color', sf.meta.color)
    }
    this.refresh()
  }

  private rawForFeature(f: GeoJSON.Feature, kind: 'distance' | 'area'): number {
    const g = f.geometry
    if (kind === 'distance' && g.type === 'LineString') {
      return turfLength(f as GeoJSON.Feature<GeoJSON.LineString>, { units: 'meters' })
    }
    if (kind === 'area' && g.type === 'Polygon') {
      return turfArea(f as GeoJSON.Feature<GeoJSON.Polygon>)
    }
    return 0
  }

  private buildLabelFeatures(): GeoJSON.Feature[] {
    const features: GeoJSON.Feature[] = []
    if (this.showEdgeLabels || this.showTotal) {
      const fc = this.draw.getAll()
      for (const f of fc.features) {
        if (typeof f.id !== 'string') continue
        const meta = this.meta.get(f.id)
        if (!meta) continue
        const ring = this.featureRing(f)
        if (ring.length < 2) continue
        const raw = this.rawForFeature(f, meta.kind)

        if (this.showTotal) {
          let totalAt: [number, number]
          if (meta.kind === 'area') {
            const c = turfCentroid(f as GeoJSON.Feature<GeoJSON.Polygon>)
            totalAt = c.geometry.coordinates as [number, number]
          } else {
            totalAt = ring[ring.length - 1]
          }
          const totalText =
            meta.kind === 'distance'
              ? formatLinear(raw, this.linearUnit)
              : formatArea(raw, this.areaUnit)
          features.push({
            type: 'Feature',
            properties: { text: totalText, kind: 'total' },
            geometry: { type: 'Point', coordinates: totalAt },
          })
        }

        if (this.showEdgeLabels && !meta.freehand) {
          const editing = f.id === this.editingId
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1]
            const b = ring[i]
            const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            features.push({
              type: 'Feature',
              properties: {
                text: formatLinear(this.measureRaw([a, b], 'distance'), this.linearUnit),
                kind: editing ? 'segment-edit' : 'segment',
              },
              geometry: { type: 'Point', coordinates: mid },
            })
          }
        }
      }
    }
    return features
  }

  private refreshLabels(): void {
    const features = this.buildLabelFeatures()
    const src = this.map.getSource(SRC_LABELS) as GeoJSONSource | undefined
    if (src) src.setData({ type: 'FeatureCollection', features })
    if (this.map.getLayer(LYR_LABELS)) this.map.moveLayer(LYR_LABELS)
  }

  private featureRing(f: GeoJSON.Feature): [number, number][] {
    if (f.geometry.type === 'LineString') return f.geometry.coordinates as [number, number][]
    if (f.geometry.type === 'Polygon') return f.geometry.coordinates[0] as [number, number][]
    return []
  }

  private ensureLabelLayer(): void {
    if (!this.map.getSource(SRC_FREEHAND)) {
      this.map.addSource(SRC_FREEHAND, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!this.map.getLayer(LYR_FREEHAND_FILL)) {
      this.map.addLayer({
        id: LYR_FREEHAND_FILL,
        type: 'fill',
        source: SRC_FREEHAND,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 },
      })
    }
    if (!this.map.getLayer(LYR_FREEHAND_LINE)) {
      this.map.addLayer({
        id: LYR_FREEHAND_LINE,
        type: 'line',
        source: SRC_FREEHAND,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] },
      })
    }

    if (!this.map.getSource(SRC_LABELS)) {
      this.map.addSource(SRC_LABELS, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!this.map.getLayer(LYR_LABELS)) {
      this.map.addLayer({
        id: LYR_LABELS,
        type: 'symbol',
        source: SRC_LABELS,
        layout: {
          'text-field': ['get', 'text'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['case', ['==', ['get', 'kind'], 'total'], 15, 13],
          'text-anchor': 'center',
          'text-offset': [
            'case',
            ['==', ['get', 'kind'], 'total'],
            ['literal', [0, -0.6]],
            ['==', ['get', 'kind'], 'segment-edit'],
            ['literal', [0, -1.1]],
            ['literal', [0, 0]],
          ],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ['case', ['==', ['get', 'kind'], 'total'], '#1e40af', '#334155'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.8,
        },
      })
    }
  }

  private bind(): void {
    drawEvents(this.map).on('draw.create', this.onDrawCreate)
    drawEvents(this.map).on('draw.update', this.onDrawUpdate)
    drawEvents(this.map).on('draw.delete', this.onDrawDelete)
    drawEvents(this.map).on('draw.selectionchange', this.onDrawSelectionChange)
    drawEvents(this.map).on('draw.render', this.onDrawRender)
    this.map.on('mousedown', this.onMouseDown)
    this.map.on('mousemove', this.onMouseMove)
    this.map.on('mouseup', this.onMouseUp)
    this.map.on('touchstart', this.onMouseDown)
    this.map.on('touchmove', this.onMouseMove)
    this.map.on('touchend', this.onMouseUp)
    window.addEventListener('keydown', this.onKeyDown)
  }

  private unbind(): void {
    drawEvents(this.map).off('draw.create', this.onDrawCreate)
    drawEvents(this.map).off('draw.update', this.onDrawUpdate)
    drawEvents(this.map).off('draw.delete', this.onDrawDelete)
    drawEvents(this.map).off('draw.selectionchange', this.onDrawSelectionChange)
    drawEvents(this.map).off('draw.render', this.onDrawRender)
    this.map.off('mousedown', this.onMouseDown)
    this.map.off('mousemove', this.onMouseMove)
    this.map.off('mouseup', this.onMouseUp)
    this.map.off('touchstart', this.onMouseDown)
    this.map.off('touchmove', this.onMouseMove)
    this.map.off('touchend', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
  }
}
