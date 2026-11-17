import { z } from 'zod'
import { basemapsSchema, mapStyleSchema } from './basemaps.ts'
import { layersSchema } from './layers.ts'
import { symbologyRegistrySchema } from './symbology.ts'
import { themeSettingsSchema } from './theme.ts'
import { uiConfigSchema } from './ui.ts'
import { floatingSlotConfigSchema, widgetPlacementSchema } from './widgets.ts'

const CAMERA_DOCS = 'https://conness-gis.com/configuration/map-camera/'
const CONTROLS_DOCS = 'https://conness-gis.com/configuration/map-controls/'

const lngLat = z.tuple([z.number(), z.number()])

export const brandingSchema = z
  .strictObject({
    title: z.string().meta({ description: 'App name, shown in the top bar.' }),
    description: z.string().optional().meta({
      description: "One or two sentences about the app. Search engines and link previews show it, and it goes in the build's `llms.txt`.",
    }),
    logo: z.string().optional().meta({
      description: "Logo path, e.g. `\"/logo.svg\"` for a file in the project's `public/`. Size it with `ui.topBar.logoSize`.",
    }),
    favicon: z.string().optional().meta({
      description: "Browser tab icon path, e.g. `\"/favicon.png\"` for a file in the project's `public/`.",
      default: '/favicon.svg',
    }),
    appId: z.string().optional().meta({
      description:
        'Prefix for every localStorage key the app writes (bookmarks, drawings, measure prefs). Give each app its own when several share one domain.',
      defaultText: 'slug of `title`',
    }),
  })
  .meta({ description: 'Title, logo, page description and storage id.', see: 'https://conness-gis.com/configuration/branding/' })

export const globeSpinSchema = z
  .strictObject({
    direction: z
      .enum(['east', 'west'])
      .optional()
      .meta({ description: '`"east"` matches Earth\'s real rotation.', default: 'east' }),
    speed: z.number().optional().meta({ description: 'Degrees of longitude per second.', default: 6 }),
    continuous: z.boolean().optional().meta({
      description:
        '`false` stops the spin for good on the first interaction. `true` pauses while the user drags or zooms, then resumes.',
      default: false,
    }),
  })
  .meta({
    description: 'Auto-spin on load. Turns the globe by moving the center, so north stays up. Omit for no spin.',
    see: `${CAMERA_DOCS}#globe-projection`,
  })

export const globeSchema = z
  .strictObject({
    enabled: z
      .boolean()
      .optional()
      .meta({ description: 'Start on the globe. The globe control can still toggle it.', default: false }),
    stars: z.boolean().optional().meta({ description: 'Starfield behind the globe.', default: false }),
    comets: z.boolean().optional().meta({ description: 'Shooting stars. Needs `stars`.', default: false }),
    atmosphere: z
      .boolean()
      .optional()
      .meta({ description: "Glow around the globe's edge. On unless set to `false`.", default: true }),
    starsZoomCutoff: z.number().optional().meta({ description: 'Zoom above which stars and comets hide.', default: 7.3 }),
    spin: globeSpinSchema.optional(),
  })
  .meta({
    description: 'Globe projection, stars and spin. Omit for a flat map.',
    see: `${CAMERA_DOCS}#globe-projection`,
  })

export const mapInitialViewSchema = z
  .strictObject({
    style: mapStyleSchema.meta({ description: 'The starting basemap: a style URL or inline style object.' }),
    center: lngLat.meta({ description: '`[lng, lat]`.' }),
    zoom: z.number().meta({ description: 'Starting zoom.' }),
    bearing: z.number().optional().meta({ description: 'Rotation in degrees.', default: 0 }),
    pitch: z.number().optional().meta({ description: 'Tilt in degrees. 0 looks straight down.', default: 0 }),
    backgroundColor: z
      .string()
      .optional()
      .meta({ description: "Fill behind the map: past the globe's edge and before tiles load.", default: '#000000' }),
    minZoom: z
      .number()
      .optional()
      .meta({ description: "How far out the camera can zoom. Not a layer's `minZoom`.", default: 1.5 }),
    maxZoom: z.number().optional().meta({ description: 'How far in the camera can zoom.', default: 16 }),
    maxBounds: z.tuple([lngLat, lngLat]).optional().meta({
      description:
        'Keep panning inside `[[west, south], [east, north]]`. For a world box, use ±179.9999 longitude. An exact ±180 crashes MapLibre.',
    }),
    globe: globeSchema.optional(),
    onlyVisibleOnLoad: z.boolean().optional().meta({
      description:
        "Load only the layers visible at startup. Hidden GeoJSON, GeoParquet and FlatGeobuf layers load the first time they're turned on (a spinner shows in the layer list meanwhile), so startup is faster. Tiled and Esri layers already load only what's in view.",
      default: false,
    }),
    scrollZoom: z.boolean().optional().meta({
      description: 'Zoom with the mouse wheel or trackpad scroll. Pinch zoom on touch screens isn\'t affected.',
      default: true,
      see: `${CAMERA_DOCS}#scroll-zoom`,
    }),
  })
  .meta({ description: 'Initial view and camera limits.', see: CAMERA_DOCS })

