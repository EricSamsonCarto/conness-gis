import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { settings } from '@user/settings'
import type { MapStyle } from '../types'
import { swapBasemap } from './basemapLayers'
import { useStore } from '../store'

// basemap id when the basemap is off
export const NO_BASEMAP_ID = 'none'

// read each time, so the editor's live changes reach it
export const mapBackgroundColor = () => settings.map.backgroundColor ?? '#000000'

// projection and sky belong to the kit. VersaTiles ships them
// and they would turn the globe on by itself
export const withoutBasemapProjection = {
  transformStyle: (_previous: StyleSpecification | undefined, next: StyleSpecification) => {
    const style = { ...next }
    delete style.projection
    delete style.sky
    return style
  },
}

// use instead of map.setStyle, which would remove every data layer
// false if it failed or a later switch won
export async function switchBasemap(map: MapLibreMap, style: MapStyle | null): Promise<boolean> {
  if (!(await swapBasemap(map, style))) return false
  await map.once('idle')
  return true
}

// the basemap on the map now, currentBasemapId runs ahead while loading
let shownId: string | null | undefined
// the last real basemap shown, for turning "No Basemap" off again
let lastRealId: string | null | undefined

export function previousBasemapId(): string | null {
  return lastRealId ?? settings.basemaps[0]?.id ?? null
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

// highlights `id` at once, a failed load hands it back
export async function selectBasemap(map: MapLibreMap, id: string, style: MapStyle | null): Promise<boolean> {
  const store = useStore.getState()
  shownId ??= store.currentBasemapId
  if (shownId !== NO_BASEMAP_ID) lastRealId = shownId
  store.setCurrentBasemap(id)
  // two frames, so the spinner paints before layer adds block the thread
  await nextFrame()
  await nextFrame()
  const ok = await switchBasemap(map, style)
  if (ok) shownId = id
  // a later click owns the highlight now
  else if (useStore.getState().currentBasemapId === id) useStore.getState().setCurrentBasemap(shownId)
  return ok
}
