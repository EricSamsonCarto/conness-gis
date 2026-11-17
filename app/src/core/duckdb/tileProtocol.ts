import type { RequestParameters } from 'maplibre-gl'
import { tileBytes, tileTableFor } from './tileTable'

const budgets = new Map<string, number>()

export function tileUrl(layerId: string, budget: number): string {
  budgets.set(layerId, budget)
  return `duckdb://${encodeURIComponent(layerId)}/{z}/{x}/{y}`
}

export async function duckdbTileProtocol(
  params: RequestParameters,
  abortController: AbortController,
): Promise<{ data: Uint8Array }> {
  const m = /^duckdb:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url)
  if (!m) throw new Error(`Invalid duckdb tile URL: ${params.url}`)
  const layerId = decodeURIComponent(m[1])
  const pending = tileTableFor(layerId)
  // the loader already warned about a failed table, so serve an empty tile
  const table = pending ? await pending.catch(() => undefined) : undefined
  if (!table) return { data: new Uint8Array() }
  const bytes = await tileBytes(table, Number(m[2]), Number(m[3]), Number(m[4]), budgets.get(layerId) ?? 5000)
  // DuckDB can't cancel a query, so drop it if MapLibre moved on
  abortController.signal.throwIfAborted()
  return { data: bytes }
}
