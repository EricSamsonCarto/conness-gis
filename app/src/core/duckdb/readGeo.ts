import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { getDuckDB } from './engine'

// cached per layer, since basemap switches re-register every layer

const cache = new Map<string, Promise<FeatureCollection>>()

// keyed by what was read too, so a file changed live reads the new one
function cached(key: string, read: () => Promise<FeatureCollection>): Promise<FeatureCollection> {
  const hit = cache.get(key)
  if (hit) return hit
  const promise = read().catch((err: unknown) => {
    // evict so a later call retries
    cache.delete(key)
    throw err
  })
  cache.set(key, promise)
  return promise
}

// fallbacks for parquet without `geo` metadata
const GEOMETRY_COLUMN_NAMES = ['geometry', 'geom', 'wkb_geometry', 'shape', 'wkb', 'geo_shape']
const SKIPPED_COLUMNS = ['bbox', 'geometry_bbox']
const WGS84 = new Set(['EPSG:4326', 'OGC:CRS84', 'CRS84'])

export const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`
export const sqlIdent = (s: string) => `"${s.replace(/"/g, '""')}"`

export interface Column {
  name: string
  type: string
}

export type Row = Record<string, unknown>

export async function query(sql: string): Promise<Row[]> {
  const conn = await getDuckDB()
  const table = await conn.query(sql)
  return table.toArray().map((r: { toJSON(): Row }) => r.toJSON())
}

// the PROJJSON id as AUTH and CODE, else the PROJJSON, PROJ takes both
// absent means WGS84 per the GeoParquet spec
function crsFromGeoMetadata(crs: unknown): string | null {
  if (crs === undefined || crs === null) return null
  if (typeof crs === 'string') return crs
  const id = (crs as { id?: { authority?: string; code?: string | number } }).id
  if (id?.authority && id.code !== undefined) return `${id.authority}:${id.code}`
  return JSON.stringify(crs)
}

// GEOMETRY('EPSG:4326') gives 'EPSG:4326', a plain GEOMETRY null
function crsFromColumnType(type: string): string | null {
  const m = /^GEOMETRY\('(.+)'\)$/i.exec(type)
  return m ? m[1] : null
}

export interface GeoParquetSource {
  from: string
  attrs: Column[]
  // SQL for the geometry in WGS84
  geom: string
}

export async function describeGeoParquet(url: string): Promise<GeoParquetSource> {
  const from = `read_parquet(${sqlString(url)})`
  const columns = (await query(`DESCRIBE SELECT * FROM ${from}`)).map(
    (r): Column => ({ name: String(r.column_name), type: String(r.column_type) }),
  )

  let geo: {
    primary_column?: string
    columns?: Record<
      string,
      { encoding?: string; crs?: unknown; covering?: { bbox?: { xmin?: string[] } } }
    >
  } = {}
  try {
    const kv = await query(
      `SELECT decode(value) AS geo FROM parquet_kv_metadata(${sqlString(url)}) WHERE decode(key) = 'geo'`,
    )
    if (kv[0]?.geo) geo = JSON.parse(String(kv[0].geo))
  } catch {
    // plain parquet, no GeoParquet metadata
  }

  const geomName =
    geo.primary_column ??
    columns.find((c) => GEOMETRY_COLUMN_NAMES.includes(c.name.toLowerCase()))?.name
  const geomCol = columns.find((c) => c.name === geomName)

  let geom: string
  let crs: string | null = null
  if (geomCol) {
    const col = sqlIdent(geomCol.name)
    const encoding = geo.columns?.[geomCol.name]?.encoding?.toUpperCase()
    if (geomCol.type.toUpperCase().startsWith('GEOMETRY')) geom = col
    else if (encoding === 'WKT') geom = `ST_GeomFromText(${col})`
    else geom = `ST_GeomFromWKB(${col})`
    crs = crsFromColumnType(geomCol.type) ?? crsFromGeoMetadata(geo.columns?.[geomCol.name]?.crs)
  } else if (columns.some((c) => c.name === 'lon') && columns.some((c) => c.name === 'lat')) {
    geom = 'ST_Point("lon", "lat")'
  } else {
    throw new Error('no geometry column found (and no lon/lat columns)')
  }

  if (crs && !WGS84.has(crs.toUpperCase())) {
    geom = `ST_Transform(${geom}, ${sqlString(crs)}, 'EPSG:4326', true)`
  }

  // bbox covering columns are an index, not attributes
  const covering = geomName ? geo.columns?.[geomName]?.covering?.bbox?.xmin?.[0] : undefined
  const skipped = new Set([...SKIPPED_COLUMNS, ...(covering ? [covering] : [])])
  const attrs = columns.filter(
    (c) =>
      c.name !== geomCol?.name &&
      !skipped.has(c.name) &&
      !c.type.toUpperCase().startsWith('GEOMETRY'),
  )
  return { from, attrs, geom }
}

async function readSource(
  { from, attrs, geom }: GeoParquetSource,
  limit?: number,
): Promise<FeatureCollection> {
  const select = [...attrs.map((c) => sqlIdent(c.name)), `ST_AsGeoJSON(${geom}) AS __geojson`].join(', ')
  const limitSql = limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : ''
  return toFeatureCollection(await query(`SELECT ${select} FROM ${from}${limitSql}`))
}

export function readGeoParquet(
  layerId: string,
  url: string,
  limit?: number,
): Promise<FeatureCollection> {
  return cached(`${layerId}\n${url}\n${limit}`, async () => readSource(await describeGeoParquet(url), limit))
}

// GeoJSON is WGS84 by spec, no reprojection
export async function describeGeoJSON(url: string): Promise<GeoParquetSource> {
  const from = `ST_Read(${sqlString(url)})`
  const attrs = (await query(`DESCRIBE SELECT * FROM ${from}`))
    .map((r): Column => ({ name: String(r.column_name), type: String(r.column_type) }))
    .filter((c) => c.name !== 'geom')
  return { from, attrs, geom: 'geom' }
}

export function readGeoJSON(layerId: string, url: string): Promise<FeatureCollection> {
  return cached(`${layerId}\n${url}`, async () => readSource(await describeGeoJSON(url)))
}

// JSON round-trip flattens Arrow struct proxies. BigInt can't be cloned,
// so a number when safe (like MVT values), a string past 2^53
function plain(row: Row): Row {
  return JSON.parse(
    JSON.stringify(row, (_k, v: unknown) =>
      typeof v === 'bigint' ? (Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()) : v,
    ),
  ) as Row
}

export function toFeatureCollection(rows: Row[]): FeatureCollection {
  const features: Feature[] = []
  for (const row of rows) {
    const geojson = row.__geojson
    if (geojson === null || geojson === undefined) continue
    const properties = plain(row)
    delete properties.__geojson
    features.push({
      type: 'Feature',
      id: features.length,
      geometry: JSON.parse(String(geojson)) as Geometry,
      properties,
    })
  }
  return { type: 'FeatureCollection', features }
}
