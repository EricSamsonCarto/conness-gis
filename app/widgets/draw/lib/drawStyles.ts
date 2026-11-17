import { HOVER_COLOR } from '@/core/map/mapboxDraw'

export const VERTEX_LAYER_ID = 'draw-vertex'
export const VERTEX_HALO_LAYER_ID = 'draw-vertex-halo'

// blue fallback, a just-started feature has no user_color yet
const featureColor: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  HOVER_COLOR,
  ['coalesce', ['get', 'user_color'], '#3b82f6'],
]

const lineWidth: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  ['+', ['coalesce', ['get', 'user_width'], 2.5], 1.5],
  ['coalesce', ['get', 'user_width'], 2.5],
]
const fillOpacity: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  ['+', ['coalesce', ['get', 'user_fillOpacity'], 0.2], 0.15],
  ['coalesce', ['get', 'user_fillOpacity'], 0.2],
]
const pointRadius: unknown = ['coalesce', ['get', 'user_radius'], 6]
const boundaryColor: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  HOVER_COLOR,
  ['coalesce', ['get', 'user_boundaryColor'], ['get', 'user_color'], '#3b82f6'],
]
// full on hover so the highlight always shows
const boundaryOpacity: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  1,
  ['coalesce', ['get', 'user_boundaryOpacity'], 1],
]
const pointStrokeColor: unknown = ['coalesce', ['get', 'user_strokeColor'], '#ffffff']
const pointStrokeWidth: unknown = ['coalesce', ['get', 'user_strokeWidth'], 1.5]

// intensity 0.5 matches Measure's shadow
export function shadowOpacity(intensity: unknown): unknown {
  return ['*', ['coalesce', intensity, 0.5], 0.6]
}
export function shadowPaint(width: unknown, intensity: unknown) {
  return {
    'line-color': '#000000',
    'line-opacity': shadowOpacity(intensity) as number,
    'line-width': ['+', width, 4.5] as unknown as number,
    'line-blur': 4,
    'line-translate': [1, 2] as [number, number],
  }
}

// active features dashed, finished solid
export const drawStyles: object[] = [
  // first, so shadows draw beneath every other draw layer
  {
    id: 'draw-shadow',
    type: 'line',
    filter: [
      'all',
      ['==', 'meta', 'feature'],
      ['in', '$type', 'LineString', 'Polygon'],
      ['==', 'user_shadow', true],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: shadowPaint(['coalesce', ['get', 'user_width'], 2.5], ['get', 'user_shadowIntensity']),
  },
  {
    id: 'draw-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    paint: { 'fill-color': featureColor, 'fill-opacity': fillOpacity },
  },
  {
    id: 'draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': boundaryColor, 'line-width': lineWidth, 'line-opacity': boundaryOpacity },
  },
  {
    id: 'draw-line-inactive',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': lineWidth },
  },
  {
    id: 'draw-point-inactive',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'feature'],
      ['==', 'active', 'false'],
      ['!=', 'user_isText', true],
    ],
    paint: {
      'circle-radius': pointRadius,
      'circle-color': featureColor,
      'circle-stroke-color': pointStrokeColor,
      'circle-stroke-width': pointStrokeWidth,
    },
  },

  {
    id: 'draw-fill-active',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: { 'fill-color': featureColor, 'fill-opacity': 0.12 },
  },
  {
    id: 'draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': boundaryColor, 'line-width': 2.5, 'line-dasharray': [2, 2] },
  },
  {
    id: 'draw-line-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': 2.5, 'line-dasharray': [2, 2] },
  },
  {
    id: 'draw-point-active',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'feature'],
      ['==', 'active', 'true'],
      ['!=', 'user_isText', true],
    ],
    paint: {
      'circle-radius': pointRadius,
      'circle-color': featureColor,
      'circle-stroke-color': pointStrokeColor,
      'circle-stroke-width': pointStrokeWidth,
    },
  },

  // points and text have no vertices, circle strokes can't dash
  {
    id: 'draw-active-point-ring',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['==', 'active', 'true']],
    paint: {
      // clears the point, or the text glyphs via font size
      'circle-radius': [
        'case',
        ['==', ['get', 'user_isText'], true],
        ['+', ['*', ['coalesce', ['get', 'user_fontSize'], 20], 0.6], 6],
        ['+', ['coalesce', ['get', 'user_radius'], 6], 6],
      ],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#1e293b',
      'circle-stroke-width': 2,
    },
  },
  {
    id: 'draw-active-point-dot',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['==', 'active', 'true']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#1e293b',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
    },
  },

  {
    id: 'draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#1e293b',
      'circle-stroke-width': 1.5,
    },
  },

  {
    id: VERTEX_HALO_LAYER_ID,
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
    paint: { 'circle-radius': 6, 'circle-color': '#ffffff' },
  },
  {
    id: VERTEX_LAYER_ID,
    type: 'circle',
    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 4,
      'circle-color': '#3b82f6',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
    },
  },

  {
    id: 'draw-text',
    type: 'symbol',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['==', 'user_isText', true]],
    layout: {
      'text-field': ['coalesce', ['get', 'user_text'], ''],
      'text-font': ['Noto Sans Regular'],
      // bigger on hover so list-row hover shows on text
      'text-size': [
        'case',
        ['==', ['get', 'user_hover'], true],
        ['+', ['coalesce', ['get', 'user_fontSize'], 20], 4],
        ['coalesce', ['get', 'user_fontSize'], 20],
      ],
      'text-anchor': 'center',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'user_hover'], true],
        HOVER_COLOR,
        ['coalesce', ['get', 'user_color'], '#3b82f6'],
      ],
      'text-halo-color': pointStrokeColor,
      'text-halo-width': pointStrokeWidth,
    },
  },
]
