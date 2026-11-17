import type { Map as MapLibreMap } from 'maplibre-gl'

// a hidden source may never report loaded
const SWAP_TIMEOUT_MS = 1000

// waits for the worker round trip so old layers go without a blank frame
// sourcedata only, since right after setData old tiles still report loaded
export function onSourcesLoaded(map: MapLibreMap, ids: string[], fn: () => void): () => void {
  let done = false
  const run = () => {
    if (done) return
    done = true
    map.off('sourcedata', onData)
    clearTimeout(timer)
    fn()
  }
  const onData = () => {
    if (ids.every((id) => !map.getSource(id) || map.isSourceLoaded(id))) run()
  }
  const timer = setTimeout(run, SWAP_TIMEOUT_MS)
  map.on('sourcedata', onData)
  return run
}

export function removeOverlay(
  map: MapLibreMap,
  parts: { layers: string[]; sources: string[] },
): void {
  for (const layer of parts.layers) if (map.getLayer(layer)) map.removeLayer(layer)
  for (const source of parts.sources) if (map.getSource(source)) map.removeSource(source)
}
