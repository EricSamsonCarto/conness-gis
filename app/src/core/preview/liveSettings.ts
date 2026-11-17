import { settings } from '@user/settings'
import { symbologies } from '@user/symbology'
import type { Settings, SymbologyRegistry } from '../types'
import { applyTheme } from '../theme/theme'
import { applyUiVars } from '../theme/uiVars'
import { useStore } from '../store'
import { validateLayout } from '../widgets/layout'
import { validateSearchConfig } from '../search/providers'
import { applyLayerChanges } from '../layers/liveLayers'

// settings are refilled in place, so every module reading them sees them
// any change liveAreas.ts doesn't allow still reloads the page
export function applyLiveSettings(next: { settings: Settings; symbologies: SymbologyRegistry }): void {
  // anything that throws reloads the page, which shows why
  validateLayout(next.settings)
  validateSearchConfig(next.settings)
  const before = settings.layers
  // named styles and Label defaults redraw the layers that use them
  const restyleRefs = JSON.stringify(symbologies) !== JSON.stringify(next.symbologies)
  const restyleLabels = JSON.stringify(settings.ui?.layerDefaults) !== JSON.stringify(next.settings.ui?.layerDefaults)
  refill(settings, next.settings)
  refill(symbologies, next.symbologies)
  applyTheme(settings.theme ?? {})
  applyUiVars(settings.ui, useStore.getState().isMobile)
  document.title = settings.branding.title
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href = settings.branding.favicon ?? '/favicon.svg'
  setMetaDescription(settings.branding.description)
  if (restyleRefs || restyleLabels || JSON.stringify(before) !== JSON.stringify(settings.layers)) {
    const map = useStore.getState().map
    if (!map) throw new Error('[conness-gis] no map for the live changes')
    applyLayerChanges(map, before, settings.layers, { refs: restyleRefs, labels: restyleLabels })
  }
  useStore.getState().bumpSettings()
}

// the build writes these tags, so a live edit keeps them in step
function setMetaDescription(text: string | undefined): void {
  for (const [attr, value] of [['name', 'description'], ['property', 'og:description']]) {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`)
    if (!text) {
      tag?.remove()
      continue
    }
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute(attr, value)
      document.head.append(tag)
    }
    tag.content = text
  }
}

function refill(target: object, source: object): void {
  for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key]
  Object.assign(target, source)
}
