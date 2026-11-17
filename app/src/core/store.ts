import { create } from 'zustand'
import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import { settings } from '@user/settings'
import { initialIsMobile } from './useMediaQuery'
import { topBarOpenOnLoad } from './widgets/layout'
import type {
  LayerFilterHandler,
  LayerFilterState,
  LayerMetadata,
  PopupTrigger,
  SelectedPopupFeature,
  PopupLayer,
} from './types'

// URLs match by value, inline style objects by reference
function initialBasemapId(): string | null {
  const match = settings.basemaps.find((b) => b.style === settings.map.style)
  return match?.id ?? settings.basemaps[0]?.id ?? null
}

interface AppState {
  // bumped when live changes refill the settings, so React redraws
  settingsVersion: number
  bumpSettings: () => void
  // the spin's pause button, or a touch when it doesn't keep spinning
  spinPaused: boolean
  setSpinPaused: (paused: boolean) => void
  // the Basemap widget's elevation switches, shared with bookmarks
  hillshadeOn: boolean
  setHillshadeOn: (on: boolean) => void
  contoursOn: boolean
  setContoursOn: (on: boolean) => void
  map: MapLibreMap | null
  isMapReady: boolean
  isMobile: boolean
  // a popup shows over it, the widget stays mounted underneath
  mobileSheetWidgetId: string | null
  openWidgetId: string | null
  // undefined until someone picks one, so sideRailOpenOnLoad applies
  sideRailWidgetId: string | null | undefined
  setSideRailWidget: (id: string | null) => void
  activeFloatingWidgetId: string | null
  currentBasemapId: string | null
  layerMetadata: Record<string, LayerMetadata>
  // not every layer has one (an esri raster with no extent)
  layerBoundsGetters: Record<string, () => Promise<LngLatBoundsLike | undefined>>
  loadingStatus: string | null
  // counted unloaded even if MapLibre says the source is loaded
  pendingLayerData: Record<string, true>
  // geojson + geoparquet only
  layerFeatureGetters: Record<string, () => Promise<GeoJSON.Feature[]>>
  // session-only, only filterable layers have a handler
  layerFilters: Record<string, LayerFilterState>
  layerFilterHandlers: Record<string, LayerFilterHandler>
  // in the store so it survives the widget unmounting
  collapsedGroups: Set<string>
  // each group's default when seeded, so a new default applies again
  seenGroups: Map<string, boolean>
  // replaces that layer when wiring popups, PMTiles has one per source layer
  popupLayerOverrides: Record<string, PopupLayer[]>
  // PMTiles parents start collapsed unless `collapsed: false`
  expandedParents: Set<string>

  // popups stay off while any owner holds a claim
  mapClickOwners: string[]

  // hover writes one element, trigger drives the click-only pager
  selectedFeatures: SelectedPopupFeature[]
  selectedFeatureIndex: number
  // where the popup was opened from (position "feature"), else null
  popupAnchor: [number, number] | null
  selectedFeatureTrigger: PopupTrigger | null
  // px from the map area, null is the default anchor. survives reopening
  popupPosition: { x: number; y: number } | null
  // null = configured size
  popupSize: { width: number; height: number } | null

