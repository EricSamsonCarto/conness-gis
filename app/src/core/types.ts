import type { ComponentType } from 'react'
import type { ControlPosition } from 'maplibre-gl'
import type { z } from 'zod'
import type * as basemaps from './schema/basemaps.ts'
import type * as layers from './schema/layers.ts'
import type * as settings from './schema/settings.ts'
import type * as symbology from './schema/symbology.ts'
import type * as theme from './schema/theme.ts'
import type * as ui from './schema/ui.ts'
import type * as widgets from './schema/widgets.ts'

// input types from the zod schemas, the engine applies the defaults itself
type In<T extends z.ZodType> = z.input<T>

export type { ControlPosition }

export type MapStyle = In<typeof basemaps.mapStyleSchema>
/** A Tailwind color name and shade, like `'red-500'`, or another token's name. */
export type TailwindColor = string

export type ThemeColors = In<typeof theme.themeColorsSchema>
// every color with a fixed default, map control colors follow light or dark
export type BaseColors = Required<Omit<ThemeColors, 'mapControlBg'>>
export type ThemeName = In<typeof theme.themeNameSchema>
export type ThemeSettings = In<typeof theme.themeSettingsSchema>
export type Branding = In<typeof settings.brandingSchema>
export type BasemapEntry = In<typeof basemaps.basemapEntrySchema>
export type GlobeSpinConfig = In<typeof settings.globeSpinSchema>
export type GlobeConfig = In<typeof settings.globeSchema>
export type MapInitialView = In<typeof settings.mapInitialViewSchema>

export type SymbologySimple = In<typeof symbology.symbologySimpleSchema>
export type LegendOverride = In<typeof symbology.legendOverrideSchema>
export type SymbologyRaw = In<typeof symbology.symbologyRawSchema>
export type SymbologyRef = In<typeof symbology.symbologyRefSchema>
export type Symbology = In<typeof symbology.symbologySchema>
export type SymbologyRegistry = In<typeof symbology.symbologyRegistrySchema>

export type PopupTrigger = In<typeof layers.popupTriggerSchema>
export type PopupPosition = In<typeof layers.popupPositionSchema>
export type PopupConfig = In<typeof layers.popupConfigSchema>
export type PopupUiConfig = In<typeof ui.popupUiSchema>
export type LabelAnchor = In<typeof layers.labelAnchorSchema>
export type LabelConfig = In<typeof layers.labelConfigSchema>
export type LayerFilterConfig = In<typeof layers.layerFilterConfigSchema>
export type LayerGeometryType = In<typeof layers.layerGeometryTypeSchema>
export type LayerListActionsConfig = In<typeof layers.layerListActionsSchema>

export type GeoJsonLayer = In<typeof layers.geoJsonLayerSchema>
export type PMTilesVectorLayer = In<typeof layers.pmTilesVectorLayerSchema>
export type PMTilesRasterLayer = In<typeof layers.pmTilesRasterLayerSchema>
export type PMTilesLayer = In<typeof layers.pmTilesLayerSchema>
export type TilesVectorLayer = In<typeof layers.tilesVectorLayerSchema>
export type TilesRasterLayer = In<typeof layers.tilesRasterLayerSchema>
export type TilesLayer = In<typeof layers.tilesLayerSchema>
export type PMTilesSourceLayer = In<typeof layers.pmTilesSourceLayerSchema>
export type FlatGeobufLayer = In<typeof layers.flatGeobufLayerSchema>
export type EsriFeatureLayer = In<typeof layers.esriFeatureLayerSchema>
export type EsriDynamicLayer = In<typeof layers.esriDynamicLayerSchema>
export type EsriTiledLayer = In<typeof layers.esriTiledLayerSchema>
export type EsriLayer = In<typeof layers.esriLayerSchema>
export type GeoParquetLayer = In<typeof layers.geoParquetLayerSchema>
export type LayerConfig = In<typeof layers.layerConfigSchema>

export type {
  WidgetSurface,
  WidgetDefaults,
  WidgetManifest,
  WidgetPlacement,
  FloatingOpens,
  ResolvedWidgetConfig,
  ThemeColorToken,
  WidgetHeaderConfig,
  ResolvedWidgetHeaderConfig,
} from './widget-types'

export type ExportFormat = In<typeof ui.exportFormatSchema>
export type FloatingControlsUiConfig = In<typeof ui.floatingControlsUiSchema>
export type TopBarUiConfig = In<typeof ui.topBarUiSchema>
export type TopBarShadowConfig = In<typeof ui.topBarShadowSchema>
export type ShellSide = In<typeof ui.shellSideSchema>
export type LayoutUiConfig = In<typeof ui.layoutUiSchema>
export type MobileUiConfig = In<typeof ui.mobileUiSchema>
export type InfoUiConfig = In<typeof ui.infoUiSchema>
export type LoaderUiConfig = In<typeof ui.loaderUiSchema>
export type LayerDefaultsUiConfig = In<typeof ui.layerDefaultsUiSchema>
export type LabelDefaults = In<typeof ui.labelDefaultsSchema>
export type UiConfig = In<typeof ui.uiConfigSchema>