export const controlPositionSchema = z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])

const position = (def: string) => controlPositionSchema.optional().meta({ description: 'Map corner.', default: def })
// with floating widgets' `order` on one scale: lower stacks first, 0 keeps the order controls are added in
const order = z
  .number()
  .optional()
  .meta({ description: 'Place in its corner, shared with floating widgets: lower comes first.', default: 0 })

export const demSourceSchema = z
  .strictObject({
    tiles: z.string().array().optional().meta({
      description:
        'Raster-DEM tile URL template (a list, for mirrors of the same tiles). Or use `url`, not both. The default is Mapterhorn, credited as © Mapterhorn.',
      // keep in sync with DEFAULT_DEM_SOURCE in core/map/terrain.ts
      default: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    }),
    url: z.string().optional().meta({
      description: 'A TileJSON URL, instead of `tiles`. Its tile size and zoom range come from the TileJSON.',
      defaultText: 'none, `tiles` is used',
    }),
    encoding: z.enum(['terrarium', 'mapbox', 'custom']).optional().meta({
      description:
        'How elevation is packed into the tile colors: `terrarium` (Mapterhorn, Mapzen), `mapbox` (Mapbox Terrain-RGB), or `custom`.',
      default: 'terrarium',
    }),
    tileSize: z
      .number()
      .optional()
      .meta({ description: "Tile size in px. Mapterhorn's are 512. Your own tiles use MapLibre's default (512) unless set.", default: 512 }),
    maxzoom: z
      .number()
      .optional()
      .meta({ description: "Highest zoom with real tiles. MapLibre stretches past it. Mapterhorn's go to 17.", default: 17 }),
  })
  .meta({ description: 'Elevation tiles (raster DEM). The default is Mapterhorn, free and open, credited in the map.' })

// widgets.basemap.hillshade. defaults follow Mapterhorn's hillshade example
export const hillshadeSchema = z
  .strictObject({
    enabled: z.boolean().optional().meta({
      description: 'Turn the hillshade on when the app loads, even without the Basemap widget.',
      default: false,
      label: 'On at load',
    }),
    showToggle: z.boolean().optional().meta({
      description: "Show the Hillshade switch in the Basemap widget, so users can turn it on and off.",
      default: true,
      label: 'Toggle in widget',
    }),
    opacity: z.number().min(0).max(1).optional().meta({
      description: "How strong the hillshade is, 0 to 1. MapLibre's hillshade has no opacity, so this scales its colors' alpha.",
      default: 0.5,
      label: 'Opacity',
    }),
    exaggeration: z.number().min(0).max(1).optional().meta({
      description: 'How much the hillshade exaggerates the terrain, 0 to 1.',
      default: 0.5,
      label: 'Shading strength',
    }),
    method: z
      .enum(['standard', 'basic', 'combined', 'igor', 'multidirectional'])
      .optional()
      .meta({ description: "MapLibre's hillshade method. `igor` keeps flat areas clear.", default: 'standard', label: 'Shading method' }),
    highlightColor: z.string().optional().meta({ description: 'Hillshade color on slopes facing the light.', default: 'rgb(255, 255, 228)', advanced: true }),
    shadowColor: z.string().optional().meta({ description: 'Hillshade color on slopes facing away.', default: 'rgb(114, 124, 131)', advanced: true }),
    accentColor: z.string().optional().meta({ description: 'Hillshade color on the steepest slopes (`standard` method).', default: '#000000', advanced: true }),
    source: demSourceSchema.optional().meta({
      description: 'Elevation tiles the hillshade is drawn from. The default is Mapterhorn.',
      advanced: true,
      label: 'Elevation source',
      editor: 'dem-source',
    }),
  })
  .meta({ description: 'Shaded relief over the basemap, under your data.', see: 'https://conness-gis.com/widgets/basemap/#hillshade' })

