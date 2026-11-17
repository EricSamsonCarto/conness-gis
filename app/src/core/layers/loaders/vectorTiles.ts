import type {
  Map as MapLibreMap,
  LngLatBoundsLike,
  RasterSourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl'
import type {
  LayerGeometryType,
  PMTilesRasterLayer,
  PMTilesSourceLayer,
  PMTilesVectorLayer,
  Symbology,
  TilesRasterLayer,
  TilesVectorLayer,
} from '../../types'
import { useStore } from '../../store'
import { configError } from '../../configError'
import { PALETTE } from '../../theme/palette'
import { paintForLine, resolveSymbology } from '../symbology'
import { setPaint, withLayerOpacity } from '../opacity'
import { recordLayer, resolvedState } from '../recordLayer'
import { addSublayers, POLYGON_OUTLINE_FILTER, recordBaseFilter } from './sublayers'
import type { RegisteredLayer } from './geojson'

export type VectorTileLayer = PMTilesVectorLayer | TilesVectorLayer
export type RasterTileLayer = PMTilesRasterLayer | TilesRasterLayer

export interface TileMetadata {
  vector_layers?: { id: string; minzoom?: number }[]
  // written by tippecanoe, one geometry per source layer
  tilestats?: { layers?: { layer: string; geometry?: string }[] }
}

export interface VectorTileProvider {
  source: VectorSourceSpecification
  // null for a bare XYZ template
  metadata: Promise<TileMetadata | null>
  getBounds: () => Promise<LngLatBoundsLike | undefined>
}

const TILESTATS_GEOMETRY: Record<string, LayerGeometryType> = {
  Point: 'point',
  LineString: 'line',
  Polygon: 'polygon',
}

// translucent like pmtiles.io, so overlapping source layers show
const AUTO_OPACITY = 0.4

// parent tiers, bottom to top. hidden background markers hold each slot
// so children added later land at the archive's place in the order
const TIERS = ['fill', 'line', 'point', 'label'] as const

// what addVectorTileLayer drew, so the editor's live restyle can redraw it
interface DrawnChild {
  sourceLayer: string
  index: number
  id: string
  archiveMin?: number
  plain: boolean
}
interface Drawn {
  sourceId: string
  slots?: Record<(typeof TIERS)[number], string>
  metadata: Promise<TileMetadata | null>
  getBounds: () => Promise<LngLatBoundsLike | undefined>
  // the source layers the config listed, null when it listed none
  listed: string[] | null
  children: DrawnChild[]
}
const drawn = new Map<string, Drawn>()

// resolved as child ← archive layer ← automatic default
interface SourceLayerSpec {
  id: string
  name: string
  sourceLayer: string
  symbology: Symbology
  auto: boolean
  geometryType?: LayerGeometryType
  legend?: PMTilesSourceLayer['legend']
  label?: PMTilesSourceLayer['label']
  popup?: PMTilesSourceLayer['popup']
  visible: boolean
  opacity: number
  minZoom?: number
  // set by the user, archive minzoom never overrides it
  minZoomExplicit: boolean
  maxZoom?: number
}

function validate(layer: VectorTileLayer): void {
  if ('sourceLayer' in layer) {
    throw configError({
      where: `settings.layers["${layer.id}"]`,
      why: '`sourceLayer` was replaced by `sourceLayers`',
      fix: `use sourceLayers: [{ sourceLayer: '${String((layer as { sourceLayer: unknown }).sourceLayer)}' }]`,
    })
  }
  const seen = new Set<string>()
  for (const entry of layer.sourceLayers ?? []) {
    if (seen.has(entry.sourceLayer)) {
      throw configError({
        where: `settings.layers["${layer.id}"].sourceLayers`,
        why: `"${entry.sourceLayer}" is listed twice`,
        fix: 'list each source layer once',
      })
    }
    seen.add(entry.sourceLayer)
    // bad refs throw at boot, as in registerLayers
    if (entry.symbology?.kind === 'ref') resolveSymbology(entry.symbology)
  }
}

function resolveSpec(
  layer: VectorTileLayer,
  entry: PMTilesSourceLayer,
  index: number,
  id: string,
  archiveMinZoom?: number,
  // a lone source layer is the layer itself, so keeps its name
  plain = false,
): SourceLayerSpec {
  // each source layer has its own style, the layer has none of its own
  const symbology = entry.symbology
  const auto = symbology === undefined
  // archive minzoom only raises the floor. maxzoom is the last tile zoom
  // and MapLibre overzooms past it, so it isn't applied
  const floor =
    archiveMinZoom !== undefined ? Math.max(archiveMinZoom, layer.minZoom ?? 0) : layer.minZoom
  return {
    id,
    name: plain ? layer.name : (entry.name ?? entry.sourceLayer),
    sourceLayer: entry.sourceLayer,
    symbology: symbology ?? autoSymbology(index),
    auto,
    geometryType: entry.geometryType ?? layer.geometryType,
    // children don't inherit the archive's legend, it'd repeat under each
    legend: entry.legend ?? (plain ? layer.legend : undefined),
    label: entry.label ?? layer.label,
    popup: entry.popup ?? layer.popup,
    visible: entry.visible ?? layer.visible ?? true,
    // the layer list's multiplier, styling opacity is in symbology
    opacity: 1,
    minZoom: entry.minZoom ?? floor,
    minZoomExplicit: entry.minZoom !== undefined,
    maxZoom: entry.maxZoom ?? layer.maxZoom,
  }
}

function autoSymbology(index: number): Symbology {
  return {
    kind: 'simple',
    color: PALETTE[index % PALETTE.length],
    radius: 4,
    width: 1,
    strokeColor: '#ffffff',
    strokeWidth: 1,
    opacity: AUTO_OPACITY,
    strokeOpacity: 1,
  }
}

// a wrong name renders nothing silently, so warn with the valid ones
function unknownSourceLayers(layerId: string, names: string[], metadata: TileMetadata): string[] {
  const available = metadata.vector_layers?.map((v) => v.id) ?? []
  if (available.length === 0) return []
  const unknown = names.filter((n) => !available.includes(n))
  if (unknown.length > 0) {
    console.warn(
      `[conness-gis] Layer "${layerId}": ${unknown
        .map((n) => `"${n}"`)
        .join(', ')} isn't in its tiles, so it won't draw. ` +
        `Available source layers: ${available.join(', ')}.`,
    )
  }
  return unknown
}

function detectedGeometry(metadata: TileMetadata, sourceLayer: string): LayerGeometryType | undefined {
  const stat = metadata.tilestats?.layers?.find((l) => l.layer === sourceLayer)
  return stat?.geometry ? TILESTATS_GEOMETRY[stat.geometry] : undefined
}

export function addVectorTileLayer(
  map: MapLibreMap,
  layer: VectorTileLayer,
  provider: VectorTileProvider,
): RegisteredLayer {
  validate(layer)
  const sourceId = `src-${layer.id}`
  map.addSource(sourceId, provider.source)

  const getBounds = provider.getBounds

  // null or failed metadata is fine, nothing is detected or validated
  const metadata = provider.metadata
  const ignore = () => {}

  const listed = layer.sourceLayers ?? []

  if (listed.length === 1) {
    const spec = resolveSpec(layer, listed[0], 0, layer.id, undefined, true)
    const sublayerIds = buildSourceLayer(map, sourceId, spec)
    drawn.set(layer.id, {
      sourceId,
      metadata,
      getBounds,
      listed: [spec.sourceLayer],
      children: [{ sourceLayer: spec.sourceLayer, index: 0, id: layer.id, plain: true }],
    })
    publishPopups(layer, [spec], false)
    void metadata.then((m) => {
      if (!m) return
      unknownSourceLayers(layer.id, [spec.sourceLayer], m)
      afterMetadata(map, spec, m)
    }, ignore)
    return {
      id: layer.id,
      sourceId,
      sublayerIds,
      getBounds,
      record: recordFields(spec),
    }
  }

  // the parent row's children come now if listed, else with the metadata
  const slots = addSlotMarkers(map, layer.id)
  let stale = false
  const record: Drawn = { sourceId, slots, metadata, getBounds, listed: listed.length > 0 ? listed.map((e) => e.sourceLayer) : null, children: [] }
  drawn.set(layer.id, record)

  const addChildren = (specs: SourceLayerSpec[]) => {
    // insert last-first so the first source layer ends on top
    for (const spec of [...specs].reverse()) {
      const sublayerIds = buildSourceLayer(map, sourceId, spec, slots)
      recordLayer(map, { ...recordFields(spec), parentId: layer.id }, {
        id: spec.id,
        sourceId,
        sublayerIds,
        getBounds,
      })
    }
  }

  if (listed.length >= 2) {
    const specs = listed.map((entry, i) => resolveSpec(layer, entry, i, `${layer.id}/${entry.sourceLayer}`))
    record.children = specs.map((s, i) => ({ sourceLayer: s.sourceLayer, index: i, id: s.id, plain: false }))
    addChildren(specs)
    publishPopups(layer, specs, true)
    const childIds = specs.map((s) => s.id)
    void metadata.then((m) => {
      if (stale || !m) return
      const unknown = unknownSourceLayers(layer.id, listed.map((e) => e.sourceLayer), m)
      for (const spec of specs) {
        if (unknown.includes(spec.sourceLayer)) removeChild(map, spec.id)
        else afterMetadata(map, spec, m)
      }
      record.children = record.children.filter((c) => !unknown.includes(c.sourceLayer))
      if (unknown.length > 0) {
        const kept = childIds.filter((id) => useStore.getState().layerMetadata[id])
        useStore.getState().updateLayerMetadata(layer.id, { childIds: kept })
      }
    }, ignore)
    return {
      id: layer.id,
      sourceId,
      sublayerIds: Object.values(slots),
      getBounds,
      teardown: () => {
        stale = true
      },
      record: parentRecord(childIds),
    }
  }

  // none listed means no popup targets until the metadata names them
  useStore.getState().setPopupLayerOverride(layer.id, [])
  const ready = metadata.then(
    (m) => {
      if (stale || !map.getLayer(slots.fill)) return
      const archiveLayers = m?.vector_layers ?? []
      if (!m || archiveLayers.length === 0) {
        console.warn(
          `[conness-gis] Layer "${layer.id}": its tiles list no source layers, so there's nothing to draw. List them in sourceLayers.`,
        )
        return
      }
      if (archiveLayers.length === 1) {
        // a single source layer is a plain layer, so replace the parent record
        const v = archiveLayers[0]
        const spec = resolveSpec(layer, { sourceLayer: v.id }, 0, layer.id, v.minzoom, true)
        record.children = [{ sourceLayer: v.id, index: 0, id: layer.id, archiveMin: v.minzoom, plain: true }]
        const sublayerIds = buildSourceLayer(map, sourceId, spec, slots)
        publishPopups(layer, [spec], false)
        recordLayer(map, { ...recordFields(spec), isParent: false, childIds: undefined }, {
          id: layer.id,
          sourceId,
          sublayerIds,
          getBounds,
        })
        afterMetadata(map, spec, m)
        return
      }
      const specs = archiveLayers.map((v, i) =>
        resolveSpec(layer, { sourceLayer: v.id }, i, `${layer.id}/${v.id}`, v.minzoom),
      )
      record.children = archiveLayers.map((v, i) => ({ sourceLayer: v.id, index: i, id: `${layer.id}/${v.id}`, archiveMin: v.minzoom, plain: false }))
      addChildren(specs)
      publishPopups(layer, specs, true)
      for (const spec of specs) afterMetadata(map, spec, m)
      const childIds = specs.map((s) => s.id)
      useStore.getState().updateLayerMetadata(layer.id, {
        childIds,
        visible: childIds.some((id) => useStore.getState().layerMetadata[id]?.visible),
      })
    },
    () => {
      console.warn(
        `[conness-gis] Layer "${layer.id}": couldn't read its tiles' metadata, so its source layers are unknown.`,
      )
    },
  )

  return {
    id: layer.id,
    sourceId,
    sublayerIds: Object.values(slots),
    getBounds,
    teardown: () => {
      stale = true
    },
    ready,
    record: parentRecord([]),
  }
}

// the editor's live restyle, same source and slots, so no data reloads
// different source layers throw, and the page reloads instead
export function restyleVectorTileLayer(
  map: MapLibreMap,
  layer: VectorTileLayer,
): { plain?: { record: ReturnType<typeof recordFields>; sublayerIds: string[] } } {
  const d = drawn.get(layer.id)
  const listed = layer.sourceLayers ?? []
  const names = listed.length > 0 ? listed.map((e) => e.sourceLayer) : null
  if (!d || JSON.stringify(names) !== JSON.stringify(d.listed)) {
    throw new Error(`[conness-gis] "${layer.id}" lists other source layers than it drew`)
  }
  const specs = d.children.map((c) =>
    resolveSpec(layer, listed.find((e) => e.sourceLayer === c.sourceLayer) ?? { sourceLayer: c.sourceLayer }, c.index, c.id, c.archiveMin, c.plain),
  )
  const sublayers = (id: string) => ['-fill', '-line', '-point', '-label'].map((s) => `${id}${s}`).filter((s) => map.getLayer(s))
  let before = d.slots
  if (!before) {
    const order = (map.getStyle().layers ?? []).map((l) => l.id)
    const own = specs.flatMap((s) => sublayers(s.id))
    const last = Math.max(-1, ...own.map((id) => order.indexOf(id)))
    const above = order.slice(last + 1).find((id) => !own.includes(id))
    if (above) before = { fill: above, line: above, point: above, label: above }
  }
  for (const spec of specs) for (const id of sublayers(spec.id)) map.removeLayer(id)

  const out: ReturnType<typeof restyleVectorTileLayer> = {}
  // last first, so the first source layer ends on top, as at load
  for (const spec of [...specs].reverse()) {
    const sublayerIds = buildSourceLayer(map, d.sourceId, spec, before)
    if (spec.id === layer.id) out.plain = { record: recordFields(spec), sublayerIds }
    else recordLayer(map, { ...recordFields(spec), parentId: layer.id }, { id: spec.id, sourceId: d.sourceId, sublayerIds, getBounds: d.getBounds })
  }
  publishPopups(layer, specs, specs.some((s) => s.id !== layer.id))
  void d.metadata.then(
    (m) => {
      if (m) for (const spec of specs) afterMetadata(map, spec, m)
    },
    () => {},
  )
  return out
}

// MapView re-wires popups when these change
function publishPopups(layer: VectorTileLayer, specs: SourceLayerSpec[], asChildren: boolean): void {
  useStore.getState().setPopupLayerOverride(
    layer.id,
    specs.map((spec) => ({
      id: spec.id,
      name: asChildren ? `${layer.name} / ${spec.name}` : spec.name,
      group: layer.group,
      popup: spec.popup,
    })),
  )
}

function parentRecord(childIds: string[]) {
  return {
    isParent: true,
    childIds,
    // the parent row draws nothing, its children carry style and labels
    symbology: undefined,
    geometryType: undefined,
    legend: undefined,
    label: undefined,
  }
}

function recordFields(spec: SourceLayerSpec) {
  return {
    id: spec.id,
    name: spec.name,
    visible: spec.visible,
    opacity: spec.opacity,
    symbology: spec.symbology,
    geometryType: spec.geometryType,
    legend: spec.legend,
    minZoom: spec.minZoom,
    maxZoom: spec.maxZoom,
    label: spec.label,
  }
}

function addSlotMarkers(map: MapLibreMap, layerId: string): Record<(typeof TIERS)[number], string> {
  const slots = {} as Record<(typeof TIERS)[number], string>
  for (const tier of TIERS) {
    const id = `${layerId}-slot-${tier}`
    map.addLayer({ id, type: 'background', layout: { visibility: 'none' } })
    slots[tier] = id
  }
  return slots
}

function buildSourceLayer(
  map: MapLibreMap,
  sourceId: string,
  spec: SourceLayerSpec,
  slots?: Record<(typeof TIERS)[number], string>,
): string[] {
  const { visible, opacity } = resolvedState(spec)
  return addSublayers(map, {
    layerId: spec.id,
    sourceId,
    sourceLayer: spec.sourceLayer,
    symbology: spec.symbology,
    geometryType: spec.geometryType,
    visibility: visible ? 'visible' : 'none',
    opacity,
    minZoom: spec.minZoom,
    maxZoom: spec.maxZoom,
    label: spec.label,
    beforeIds: slots,
  })
}

// archive minzoom (unknown at build time) and tilestats geometry
function afterMetadata(map: MapLibreMap, spec: SourceLayerSpec, metadata: TileMetadata): void {
  const archiveMin = metadata.vector_layers?.find((v) => v.id === spec.sourceLayer)?.minzoom
  if (
    archiveMin !== undefined &&
    !spec.minZoomExplicit &&
    (spec.minZoom === undefined || archiveMin > spec.minZoom)
  ) {
    for (const suffix of ['-fill', '-line', '-point']) {
      const id = `${spec.id}${suffix}`
      if (map.getLayer(id)) map.setLayerZoomRange(id, archiveMin, spec.maxZoom ?? 24)
    }
    // a label's own minZoom can sit above the layer's, never lower it
    const labelId = `${spec.id}-label`
    if (map.getLayer(labelId)) {
      map.setLayerZoomRange(labelId, Math.max(archiveMin, spec.label?.minZoom ?? 0), spec.maxZoom ?? 24)
    }
    useStore.getState().updateLayerMetadata(spec.id, { minZoom: archiveMin })
  }
  if (spec.geometryType) return
  const detected = detectedGeometry(metadata, spec.sourceLayer)
  if (detected) applyDetectedGeometry(map, spec, detected)
}

// act as if geometryType were set, for the legend shape and polygon borders
function applyDetectedGeometry(
  map: MapLibreMap,
  spec: SourceLayerSpec,
  geometryType: LayerGeometryType,
): void {
  const { layerMetadata, updateLayerMetadata } = useStore.getState()
  updateLayerMetadata(spec.id, { geometryType })

  const lineId = `${spec.id}-line`
  if (geometryType !== 'polygon' || !map.getLayer(lineId)) return
  map.setFilter(lineId, POLYGON_OUTLINE_FILTER)
  recordBaseFilter(lineId, POLYGON_OUTLINE_FILTER)
  const opacity = layerMetadata[spec.id]?.opacity ?? spec.opacity
  const paint = withLayerOpacity(lineId, 'line', paintForLine(spec.symbology, true), opacity)
  for (const [prop, value] of Object.entries(paint)) {
    setPaint(map, lineId, prop, value)
  }
}

// a listed source layer missing from the archive drops its row
function removeChild(map: MapLibreMap, id: string): void {
  for (const suffix of ['-fill', '-line', '-point', '-label']) {
    if (map.getLayer(`${id}${suffix}`)) map.removeLayer(`${id}${suffix}`)
  }
  const store = useStore.getState()
  store.setLayerBoundsGetter(id, undefined)
  store.removeLayerMetadata(id)
}

export function addRasterTileLayer(
  map: MapLibreMap,
  layer: RasterTileLayer,
  source: RasterSourceSpecification,
  getBounds: () => Promise<LngLatBoundsLike | undefined>,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`
  const rasterId = `${layer.id}-raster`
  const { visible, opacity } = resolvedState({
    id: layer.id,
    visible: layer.visible ?? true,
    opacity: layer.rasterOpacity ?? 1,
  })

  map.addSource(sourceId, source)
  map.addLayer({
    id: rasterId,
    type: 'raster',
    source: sourceId,
    paint: { 'raster-opacity': opacity },
    layout: { visibility: visible ? 'visible' : 'none' },
    ...(layer.minZoom !== undefined ? { minzoom: layer.minZoom } : {}),
    ...(layer.maxZoom !== undefined ? { maxzoom: layer.maxZoom } : {}),
  })
  // no features to click
  useStore.getState().setPopupLayerOverride(layer.id, [])

  return { id: layer.id, sourceId, sublayerIds: [rasterId], getBounds }
}
