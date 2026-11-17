function wkt(g: GeoJSON.Geometry): string {
  const pt = (p: GeoJSON.Position) => `${p[0]} ${p[1]}`
  const line = (ps: GeoJSON.Position[]) => `(${ps.map(pt).join(', ')})`
  const poly = (rings: GeoJSON.Position[][]) => `(${rings.map(line).join(', ')})`
  switch (g.type) {
    case 'Point':
      return `POINT (${pt(g.coordinates)})`
    case 'MultiPoint':
      return `MULTIPOINT (${g.coordinates.map((p) => `(${pt(p)})`).join(', ')})`
    case 'LineString':
      return `LINESTRING ${line(g.coordinates)}`
    case 'MultiLineString':
      return `MULTILINESTRING (${g.coordinates.map(line).join(', ')})`
    case 'Polygon':
      return `POLYGON ${poly(g.coordinates)}`
    case 'MultiPolygon':
      return `MULTIPOLYGON (${g.coordinates.map(poly).join(', ')})`
    case 'GeometryCollection':
      return `GEOMETRYCOLLECTION (${g.geometries.map(wkt).join(', ')})`
  }
}

// RFC 4180 quoting
function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function featuresToCSV(fc: GeoJSON.FeatureCollection): string {
  const features = fc.features
  const props = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))]
  const hasPoints = features.some((f) => f.geometry?.type === 'Point')
  const hasOther = features.some((f) => f.geometry && f.geometry.type !== 'Point')
  const generated = [...(hasPoints ? ['longitude', 'latitude'] : []), ...(hasOther ? ['wkt'] : [])]
  const taken = new Set([...props, ...generated])
  const propNames = props.map((p) => {
    if (!generated.includes(p)) return p
    let n = 1
    while (taken.has(`${p}_${n}`)) n++
    taken.add(`${p}_${n}`)
    return `${p}_${n}`
  })
  const header = [...propNames, ...generated]
  const rows = features.map((f) => {
    const g = f.geometry
    const isPoint = g?.type === 'Point'
    return [
      ...props.map((p) => f.properties?.[p]),
      ...(hasPoints ? (isPoint ? [g.coordinates[0], g.coordinates[1]] : [null, null]) : []),
      ...(hasOther ? [g && !isPoint ? wkt(g) : null] : []),
    ]
      .map(cell)
      .join(',')
  })
  // BOM so Excel reads UTF-8 correctly
  return '﻿' + [header.map(cell).join(','), ...rows].join('\r\n') + '\r\n'
}
