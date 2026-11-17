import type { DrawingSetPayload } from './DrawController'

export function drawingsToGeoJSON(
  payload: DrawingSetPayload,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: payload.features.map((sf, i) => ({
      type: 'Feature',
      id: i + 1,
      properties: {
        id: i + 1,
        name: sf.meta.name,
        shape_type: sf.meta.kind,
      },
      geometry: sf.geometry,
    })),
  }
}