// widgets.basemap.contours. defaults follow Mapterhorn's contour example
export const contoursSchema = z
  .strictObject({
    enabled: z.boolean().optional().meta({
      description: 'Turn the contour lines on when the app loads, even without the Basemap widget.',
      default: false,
      label: 'On at load',
    }),
    showToggle: z.boolean().optional().meta({
      description: 'Show the Contours switch in the Basemap widget, so users can turn them on and off.',
      default: true,
      label: 'Toggle in widget',
    }),
    unit: z.enum(['meters', 'feet']).optional().meta({ description: 'Contour intervals and labels in meters or feet.', default: 'meters' }),
    minZoom: z.number().min(0).max(24).optional().meta({ description: 'Zoom the contour lines appear from.', default: 10, label: 'Lines from zoom' }),
    labels: z.boolean().optional().meta({ description: 'Label the contour lines with their elevation.', default: true }),
    labelMinZoom: z.number().min(0).max(24).optional().meta({
      description: 'Zoom the contour labels appear from.',
      defaultText: 'the lines\' zoom (`minZoom`)',
      label: 'Labels from zoom',
      dependsOn: { path: 'contours.labels' },
    }),
    labelMaxZoom: z.number().min(0).max(24).optional().meta({
      description: 'Zoom the contour labels hide past.',
      defaultText: 'no limit',
      label: 'Labels up to zoom',
      dependsOn: { path: 'contours.labels' },
    }),
    labelSize: z.number().optional().meta({
      description: 'Contour label size in px.',
      defaultText: 'Label defaults font size (`ui.layerDefaults.label.fontSize`), else 12',
      label: 'Label size',
      dependsOn: { path: 'contours.labels' },
    }),
    lineColor: z.string().optional().meta({ description: 'Contour line color.', default: 'rgb(215, 151, 60)' }),
    labelColor: z.string().optional().meta({ description: 'Contour label color, on a white halo.', default: 'rgb(172, 120, 48)' }),
    width: z.number().optional().meta({ description: 'Width of the major (thicker) lines in px. Minor lines are half as wide.', default: 1 }),
    thresholds: z
      .record(z.string(), z.tuple([z.number(), z.number()]))
      .optional()
      .meta({
        description:
          'Line intervals by zoom, in the chosen unit: `{ "12": [100, 500] }` draws a line every 100 and a major line every 500 from zoom 12 up. The editor shows it read-only, so change it in settings.json under `widgets.basemap.contours.thresholds`.',
        defaultText: 'meters `{ 10: [200, 1000], 12: [100, 500], 14: [20, 100] }`, feet `{ 10: [500, 2500], 12: [250, 1000], 14: [50, 250] }`',
        advanced: true,
      }),
    source: demSourceSchema.optional().meta({
      description: 'Elevation tiles the contours are drawn from, as a tile URL template (a TileJSON `url` is not supported here). The default is Mapterhorn.',
      advanced: true,
      label: 'Elevation source',
      editor: 'dem-source',
    }),
  })
  .meta({ description: 'Contour lines over the hillshade, under your data.', see: 'https://conness-gis.com/widgets/basemap/#contours' })

