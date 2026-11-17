// an ArcGIS scale as a zoom level, the way ArcGIS clients relate them
// 591,657,527.59 is the scale at zoom 0, and 0 means no limit
export function scaleToZoom(scale: unknown): number | undefined {
  if (typeof scale !== 'number' || scale <= 0) return undefined
  return Math.log2(591657527.591555 / scale)
}
