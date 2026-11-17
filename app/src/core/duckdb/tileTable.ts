import type { FeatureCollection } from 'geojson'
import { getDuckDB } from './engine'
import { query, sqlIdent, toFeatureCollection, type Column } from './readGeo'

export interface TileTable {
  table: string
  // already cast to MVT-accepted types
  attrs: string[]
  // WGS84
  bounds: [number, number, number, number] | undefined
}

const tables = new Map<string, Promise<TileTable>>()
// what each layer's table was built from, so a file changed live rebuilds it
const builtFrom = new Map<string, string>()
let counter = 0

// ST_AsMVT only accepts these property types
function castForMvt(col: Column): string {
  const id = sqlIdent(col.name)
  const t = col.type.toUpperCase()
  if (['BOOLEAN', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'VARCHAR'].includes(t)) return id
  if (['TINYINT', 'SMALLINT', 'UTINYINT', 'USMALLINT'].includes(t)) return `CAST(${id} AS INTEGER)`
  if (t === 'UINTEGER') return `CAST(${id} AS BIGINT)`
  if (t === 'UBIGINT' || t === 'HUGEINT' || t === 'UHUGEINT' || t.startsWith('DECIMAL')) {
    return `CAST(${id} AS DOUBLE)`
  }
  return `CAST(${id} AS VARCHAR)`
}

export function prepareTileTable(
  layerId: string,
  url: string,
  source: () => Promise<{ from: string; attrs: Column[]; geom: string }>,
): Promise<TileTable> {
  const hit = tables.get(layerId)
  if (hit && builtFrom.get(layerId) === url) return hit
  builtFrom.set(layerId, url)
  const promise = (async () => {
    await getDuckDB()
    const { from, attrs, geom } = await source()
    const table = `tile_${++counter}`
    const cols = attrs.map((c) => `${castForMvt(c)} AS ${sqlIdent(c.name)}`)
    await query(
      `CREATE OR REPLACE TABLE ${table} AS
       SELECT ${[...cols, `ST_Transform(${geom}, 'EPSG:4326', 'EPSG:3857', true) AS __g`].join(', ')}
       FROM ${from}`,
    )
    // null geometry or failed projection
    await query(`DELETE FROM ${table} WHERE __g IS NULL`)
    await query(
      `ALTER TABLE ${table} ADD COLUMN __xmin DOUBLE;
       ALTER TABLE ${table} ADD COLUMN __ymin DOUBLE;
       ALTER TABLE ${table} ADD COLUMN __xmax DOUBLE;
       ALTER TABLE ${table} ADD COLUMN __ymax DOUBLE;
       UPDATE ${table} SET __xmin = ST_XMin(__g), __ymin = ST_YMin(__g),
                           __xmax = ST_XMax(__g), __ymax = ST_YMax(__g);
       ALTER TABLE ${table} ADD COLUMN __area DOUBLE;
       UPDATE ${table} SET __area = (__xmax - __xmin) * (__ymax - __ymin);`,
    )
    // Hilbert order keeps each row group small so tile queries skip the rest
    try {
      const half = WEB_MERCATOR_WORLD / 2
      await query(
        `CREATE OR REPLACE TABLE ${table} AS SELECT * FROM ${table}
         ORDER BY ST_Hilbert(__g, ST_Extent(ST_MakeEnvelope(${-half}, ${-half}, ${half}, ${half})))`,
      )
    } catch (err) {
      console.warn(`[conness-gis] Layer "${layerId}": couldn't sort its tile table, tiles may be slower.`, err)
    }
    const [b] = await query(
      `SELECT ST_XMin(e) AS w, ST_YMin(e) AS s, ST_XMax(e) AS e2, ST_YMax(e) AS n FROM (
         SELECT ST_Transform(ST_MakeEnvelope(min(__xmin), min(__ymin), max(__xmax), max(__ymax)),
                             'EPSG:3857', 'EPSG:4326', true) AS e
         FROM ${table})`,
    )
    const bounds =
      b && b.w !== null && b.w !== undefined
        ? ([Number(b.w), Number(b.s), Number(b.e2), Number(b.n)] as [number, number, number, number])
        : undefined
    return { table, attrs: attrs.map((c) => c.name), bounds }
  })().catch((err: unknown) => {
    // evict so a later call retries
    tables.delete(layerId)
    throw err
  })
  tables.set(layerId, promise)
  return promise
}

export function tileTableFor(layerId: string): Promise<TileTable> | undefined {
  return tables.get(layerId)
}

const WEB_MERCATOR_WORLD = 40075016.68557849
const TILE_EXTENT = 4096

// like tippecanoe's drop-smallest, keep the `budget` largest features
// points have no area, so the first N
export async function tileBytes(
  t: TileTable,
  z: number,
  x: number,
  y: number,
  budget: number,
): Promise<Uint8Array> {
  const size = WEB_MERCATOR_WORLD / 2 ** z
  const pixel = size / TILE_EXTENT
  // constants, not a join, DuckDB only skips row groups on constant compares
  const x0 = -WEB_MERCATOR_WORLD / 2 + x * size
  const y1 = WEB_MERCATOR_WORLD / 2 - y * size
  const props = t.attrs.map((a) => `${sqlIdent(a)}: ${sqlIdent(a)}`)
  const [row] = await query(
    `SELECT ST_AsMVT({${[
      `geometry: ST_AsMVTGeom(__g, ST_Extent(ST_TileEnvelope(${z}, ${x}, ${y})), 4096, 64, true)`,
      ...props,
    ].join(', ')}}, 'data', 4096, 'geometry') AS tile
     FROM (
       SELECT * FROM ${t.table}
       WHERE __xmax >= ${x0} AND __xmin <= ${x0 + size} AND __ymax >= ${y1 - size} AND __ymin <= ${y1}
         AND (__area = 0 OR __area > ${pixel * pixel})
       ORDER BY __area DESC
       LIMIT ${Math.max(1, Math.floor(budget))}
     )`,
  )
  const tile = row?.tile
  // a copy, MapLibre may transfer the buffer to its worker
  return tile instanceof Uint8Array ? tile.slice() : new Uint8Array()
}

export async function distinctValues(t: TileTable, column: string): Promise<unknown[]> {
  const rows = await query(
    `SELECT DISTINCT ${sqlIdent(column)} AS v FROM ${t.table} WHERE ${sqlIdent(column)} IS NOT NULL`,
  )
  return rows.map((r) => (typeof r.v === 'bigint' ? Number(r.v) : r.v))
}

export async function allFeatures(t: TileTable): Promise<FeatureCollection> {
  const select = [
    ...t.attrs.map((a) => sqlIdent(a)),
    `ST_AsGeoJSON(ST_Transform(__g, 'EPSG:3857', 'EPSG:4326', true)) AS __geojson`,
  ].join(', ')
  return toFeatureCollection(await query(`SELECT ${select} FROM ${t.table}`))
}
