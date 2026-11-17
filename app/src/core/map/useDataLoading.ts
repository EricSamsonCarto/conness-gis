import { useEffect, useState } from 'react'
import { settings } from '@user/settings'
import { useStore } from '../store'
import { isDeferred } from '../layers/lazyLoad'

// each owns `src-<id>`, PMTiles children share their parent's
const configuredIds = new Set(settings.layers.filter((l) => !isDeferred(l)).map((l) => l.id))

// hidden layers count too, they still load at boot and freeze the map
export function useDataLoading(): {
  isLoading: boolean
  loaded: number
  total: number
  // in settings order
  waiting: string[]
} {
  const map = useStore((s) => s.map)
  const isMapReady = useStore((s) => s.isMapReady)
  // re-runs as layers register (boot spreads across ticks)
  const layerMetadata = useStore((s) => s.layerMetadata)
  // in deps so clearing one re-checks without another 'sourcedata'
  const pendingLayerData = useStore((s) => s.pendingLayerData)
  // frozen after the first non-empty read
  const [tracked, setTracked] = useState<string[] | null>(null)
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set())
  // latched so a later re-registration can't bring the overlay back
  const [done, setDone] = useState(false)

  // React's adjust-state-while-rendering, settles after one render
  if (tracked === null && map && isMapReady) {
    const ids = Object.keys(layerMetadata).filter((id) => configuredIds.has(id))
    // with layers configured, wait for at least one to register
    if (configuredIds.size === 0 || ids.length > 0) setTracked(ids)
  }

  useEffect(() => {
    if (!map || !tracked || done) return
    if (tracked.length === 0) return

    const check = () => {
      const next = new Set<string>()
      for (const id of tracked) {
        const sourceId = `src-${id}`
        try {
          if (!map.getSource(sourceId)) continue
          if (pendingLayerData[id]) continue
          if (map.isSourceLoaded(sourceId)) next.add(id)
        } catch {
          // source not registered yet
        }
      }
      setLoaded(next)
      const complete = next.size === tracked.length
      if (complete) setDone(true)
      return complete
    }

    if (check()) return

    const onData = () => {
      if (check()) {
        map.off('sourcedata', onData)
        map.off('idle', onData)
      }
    }
    map.on('sourcedata', onData)
    // a backstop, fast cache loads can skip the final sourcedata
    map.on('idle', onData)
    return () => {
      map.off('sourcedata', onData)
      map.off('idle', onData)
    }
  }, [map, tracked, pendingLayerData, done])

  const total = tracked?.length ?? 0
  const loadedCount = loaded.size
  const isLoading = !done && (tracked === null || loadedCount < total)
  const waiting = (tracked ?? []).filter((id) => !loaded.has(id))
  return { isLoading, loaded: loadedCount, total, waiting }
}