export const mapControlsSchema = z
  .strictObject({
    navigation: z
      .strictObject({
        position: position('top-left'),
        order,
        showZoom: z.boolean().optional().meta({ default: true }),
        showCompass: z.boolean().optional().meta({ default: true }),
        visualizePitch: z.boolean().optional().meta({
          description: 'The compass tilts with pitch, and a click flattens the view as well as turning it north.',
          default: true,
        }),
      })
      .optional()
      .meta({ description: 'Zoom buttons and compass.', see: `${CONTROLS_DOCS}#navigation` }),
    geolocate: z
      .strictObject({
        position: position('top-left'),
        order,
        trackUserLocation: z
          .boolean()
          .optional()
          .meta({ description: 'Keep following the user as they move.', default: false }),
        showUserLocation: z.boolean().optional().meta({ description: 'Location dot.', default: true }),
        showUserHeading: z.boolean().optional().meta({ description: 'Heading cone.', default: false }),
        showAccuracyCircle: z.boolean().optional().meta({ description: 'Accuracy halo.', default: true }),
      })
      .optional()
      .meta({ description: '"Locate me" button.', see: `${CONTROLS_DOCS}#geolocate` }),
    fullscreen: z
      .strictObject({ position: position('top-right'), order })
      .optional()
      .meta({ description: 'Fullscreen toggle.' }),
    scale: z
      .strictObject({
        position: position('bottom-left'),
        order,
        style: z.enum(['classic', 'minimal', 'alternating', 'pill']).optional().meta({
          description:
            'Look of the bar. `classic`: MapLibre\'s bordered box. `minimal`: a thin line with end ticks. `alternating`: a segmented cartographic bar labelled 0, half and full. `pill`: a rounded chip like the map buttons.',
          default: 'classic',
        }),
        unit: z
          .enum(['metric', 'imperial', 'nautical', 'both'])
          .optional()
          .meta({ description: '`both`: metric above imperial.', default: 'metric' }),
        maxWidth: z.number().optional().meta({ description: 'Max bar width in px.', default: 100 }),
      })
      .optional()
      .meta({ description: 'Distance scale bar.', see: `${CONTROLS_DOCS}#scale` }),
    globe: z
      .strictObject({ position: position('top-right'), order })
      .optional()
      .meta({ description: 'Globe/flat toggle.' }),
    spin: z
      .strictObject({ position: position('top-right'), order })
      .optional()
      .meta({ description: "Pause / play button for the globe's spin. Shown while `map.globe.spin` is set." }),
    terrain: z
      .strictObject({
        position: position('top-right'),
        order,
        exaggeration: z.number().optional().meta({ description: 'Elevation multiplier.', default: 1 }),
        enabled: z
          .boolean()
          .optional()
          .meta({ description: 'Start with terrain on. The button can still toggle it.', default: false }),
        source: demSourceSchema.optional(),
      })
      .optional()
      .meta({ description: '3D terrain toggle.', see: `${CONTROLS_DOCS}#terrain` }),
    zoomLevel: z
      .strictObject({
        position: position('bottom-left'),
        order,
        precision: z.number().optional().meta({ description: 'Decimal places shown.', default: 1 }),
      })
      .optional()
      .meta({
        description: 'Current zoom level, e.g. `z 12.4`, for picking layer zoom ranges.',
        see: `${CONTROLS_DOCS}#zoom-level`,
      }),
    attribution: z
      .strictObject({
        position: position('bottom-right'),
        order: order.meta({
          description: 'Place in its corner, shared with floating widgets: lower comes first.',
          default: 1000,
        }),
      })
      .optional()
      .meta({
        description:
          "The map's credits button. Always shown, since the data and tile licenses require it. This only moves it.",
        see: `${CONTROLS_DOCS}#attribution`,
      }),
  })
  .meta({ description: "MapLibre's built-in controls. Include a key to add that control.", see: CONTROLS_DOCS })

export const contextMenuCustomItemSchema = z
  .strictObject({
    label: z.string(),
    url: z.string().meta({
      description:
        'URL with `{lat}`, `{lng}` and `{zoom}` placeholders, e.g. `"https://www.bing.com/maps?cp={lat}~{lng}&lvl={zoom}"`.',
    }),
  })
  .meta({ description: 'Custom right-click item. Opens `url` in a new tab.' })

export const contextMenuSchema = z
  .strictObject({
    enabled: z.boolean().optional().meta({
      description: "Turn off for the browser's own menu, keeping the items below for later.",
      default: true,
    }),
    centerHere: z.boolean().optional().meta({ description: 'Fly the map to the clicked point.' }),
    googleMaps: z.boolean().optional(),
    googleStreetView: z.boolean().optional(),
    osm: z.boolean().optional().meta({ description: 'OpenStreetMap.' }),
    appleMaps: z.boolean().optional(),
    copernicus: z.boolean().optional().meta({ description: 'Copernicus Browser (satellite imagery).' }),
    custom: contextMenuCustomItemSchema.array().optional().meta({ description: 'Your own items, added last.' }),
  })
  .meta({
    description:
      "Desktop right-click menu. Set an item to `true` to include it. Omit the block, or set `enabled` to `false`, for the browser's own menu.",
    see: 'https://conness-gis.com/configuration/ui-layout/#right-click-context-menu-contextmenu',
  })

export const duckdbConfigSchema = z
  .strictObject({
    bundleUrl: z.string().optional().meta({
      description:
        'Folder holding `duckdb-base.wasm` and `duckdb-browser-base.worker.js`, from the same `@duckdb/duckdb-wasm` version the app installs.',
      defaultText: 'jsDelivr',
    }),
    extensionsUrl: z.string().optional().meta({
      description: 'Extension repository for `parquet`, `httpfs` and `spatial`.',
      defaultText: "DuckDB's own (extensions.duckdb.org)",
    }),
  })
  .meta({
    description:
      'DuckDB download locations. Used by GeoParquet layers and GeoJSON layers with `duckdb`. Point these at your own copies for offline or intranet deploys. Only used when a layer needs DuckDB.',
    see: 'https://conness-gis.com/configuration/adding-layers/#duckdb',
  })

