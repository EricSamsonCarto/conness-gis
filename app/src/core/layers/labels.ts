import type {
  Map as MapLibreMap,
  LayerSpecification,
  ExpressionSpecification,
} from 'maplibre-gl'
import { settings } from '@user/settings'
import type { LabelAnchor, LabelConfig, LayerGeometryType } from '../types'
import { withLayerOpacity } from './opacity'
import { labelTextExpression } from './labelText'

export const DEFAULT_FONT = 'Noto Sans Regular'
const BOLD_FONT = 'Noto Sans Bold'
export const DEFAULT_FONT_SIZE = 12
const DEFAULT_COLOR = '#333333'
const DEFAULT_HALO_COLOR = '#ffffff'
const DEFAULT_HALO_WIDTH = 1
const DEFAULT_ANCHOR: LabelAnchor = 'center'
// px between repeats along a line
const DEFAULT_LINE_SPACING = 500
// em, corner anchors clear the point symbol
const CORNER_OFFSET = 1

// text-anchor pins the opposite corner, so invert ours
type TextAnchor = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const ANCHOR_SPEC: Record<
  LabelAnchor,
  { anchor: TextAnchor; dir: [number, number] }
> = {
  center: { anchor: 'center', dir: [0, 0] },
  'top-left': { anchor: 'bottom-right', dir: [-1, -1] },
  'top-right': { anchor: 'bottom-left', dir: [1, -1] },
  'bottom-left': { anchor: 'top-right', dir: [-1, 1] },
  'bottom-right': { anchor: 'top-left', dir: [1, 1] },
}

function textField(
  label: LabelConfig,
): ExpressionSpecification | string | null {
  if (label.expression) return label.expression
  if (label.text) return labelTextExpression(label.text)
  if (label.field) return ['get', label.field]
  return null
}

export function addLabelLayer(
  map: MapLibreMap,
  opts: {
    layerId: string
    sourceId: string
    sourceLayer?: string
    label: LabelConfig
    geometryType?: LayerGeometryType
    visibility: 'visible' | 'none'
    opacity: number
    minZoom?: number
    maxZoom?: number
    beforeId?: string
  },
): string | null {
  const { layerId, sourceId, sourceLayer, label, visibility, opacity } = opts

  const field = textField(label)
  if (!field) return null

  const globalDefaults = settings.ui?.layerDefaults?.label ?? {}
  const { anchor, dir } = ANCHOR_SPEC[label.anchor ?? globalDefaults.anchor ?? DEFAULT_ANCHOR]
  const fontSize = label.fontSize ?? globalDefaults.fontSize ?? DEFAULT_FONT_SIZE
  // text-offset is in ems, the offset setting in px
  const px = label.offset ?? globalDefaults.offset
  const em = px === undefined ? CORNER_OFFSET : px / fontSize
  const offset: [number, number] = [dir[0] * em, dir[1] * em]

  // only set zoom keys when provided (else MapLibre defaults 0 / 24)
  const minzoom = label.minZoom ?? opts.minZoom
  const zoomRange: Pick<LayerSpecification, 'minzoom' | 'maxzoom'> = {}
  if (minzoom !== undefined) zoomRange.minzoom = minzoom
  if (opts.maxZoom !== undefined) zoomRange.maxzoom = opts.maxZoom

  // anchor and offset place text beside a point, not along a line
  const placement = opts.geometryType === 'line'
    ? {
        'symbol-placement': 'line' as const,
        'symbol-spacing': label.spacing ?? globalDefaults.spacing ?? DEFAULT_LINE_SPACING,
        'text-max-angle': 90,
      }
    : { 'text-anchor': anchor, 'text-offset': offset }

  const labelId = `${layerId}-label`
  map.addLayer({
    id: labelId,
    type: 'symbol',
    source: sourceId,
    ...(sourceLayer ? { 'source-layer': sourceLayer } : {}),
    layout: {
      'text-field': field,
      'text-font': [(label.bold ?? globalDefaults.bold) ? BOLD_FONT : DEFAULT_FONT],
      'text-size': fontSize,
      ...placement,
      'text-allow-overlap': label.allowOverlap ?? globalDefaults.allowOverlap ?? false,
      visibility,
    },
    paint: withLayerOpacity(labelId, 'symbol', {
      'text-color': label.color ?? globalDefaults.color ?? DEFAULT_COLOR,
      'text-halo-color': label.haloColor ?? globalDefaults.haloColor ?? DEFAULT_HALO_COLOR,
      'text-halo-width': label.haloWidth ?? globalDefaults.haloWidth ?? DEFAULT_HALO_WIDTH,
    }, opacity),
    ...zoomRange,
  }, opts.beforeId)

  return labelId
}
