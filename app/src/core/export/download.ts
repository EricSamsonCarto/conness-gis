import type { ExportFormat } from '../types'

// shared so Draw and the layer list offer identical choices
export const EXPORT_FORMATS: { id: ExportFormat; label: string; description: string }[] = [
  { id: 'geojson', label: 'GeoJSON', description: 'Geometry and attributes, no styling' },
  { id: 'kml', label: 'KML', description: 'Keeps colors and styles. Opens in Google Earth' },
  { id: 'geoparquet', label: 'GeoParquet', description: 'Compact, for QGIS, Python and DuckDB' },
  { id: 'csv', label: 'CSV', description: 'A table for spreadsheets, with geometry as lon/lat or WKT' },
]

// omitted, empty or all-unknown `allowed` → all of `supported`
export function allowedExportFormats(
  allowed: ExportFormat[] | undefined,
  supported: ExportFormat[] = EXPORT_FORMATS.map((f) => f.id),
) {
  const offered = EXPORT_FORMATS.filter((f) => supported.includes(f.id))
  const picked = (allowed ?? [])
    .map((id) => offered.find((f) => f.id === id))
    .filter((f) => f !== undefined)
  return picked.length > 0 ? picked : offered
}

export function downloadFile(
  data: BlobPart,
  name: string,
  extension: string,
  mimeType: string,
): void {
  const safe = name
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const filename = `${safe || 'drawings'}.${extension}`
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadGeoJSON(fc: GeoJSON.FeatureCollection, name: string): void {
  downloadFile(JSON.stringify(fc, null, 2), name, 'geojson', 'application/geo+json')
}
