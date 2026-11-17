import type { LineLayerSpecification } from 'maplibre-gl'
import { HOVER_COLOR } from '@/core/map/mapboxDraw'

export const VERTEX_LAYER_ID = 'measure-vertex'
export const VERTEX_HALO_LAYER_ID = 'measure-vertex-halo'

// blue fallback, a just-started feature has no user_color yet
const featureColor: unknown = [
  'case',
  ['==', ['get', 'user_hover'], true],
  HOVER_COLOR,
  ['coalesce', ['get', 'user_color'], '#3b82f6'],
]

const lineWidth: unknown = ['case', ['==', ['get', 'user_hover'], true], 4, 2.5]
const fillOpacity: unknown = ['case', ['==', ['get', 'user_hover'], true], 0.35, 0.15]

export const SHADOW_PAINT: LineLayerSpecification['paint'] = {
  'line-color': '#000000',
  'line-opacity': 0.3,
  'line-width': 7,
  'line-blur': 4,
  'line-translate': [1, 2],
}

export const drawStyles: object[] = [
  // first, so it draws beneath the rest
  {
    id: 'measure-shadow',
    type: 'line',
    filter: ['all', ['==', 'meta', 'feature'], ['in', '$type', 'LineString', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: SHADOW_PAINT,
  },
  {
    id: 'measure-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    paint: { 'fill-color': featureColor, 'fill-opacity': fillOpacity },
  },
  {
    id: 'measure-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': lineWidth },
  },
  {
    id: 'measure-line-inactive',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': lineWidth },
  },
  {
    id: 'measure-fill-active',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: { 'fill-color': featureColor, 'fill-opacity': 0.12 },
  },
  {
    id: 'measure-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': 2.5, 'line-dasharray': [2, 2] },
  },
  {
    id: 'measure-line-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': featureColor, 'line-width': 2.5, 'line-dasharray': [2, 2] },
  },
  // smaller than vertices so midpoints read as "not real yet"
  {
    id: 'measure-midpoint',
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
]
