import { pmtilesMetadata } from './pmtilesProtocol'
import { resolveLayerUrl } from './resolveLayerUrl'

// a vector tile layer's source layers, by type and URL for the editor
// so a layer added since the last Refresh Settings is read too
export async function sourceLayerNames(type: string, url: string): Promise<string[]> {
  let metadata: unknown
  if (type === 'pmtiles') metadata = await pmtilesMetadata(resolveLayerUrl(url))
  else if (type === 'tiles' && !url.includes('{z}')) metadata = await (await fetch(url)).json()
  const names = ((metadata as { vector_layers?: { id: string }[] } | undefined)?.vector_layers ?? []).map((v) => v.id)
  if (names.length === 0) throw new Error("these tiles don't list their layers")
  return names
}