  setMap: (map: MapLibreMap | null) => void
  setMapReady: (ready: boolean) => void
  setIsMobile: (isMobile: boolean) => void
  claimMapClicks: (owner: string) => void
  releaseMapClicks: (owner: string) => void
  setPopupPosition: (pos: { x: number; y: number } | null) => void
  setPopupSize: (size: { width: number; height: number } | null) => void
  // the same id toggles it closed, opening clears any popup
  openMobileWidget: (id: string) => void
  closeMobileSheet: () => void
  setOpenWidget: (id: string | null) => void
  setActiveFloatingWidget: (id: string | null) => void
  setCurrentBasemap: (id: string | null) => void
  setLayerMetadata: (id: string, metadata: LayerMetadata) => void
  updateLayerMetadata: (id: string, patch: Partial<LayerMetadata>) => void
  removeLayerMetadata: (id: string) => void
  setLayerBoundsGetter: (
    id: string,
    getBounds: (() => Promise<LngLatBoundsLike | undefined>) | undefined,
  ) => void
  setLoadingStatus: (status: string | null) => void
  setLayerDataPending: (id: string, pending: boolean) => void
  setLayerFeatureGetter: (
    id: string,
    getFeatures: (() => Promise<GeoJSON.Feature[]>) | undefined,
  ) => void
  setLayerFilterState: (id: string, state: LayerFilterState) => void
  setLayerFilterHandler: (id: string, handler: LayerFilterHandler | undefined) => void
  toggleGroupCollapsed: (name: string) => void
  toggleParentExpanded: (id: string) => void
  setPopupLayerOverride: (id: string, layers: PopupLayer[]) => void
  seedGroupCollapsed: (entries: { name: string; collapsed: boolean }[]) => void
  // [lng, lat] of the click or hover, for popups that open next to it
  setSelectedFeatures: (
    features: SelectedPopupFeature[],
    trigger: PopupTrigger,
    anchor?: [number, number],
  ) => void
  advancePopup: (direction: 1 | -1) => void
  closePopup: () => void
}

// for memos over settings, it changes when live changes refill them
export const useSettingsVersion = (): number => useStore((s) => s.settingsVersion)

