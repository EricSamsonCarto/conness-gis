import { settings } from '@user/settings'
import type { LayerConfig } from '../types'
import { useStore } from '../store'

// tiles, rasters and esri only fetch what's in view
const DEFERRABLE: ReadonlySet<LayerConfig['type']> = new Set(['geojson', 'geoparquet', 'flatgeobuf'])

export function isDeferred(layer: LayerConfig): boolean {
  return (
    (settings.map.onlyVisibleOnLoad ?? false) &&
    !(layer.visible ?? true) &&
    DEFERRABLE.has(layer.type)
  )
}

export function loadWhenVisible(
  layer: LayerConfig,
  visibleNow: boolean,
  start: () => Promise<unknown>,
): () => void {
  const run = () => {
    useStore.getState().setLayerDataPending(layer.id, true)
    void start().finally(() => useStore.getState().setLayerDataPending(layer.id, false))
  }
  if (visibleNow || !isDeferred(layer)) {
    run()
    return () => {}
  }
  const unsubscribe = useStore.subscribe((state) => {
    if (!state.layerMetadata[layer.id]?.visible) return
    unsubscribe()
    run()
  })
  return unsubscribe
}
