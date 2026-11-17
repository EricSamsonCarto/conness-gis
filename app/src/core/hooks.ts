import { useEffect } from 'react'
import { useStore } from './store'

export const useMap = () => useStore((s) => s.map)

export const useMapReady = () => useStore((s) => s.isMapReady)

// no popups or pointer cursor until every claim releases
// set your own map cursor while holding it
export function useMapClickLock(owner: string, active: boolean): void {
  useEffect(() => {
    if (!active) return
    clearTimeout(pendingRelease.get(owner))
    pendingRelease.delete(owner)
    const { claimMapClicks, releaseMapClicks } = useStore.getState()
    claimMapClicks(owner)
    return () => {
      // a tick late, Draw's dblclick finish is followed by a popup click
      pendingRelease.set(
        owner,
        setTimeout(() => {
          pendingRelease.delete(owner)
          releaseMapClicks(owner)
        }, 0),
      )
    }
  }, [owner, active])
}

const pendingRelease = new Map<string, ReturnType<typeof setTimeout>>()