export type LayerGroupConfig = In<typeof settings.layerGroupSchema>
export type FloatingSlot = In<typeof widgets.floatingSlotSchema>
export type FloatingSlotConfig = In<typeof widgets.floatingSlotConfigSchema>

export type MapControlsConfig = In<typeof settings.mapControlsSchema>
export type NavigationControlConfig = NonNullable<MapControlsConfig['navigation']>
export type GeolocateControlConfig = NonNullable<MapControlsConfig['geolocate']>
export type FullscreenControlConfig = NonNullable<MapControlsConfig['fullscreen']>
export type ScaleControlConfig = NonNullable<MapControlsConfig['scale']>
export type GlobeControlConfig = NonNullable<MapControlsConfig['globe']>
export type ZoomLevelControlConfig = NonNullable<MapControlsConfig['zoomLevel']>
export type TerrainControlConfig = NonNullable<MapControlsConfig['terrain']>
export type DemSourceConfig = In<typeof settings.demSourceSchema>
export type HillshadeConfig = In<typeof settings.hillshadeSchema>
export type ContoursConfig = In<typeof settings.contoursSchema>

export type ContextMenuCustomItem = In<typeof settings.contextMenuCustomItemSchema>
export type ContextMenuConfig = In<typeof settings.contextMenuSchema>

export type GeocoderProvider = In<typeof widgets.geocoderProviderSchema>
export type GeocoderConfig = In<typeof widgets.geocoderConfigSchema>
export type SearchableLayerConfig = In<typeof widgets.searchableLayerSchema>

export type DuckDBConfig = In<typeof settings.duckdbConfigSchema>
/** Everything the engine reads as `settings`, from `settings.json`, `theme.json`, `basemaps.json` and `layers.json`. */
export type Settings = In<typeof settings.settingsSchema>

// `fields: null` renders every property
export interface ResolvedPopupConfig {
  trigger: PopupTrigger
  position: PopupPosition
  displayType: string
  title?: string
  fields: Record<string, string> | null
  // {layerName}, {group} or {column} template, undefined is the layer name
  header?: string
  group?: string
  zoomToFeature: boolean
  copyCoordinates: boolean
  viewInGoogleMaps: boolean
  highlight: boolean
}

// PMTiles publishes one per drawn source layer (popupLayerOverrides)
export interface PopupLayer {
  id: string
  name: string
  group?: string
  popup?: PopupConfig
}

/**
 * A popup template component, registered in the project's `popups.tsx`.
 * @see https://conness-gis.com/configuration/popups/#templates-apppopupstsx
 */
export type PopupTemplate = ComponentType<{
  /** The clicked feature. */
  feature: GeoJSON.Feature
  /** The layer's `popup.fields`, or `null` to show every property. */
  fields: Record<string, string> | null
  /** Value of the `popup.title` property, if set. */
  title?: string
  layerId: string
  layerName: string
}>

export type PopupTemplates = Record<string, PopupTemplate>

export interface SelectedPopupFeature {
  layerId: string
  // the map layer it was picked from, its source draws the highlight
  sublayerId: string
  layerName: string
  feature: GeoJSON.Feature
  resolved: ResolvedPopupConfig
}

export interface LayerMetadata {
  id: string
  name: string
  group?: string
  visible: boolean
  opacity: number
  // absent for rasters and esri layers using the service's renderer
  symbology?: Symbology
  // undefined draws a neutral square swatch
  geometryType?: LayerGeometryType
  hideFromLegend?: boolean
  // wins over the symbology's legend
  legend?: LegendOverride
  // outside this range the layer list grays the name
  minZoom?: number
  maxZoom?: number
  // the configured range while the Layer List's Zoom Range changes it
  configuredZoom?: { min?: number; max?: number; labelMin?: number }
  hasLabel?: boolean
  // label IS the geometry (draw text), so it shows/hides with the layer
  labelIsGeometry?: boolean
  // merged over the Layer List's `widgets["layer-list"].actions`
  actions?: LayerListActionsConfig
  // in the store so it survives basemap switches
  labelsVisible?: boolean
  // server-rendered, so no features, popups or legend (unless `legend`)
  raster?: boolean
  filters?: LayerFilterConfig[]
  // PMTiles parents hold no sublayers, their children do, in draw order
  isParent?: boolean
  childIds?: string[]
  parentId?: string
}

// a disabled toggle pauses its filter without clearing selections

export type NumericFilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'between'

export type FilterValue = string | number | boolean

export type ColumnFilterState =
  | { kind: 'categorical'; enabled: boolean; selected: FilterValue[] }
  // raw input strings, so invalid text survives until corrected
  | { kind: 'numeric'; enabled: boolean; op: NumericFilterOp; value: string; value2: string }

export interface LayerFilterState {
  enabled: boolean
  columns: Record<string, ColumnFilterState>
}

export interface LayerFilterHandler {
  apply: (state: LayerFilterState | undefined) => void
  // sorted, nulls dropped
  getValues: (column: string) => Promise<FilterValue[]>
}
