import type { SymbologyRaw, SymbologySimple } from '../types'

// Google Earth's plain circle, tinted by IconStyle's color
export const POINT_ICON = 'https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png'

// also drops control chars XML 1.0 forbids, one breaks the whole file
export const escapeXml = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex -- stripping them is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// KML wants aabbggrr, anything not hex falls back to blue
export function kmlColor(hex: string, opacity = 1): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '3b82f6'
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')
  return (a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toLowerCase()
}

const coords = (ring: GeoJSON.Position[]) => ring.map(([x, y]) => `${x},${y}`).join(' ')

export function geometryKml(g: GeoJSON.Geometry): string {
  switch (g.type) {
    case 'Point':
      return `<Point><coordinates>${coords([g.coordinates])}</coordinates></Point>`
    case 'LineString':
      return `<LineString><tessellate>1</tessellate><coordinates>${coords(g.coordinates)}</coordinates></LineString>`
    case 'Polygon': {
      const [outer, ...holes] = g.coordinates
      const ring = (r: GeoJSON.Position[]) => `<LinearRing><coordinates>${coords(r)}</coordinates></LinearRing>`
      return (
        `<Polygon><tessellate>1</tessellate><outerBoundaryIs>${ring(outer)}</outerBoundaryIs>` +
        holes.map((h) => `<innerBoundaryIs>${ring(h)}</innerBoundaryIs>`).join('') +
        `</Polygon>`
      )
    }
    case 'MultiPoint':
    case 'MultiLineString':
    case 'MultiPolygon': {
      const single = g.type.slice(5) as 'Point' | 'LineString' | 'Polygon'
      const parts = (g.coordinates as unknown[]).map((c) =>
        geometryKml({ type: single, coordinates: c } as GeoJSON.Geometry),
      )
      return `<MultiGeometry>${parts.join('')}</MultiGeometry>`
    }
    case 'GeometryCollection':
      return `<MultiGeometry>${g.geometries.map(geometryKml).join('')}</MultiGeometry>`
  }
}

export function kmlDocument(name: string, body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(name)}</name>\n` +
    body +
    `\n</Document></kml>\n`
  )
}

// KML's LineStyle covers lines and polygon borders, styled differently
function simpleStyles(s: SymbologySimple | SymbologyRaw | undefined): string | null {
  if (s?.kind !== 'simple') return null
  const opacity = s.opacity ?? 1
  const stroke = s.strokeColor ?? '#ffffff'
  const strokeOpacity = s.strokeOpacity ?? 1
  const borderWidth = s.strokeWidth ?? 0
  return (
    `<Style id="line"><LineStyle><color>${kmlColor(s.color, opacity)}</color><width>${s.width ?? 2}</width></LineStyle></Style>\n` +
    `<Style id="polygon"><LineStyle><color>${kmlColor(stroke, strokeOpacity)}</color><width>${borderWidth}</width></LineStyle>` +
    `<PolyStyle><color>${kmlColor(s.color, opacity)}</color><fill>1</fill><outline>${borderWidth > 0 ? 1 : 0}</outline></PolyStyle></Style>\n` +
    `<Style id="point"><IconStyle><color>${kmlColor(s.color, opacity)}</color><scale>${((s.radius ?? 5) / 8).toFixed(2)}</scale>` +
    `<Icon><href>${POINT_ICON}</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>`
  )
}

function styleIdFor(g: GeoJSON.Geometry): 'line' | 'polygon' | 'point' {
  if (g.type === 'GeometryCollection') return g.geometries[0] ? styleIdFor(g.geometries[0]) : 'point'
  if (g.type.includes('Polygon')) return 'polygon'
  if (g.type.includes('LineString')) return 'line'
  return 'point'
}

// only `simple` symbology is styled, `raw` would need a style per feature
export function featuresToKML(
  fc: GeoJSON.FeatureCollection,
  name: string,
  symbology?: SymbologySimple | SymbologyRaw,
): string {
  const styles = simpleStyles(symbology)
  const placemarks = fc.features
    .filter((f) => f.geometry)
    .map((f, i) => {
      const props = f.properties ?? {}
      const label = props.name ?? props.Name ?? props.NAME ?? `${name} ${i + 1}`
      const data = Object.entries(props)
        .map(([k, v]) => {
          const value = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
          return `<Data name="${escapeXml(k)}"><value>${escapeXml(value)}</value></Data>`
        })
        .join('')
      return (
        `<Placemark><name>${escapeXml(String(label))}</name>` +
        (styles ? `<styleUrl>#${styleIdFor(f.geometry)}</styleUrl>` : '') +
        (data ? `<ExtendedData>${data}</ExtendedData>` : '') +
        geometryKml(f.geometry) +
        `</Placemark>`
      )
    })
  return kmlDocument(name, (styles ? styles + '\n' : '') + placemarks.join('\n'))
}
