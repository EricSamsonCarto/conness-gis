import type { Map as MapLibreMap } from 'maplibre-gl'
import type {
  LabelConfig,
  LayerConfig,
  LayerFilterConfig,
  LayerGeometryType,
  LayerListActionsConfig,
  LayerMetadata,
  LegendOverride,
  Symbology,
} from '../types'
import { useStore } from '../store'
import type { RegisteredLayer } from './loaders/geojson'
import { setLabelVisibility } from './layerOps'

// a settings.layers entry, or a PMTiles child source layer
export interface LayerRecord {
  id: string
  name: string
  group?: string
  // configured value, the store wins after a basemap switch
  visible: boolean
  opacity: number
  symbology?: Symbology
  geometryType?: LayerGeometryType
  hideFromLegend?: boolean
  legend?: LegendOverride
  minZoom?: number
  maxZoom?: number
  label?: LabelConfig
  raster?: boolean
  actions?: LayerListActionsConfig
  filters?: LayerFilterConfig[]
  isParent?: boolean
  childIds?: string[]
  parentId?: string
}

export function resolvedState(record: Pick<LayerRecord, 'id' | 'visible' | 'opacity'>): {
  visible: boolean
  opacity: number
} {
  const existing = useStore.getState().layerMetadata[record.id]
  return {
    visible: existing?.visible ?? record.visible,
    opacity: existing?.opacity ?? record.opacity,
  }
}

// others put opacity in symbology
export function configuredOpacity(layer: LayerConfig): number | undefined {
  if (layer.type === 'esri') return layer.esriOpacity
  if ((layer.type === 'pmtiles' || layer.type === 'tiles') && layer.raster) return layer.rasterOpacity
  return undefined
}

export function startOpacity(layer: LayerConfig): number {
  return useStore.getState().layerMetadata[layer.id]?.opacity ?? configuredOpacity(layer) ?? 1
}

export function recordLayer(
  map: MapLibreMap,
  record: LayerRecord,
  entry: RegisteredLayer,
): void {
  const {
    layerMetadata,
    layerFilters,
    setLayerMetadata,
    setLayerBoundsGetter,
    setLayerFeatureGetter,
    setLayerFilterHandler,
    setLayerDataPending,
  } = useStore.getState()
  const existing = layerMetadata[record.id]
  const { visible, opacity } = resolvedState(record)

  setLayerBoundsGetter(record.id, entry.getBounds)
  setLayerFeatureGetter(record.id, entry.getFeatures)
  // hold the boot overlay until async data lands
  if (entry.ready) {
    setLayerDataPending(record.id, true)
    void entry.ready.finally(() => useStore.getState().setLayerDataPending(record.id, false))
  }
  setLayerFilterHandler(record.id, entry.filter)
  // re-apply the user's filter after a basemap switch
  const existingFilter = layerFilters[record.id]
  if (existingFilter) entry.filter?.apply(existingFilter)

  // a hidden layer hides labels anyway, new labeled layers start on
  const hasLabel = record.label !== undefined
  const labelsVisible = hasLabel ? (existing?.labelsVisible ?? true) : undefined
  if (hasLabel) setLabelVisibility(map, record.id, visible && labelsVisible!)

  const metadata: LayerMetadata = {
    id: record.id,
    name: record.name,
    group: record.group,
    visible,
    opacity,
    symbology: record.symbology,
    // keep tilestats-detected geometry across a basemap switch
    geometryType: record.geometryType ?? existing?.geometryType,
    hideFromLegend: record.hideFromLegend,
    legend: record.legend,
    minZoom: record.minZoom,
    maxZoom: record.maxZoom,
    hasLabel,
    labelsVisible,
    raster: record.raster,
    actions: record.actions,
    filters: record.filters,
    isParent: record.isParent,
    childIds: record.childIds,
    parentId: record.parentId,
  }
  setLayerMetadata(record.id, metadata)
}
