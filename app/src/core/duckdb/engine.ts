import type { AsyncDuckDBConnection, DuckDBBundles } from '@duckdb/duckdb-wasm'
import { settings } from '@user/settings'
import { useStore } from '../store'
import type { LayerConfig } from '../types'

// lazy, so apps with no DuckDB layer never download it
// extensions must match the core version

let connPromise: Promise<AsyncDuckDBConnection> | null = null

export const usesDuckDB = (layer: LayerConfig): boolean =>
  layer.type === 'geoparquet' || (layer.type === 'geojson' && !!layer.duckdb)

export function getDuckDB(): Promise<AsyncDuckDBConnection> {
  if (!connPromise) {
    connPromise = init().catch((err: unknown) => {
      // clear so a later call retries
      connPromise = null
      throw err
    })
  }
  return connPromise
}

type DuckDBModule = typeof import('@duckdb/duckdb-wasm')

function bundles(duckdb: DuckDBModule): DuckDBBundles {
  const base = settings.duckdb?.bundleUrl
  if (!base) return duckdb.getJsDelivrBundles()
  // absolute, the worker runs from a blob URL
  const dir = new URL(base.endsWith('/') ? base : base + '/', location.href).href
  return {
    base: {
      mainModule: dir + 'duckdb-base.wasm',
      mainWorker: dir + 'duckdb-browser-base.worker.js',
    },
  }
}

async function init(): Promise<AsyncDuckDBConnection> {
  const status = useStore.getState().setLoadingStatus

  status('DuckDB')
  const duckdb = await import('@duckdb/duckdb-wasm')
  const bundle = await duckdb.selectBundle(bundles(duckdb))

  // cross-origin workers are blocked, so a same-origin blob imports the CDN one
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    }),
  )
  const worker = new Worker(workerUrl)
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)
  await db.open({})
  const conn = await db.connect()

  const repo = settings.duckdb?.extensionsUrl
  if (repo) await conn.query(`SET custom_extension_repository = '${repo.replace(/'/g, "''")}'`)

  for (const ext of ['parquet', 'httpfs']) {
    status(`${ext} extension`)
    await conn.query(`INSTALL ${ext}; LOAD ${ext};`)
  }

  // duckdb-wasm #2199, touch coordinate systems first to dodge a PROJ race
  try {
    await conn.query('SELECT * FROM duckdb_coordinate_systems() LIMIT 1')
  } catch {
    // not available before spatial on some versions
  }

  status('spatial extension')
  await conn.query('INSTALL spatial; LOAD spatial;')
  status(null)

  return conn
}
