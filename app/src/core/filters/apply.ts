import { useStore } from '../store'
import type { LayerFilterState } from '../types'
import { toPredicate } from './compile'

// always go through here, it sets the store and the map together
export function updateLayerFilter(layerId: string, next: LayerFilterState): void {
  const { setLayerFilterState, layerFilterHandlers } = useStore.getState()
  setLayerFilterState(layerId, next)
  layerFilterHandlers[layerId]?.apply(next)
}

// null when no filter is on. read at call time, never cached
export function currentFilterPredicate(
  layerId: string,
): ((props: Record<string, unknown> | null) => boolean) | null {
  return toPredicate(useStore.getState().layerFilters[layerId])
}