export const layerGroupSchema = z
  .strictObject({
    collapsed: z
      .boolean()
      .optional()
      .meta({ description: 'Start collapsed.', defaultText: 'widgets["layer-list"].groupsCollapsedByDefault' }),
    position: z.number().int().min(0).optional().meta({
      description: "Spot in the layer list's top level while the group has no layers. The editor keeps it up to date.",
    }),
  })
  .meta({ description: 'Per-group layer list settings.' })

// settings.json; layers, basemaps and theme come from their own files
export const settingsFileSchema = z
  .strictObject({
    connessVersion: z.string().optional().meta({
      description:
        'The Conness GIS release this project was made with, set when it was created. Conness upgrades older projects from it, so leave it as it is.',
      defaultText: 'older than 1.0.0',
    }),
    branding: brandingSchema,
    ui: uiConfigSchema.optional(),
    map: mapInitialViewSchema,
    commercialUse: z.boolean().optional().meta({
      description: "Set `true` for a commercial deployment. Drops services that don't allow commercial use.",
      default: false,
      see: 'https://conness-gis.com/configuration/commercial-use/',
    }),
    mapControls: mapControlsSchema.optional(),
    contextMenu: contextMenuSchema.optional(),
    // each widget's own settings, by id; their schemas live in widgets/<id>/settings.ts and are
    // added where the project is checked (projectFiles below). loose here, for the engine's types
    widgets: z.record(z.string(), z.unknown()).optional().meta({
      description: "Each widget's own settings, keyed by widget id: `\"measure\": { … }`.",
    }),
    duckdb: duckdbConfigSchema.optional(),
    layerGroups: z
      .record(z.string(), layerGroupSchema)
      .optional()
      .meta({ description: 'Per-group settings, keyed by group name.' }),
    topBarWidgets: widgetPlacementSchema.array().meta({ description: 'Widgets in the top bar.' }),
    sidePanelWidgets: widgetPlacementSchema.array().meta({ description: 'Widgets in the side rail.' }),
    floatingWidgets: floatingSlotConfigSchema.array().meta({ description: 'Widgets floating in map corners.' }),
    mobileWidgets: z.string().array().optional().meta({
      description:
        "Widgets in the mobile carousel, in order. On mobile it's the only way to open top-bar and side-panel widgets. Floating widgets keep their map-corner buttons.",
    }),
  })
  .meta({
    description: "The project's settings (`settings.json`). Layers, basemaps and theme live in their own files.",
    see: 'https://conness-gis.com/getting-started/concepts/#the-settings-object',
  })

// what the engine reads as `settings`: settings.json plus the files it pulls in
export const settingsSchema = settingsFileSchema.extend({
  theme: themeSettingsSchema.optional(),
  basemaps: basemapsSchema,
  layers: layersSchema,
})

// a widget's settings schema, from its widgets/<id>/settings.ts
export type WidgetSchemas = Record<string, z.ZodType>

// settings.json with every widget's own schema under `widgets`: what a project is checked against
// (and what the JSON-schema hover shows). the widget schemas come from scripts/widget-settings.ts in
// Node and editor/widgetSchemas.ts in the editor
export function withWidgets(schemas: WidgetSchemas) {
  const widgets = z
    .strictObject(Object.fromEntries(Object.entries(schemas).map(([id, schema]) => [id, schema.optional()])))
    .optional()
    .meta({ description: "Each widget's own settings, keyed by widget id: `\"measure\": { … }`." })
  return settingsFileSchema.extend({ widgets })
}

// PROJECT_FILES with settings.json checked against the widgets' own schemas
export function projectFiles(schemas: WidgetSchemas) {
  return { ...PROJECT_FILES, settings: withWidgets(schemas) }
}

// one schema per project JSON file; lists are wrapped so every file can hold `$schema`
export const PROJECT_FILES = {
  settings: settingsFileSchema,
  layers: z.strictObject({ layers: layersSchema }),
  basemaps: z.strictObject({ basemaps: basemapsSchema }),
  theme: themeSettingsSchema,
  symbology: symbologyRegistrySchema,
} as const

export type ProjectFile = keyof typeof PROJECT_FILES