export const useStore = create<AppState>((set) => ({
  settingsVersion: 0,
  bumpSettings: () => set((s) => ({ settingsVersion: s.settingsVersion + 1 })),
  spinPaused: false,
  setSpinPaused: (paused) => set({ spinPaused: paused }),
  hillshadeOn: false,
  setHillshadeOn: (on) => set({ hillshadeOn: on }),
  contoursOn: false,
  setContoursOn: (on) => set({ contoursOn: on }),
  map: null,
  isMapReady: false,
  isMobile: initialIsMobile(),
  mobileSheetWidgetId: null,
  openWidgetId: initialIsMobile() ? null : topBarOpenOnLoad(settings),
  sideRailWidgetId: undefined,
  setSideRailWidget: (id) => set({ sideRailWidgetId: id }),
  activeFloatingWidgetId: null,
  currentBasemapId: initialBasemapId(),
  layerMetadata: {},
  layerBoundsGetters: {},
  layerFeatureGetters: {},
  loadingStatus: null,
  pendingLayerData: {},
  layerFilters: {},
  layerFilterHandlers: {},
  collapsedGroups: new Set<string>(),
  seenGroups: new Map<string, boolean>(),
  popupLayerOverrides: {},
  expandedParents: new Set(
    settings.layers
      .filter((l) => (l.type === 'pmtiles' || l.type === 'tiles') && !l.raster && l.collapsed === false)
      .map((l) => l.id),
  ),
  mapClickOwners: [],
  selectedFeatures: [],
  selectedFeatureIndex: 0,
  popupAnchor: null,
  selectedFeatureTrigger: null,
  popupPosition: null,
  popupSize: null,

  setMap: (map) => set({ map }),
  setMapReady: (ready) => set({ isMapReady: ready }),
  setIsMobile: (isMobile) => set({ isMobile }),
  claimMapClicks: (owner) =>
    set((s) => (s.mapClickOwners.includes(owner) ? s : { mapClickOwners: [...s.mapClickOwners, owner] })),
  releaseMapClicks: (owner) =>
    set((s) => ({ mapClickOwners: s.mapClickOwners.filter((o) => o !== owner) })),
  setPopupPosition: (pos) => set({ popupPosition: pos }),
  setPopupSize: (size) => set({ popupSize: size }),

  openMobileWidget: (id) =>
    set((state) => {
      const popupOpen = state.selectedFeatures.length > 0
      const reopening = state.mobileSheetWidgetId === id
      return {
        // the widget under a popup is already open, tapping reveals it
        mobileSheetWidgetId: reopening && !popupOpen ? null : id,
        selectedFeatures: [],
        selectedFeatureIndex: 0,
        selectedFeatureTrigger: null,
      }
    }),

  closeMobileSheet: () => set({ mobileSheetWidgetId: null }),

  setOpenWidget: (id) => set({ openWidgetId: id }),
  setActiveFloatingWidget: (id) => set({ activeFloatingWidgetId: id }),
  setCurrentBasemap: (id) => set({ currentBasemapId: id }),

  setLayerMetadata: (id, metadata) =>
    set((state) => ({
      layerMetadata: { ...state.layerMetadata, [id]: metadata },
    })),

  updateLayerMetadata: (id, patch) =>
    set((state) => {
      const existing = state.layerMetadata[id]
      if (!existing) return state
      return {
        layerMetadata: {
          ...state.layerMetadata,
          [id]: { ...existing, ...patch },
        },
      }
    }),

  removeLayerMetadata: (id) =>
    set((state) => {
      if (!(id in state.layerMetadata)) return state
      const next = { ...state.layerMetadata }
      delete next[id]
      return { layerMetadata: next }
    }),

  setLayerBoundsGetter: (id, getBounds) =>
    set((state) => {
      const next = { ...state.layerBoundsGetters }
      if (getBounds) next[id] = getBounds
      else delete next[id]
      return { layerBoundsGetters: next }
    }),

  setLoadingStatus: (status) => set({ loadingStatus: status }),

  setLayerDataPending: (id, pending) =>
    set((state) => {
      if (pending === (id in state.pendingLayerData)) return state
      const next = { ...state.pendingLayerData }
      if (pending) next[id] = true
      else delete next[id]
      return { pendingLayerData: next }
    }),

  setLayerFeatureGetter: (id, getFeatures) =>
    set((state) => {
      const next = { ...state.layerFeatureGetters }
      if (getFeatures) next[id] = getFeatures
      else delete next[id]
      return { layerFeatureGetters: next }
    }),

  setLayerFilterState: (id, state) =>
    set((s) => ({ layerFilters: { ...s.layerFilters, [id]: state } })),

  setLayerFilterHandler: (id, handler) =>
    set((state) => {
      const next = { ...state.layerFilterHandlers }
      if (handler) next[id] = handler
      else delete next[id]
      return { layerFilterHandlers: next }
    }),

  setPopupLayerOverride: (id, layers) =>
    set((state) => ({ popupLayerOverrides: { ...state.popupLayerOverrides, [id]: layers } })),

  toggleParentExpanded: (id) =>
    set((state) => {
      const next = new Set(state.expandedParents)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedParents: next }
    }),

  toggleGroupCollapsed: (name) =>
    set((state) => {
      const next = new Set(state.collapsedGroups)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return { collapsedGroups: next }
    }),

  seedGroupCollapsed: (entries) =>
    set((state) => {
      const unseen = entries.filter((e) => state.seenGroups.get(e.name) !== e.collapsed)
      if (unseen.length === 0) return state
      const nextSeen = new Map(state.seenGroups)
      const nextCollapsed = new Set(state.collapsedGroups)
      for (const { name, collapsed } of unseen) {
        nextSeen.set(name, collapsed)
        if (collapsed) nextCollapsed.add(name)
        else nextCollapsed.delete(name)
      }
      return { seenGroups: nextSeen, collapsedGroups: nextCollapsed }
    }),

  setSelectedFeatures: (features, trigger, anchor) =>
    set({
      selectedFeatures: features,
      selectedFeatureIndex: 0,
      popupAnchor: anchor ?? null,
      selectedFeatureTrigger: features.length === 0 ? null : trigger,
    }),

  advancePopup: (direction) =>
    set((state) => {
      const count = state.selectedFeatures.length
      if (count <= 1) return state
      const next = (state.selectedFeatureIndex + direction + count) % count
      return { selectedFeatureIndex: next }
    }),

  closePopup: () =>
    set({
      selectedFeatures: [],
      selectedFeatureIndex: 0,
      selectedFeatureTrigger: null,
    }),
}))
