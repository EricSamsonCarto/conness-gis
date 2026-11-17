import { z } from 'zod'
import type { ExpressionSpecification } from 'maplibre-gl'
import { legendOverrideSchema, symbologySchema } from './symbology.ts'

const LAYERS_DOCS = 'https://conness-gis.com/configuration/adding-layers/'

export const popupTriggerSchema = z.enum(['click', 'hover'])
// a map corner, or next to the spot that was clicked or hovered
export const popupPositionSchema = z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'feature'])

export const popupConfigSchema = z
  .union([
    z.literal(false),
    z.strictObject({
      enabled: z
        .boolean()
        .optional()
        .meta({ description: '`false` turns the popup off but keeps the config.', default: true }),
      trigger: popupTriggerSchema.optional().meta({ description: 'Click or hover.', defaultText: 'ui.popups.trigger' }),
      position: popupPositionSchema.optional().meta({
        description: 'Where the popup opens: a map corner, or `"feature"` next to the clicked spot.',
        defaultText: 'ui.popups.position',
      }),
      title: z
        .string()
        .optional()
        .meta({ description: "Column whose value is the popup's title, at the top of its content under the header bar (in templates that show one, as the standard ones do)." }),
      header: z.string().optional().meta({
        description:
          "Header bar text: your own words with columns mixed in, each column name in braces, e.g. `\"{city} Airport\"`, plus `{layerName}` and `{group}` for the layer's name and group. Without it, the header is the layer's name.",
        defaultText: 'the layer name',
      }),
      fields: z.record(z.string(), z.string()).optional().meta({
        description: '`{ "column": "Label" }`, shown in this order. Omit to show every property with raw column names.',
      }),
      displayType: z
        .string()
        .optional()
        .meta({ description: "Template name from the project's `popups.tsx`.", defaultText: 'ui.popups.displayType' }),
      zoomToFeature: z
        .boolean()
        .optional()
        .meta({ description: 'Zoom-to-feature button.', defaultText: 'ui.popups.zoomToFeature' }),
      highlight: z
        .boolean()
        .optional()
        .meta({ description: 'Outline the feature while its popup is open.', defaultText: 'ui.popups.highlight' }),
      copyCoordinates: z
        .boolean()
        .optional()
        .meta({ description: 'Copy-coordinates button.', defaultText: 'ui.popups.copyCoordinates' }),
      viewInGoogleMaps: z
        .boolean()
        .optional()
        .meta({ description: 'View-in-Google-Maps button.', defaultText: 'ui.popups.viewInGoogleMaps' }),
    }),
  ])
  .meta({
    id: 'popup',
    description: 'Feature popups for this layer. Omit or set `false` for none. `{}` uses the `ui.popups` defaults.',
    see: 'https://conness-gis.com/configuration/popups/#per-layer-layerpopup',
  })

export const labelAnchorSchema = z
  .enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'])
  .meta({ description: 'Label position relative to its feature.' })

export const labelConfigSchema = z
  .strictObject({
    field: z.string().optional().meta({ description: 'Column to label by.' }),
    text: z.string().optional().meta({
      description:
        'Custom Label: your own words with columns mixed in, each column name in braces, e.g. `"{faa_id}: {name}, departures = {departures}"`. A feature without one of the columns shows nothing in its place. Used instead of `field`.',
    }),
    expression: z
      .custom<ExpressionSpecification>((v) => Array.isArray(v))
      .optional()
      .meta({
        description:
          'MapLibre expression for the text. Wins over `field`. E.g. `["concat", ["get", "name"], " (", ["get", "code"], ")"]`.',
      }),
    fontSize: z.number().optional().meta({ description: 'Text size in px.', default: 12 }),
    bold: z.boolean().optional().meta({ description: 'Bold text (Noto Sans Bold instead of Regular).', default: false }),
    color: z.string().optional().meta({ description: 'Text color.', default: '#333333' }),
    haloColor: z.string().optional().meta({ description: 'Outline color for legibility.', default: '#ffffff' }),
    haloWidth: z.number().optional().meta({ description: 'Outline width in px. 0 = none.', default: 1 }),
    minZoom: z
      .number()
      .optional()
      .meta({ description: 'Zoom at which labels appear, so geometry can show first.', defaultText: "the layer's minZoom" }),
    anchor: labelAnchorSchema.optional().meta({ default: 'center' }),
    offset: z.number().min(0).optional().meta({ description: "How far a label at a corner sits from its feature, in px, across and up or down. Unset, it's as far as the text is tall. Has no effect when the label is centered." }),
    allowOverlap: z.boolean().optional().meta({ description: 'Draw every label, even where they collide.', default: false }),
    spacing: z.number().min(1).optional().meta({ description: 'Line layers only: px between repeats of the label along a line.', default: 500 }),
  })
  .meta({
    id: 'label',
    description:
      'Text labels for this layer, in Noto Sans (served by the basemap\'s glyphs URL, as OpenFreeMap styles do).',
    see: `${LAYERS_DOCS}#labels`,
  })

export const layerListActionsSchema = z
  .strictObject({
    // `label`: the editor's row name (a widget's settings.ts and the layer screens use these)
    opacity: z
      .boolean()
      .optional()
      .meta({ description: "Turns Adjust Transparency on or off in the layer's menu in the Layer List.", default: true, label: 'Transparency action' }),
    labels: z
      .boolean()
      .optional()
      .meta({ description: "Turns the Labels on/off item on or off in the layer's menu in the Layer List. Only on layers with a `label`.", default: true, label: 'Labels action' }),
    zoomToExtent: z
      .boolean()
      .optional()
      .meta({ description: "Turns Zoom to Extent on or off in the layer's menu in the Layer List.", default: true, label: 'Zoom to extent action' }),
    filter: z
      .boolean()
      .optional()
      .meta({ description: "Turns Filter on or off in the layer's menu in the Layer List. Only on layers with `filters`.", default: true, label: 'Filter action' }),
    export: z.boolean().optional().meta({
      description:
        "Turns Export Data on or off in the layer's menu in the Layer List (formats set by `exportFormats`). Only on GeoJSON and GeoParquet layers.",
      default: true,
      label: 'Export action',
    }),
    visibilityZoom: z.boolean().optional().meta({
      description:
        "Turns Zoom Range on or off in the layer's menu in the Layer List: a slider that changes the zooms the layer shows at until the page reloads. Only on layers with a `minZoom` or `maxZoom`.",
      default: false,
      label: 'Zoom range action',
    }),
  })
  .meta({ id: 'layerListActions', description: "Which items each layer row's menu offers.", see: 'https://conness-gis.com/widgets/layer-list/' })

export const layerGeometryTypeSchema = z.enum(['point', 'line', 'polygon'])

export const layerFilterConfigSchema = z
  .strictObject({
    column: z.string().meta({ description: 'Feature property to filter on.' }),
    kind: z
      .enum(['categorical', 'numeric'])
      .meta({ description: '`"categorical"`: a checklist of values. `"numeric"`: one typed condition.' }),
    label: z.string().optional().meta({ description: 'Name in the filter panel.', defaultText: 'column' }),
  })
  .meta({ id: 'filters', description: 'A column users can filter by in the layer list.', see: `${LAYERS_DOCS}#filtering` })

const filtersField = layerFilterConfigSchema.array().optional().meta({ description: 'Columns users can filter by.' })

const layerBase = z.strictObject({
  id: z.string().meta({ description: 'Unique id.' }),
  name: z.string().meta({ description: 'Name in the layer list and legend.' }),
  group: z.string().optional().meta({ description: 'Groups layers under one header in the layer list.' }),
  visible: z.boolean().optional().meta({ description: 'Visible on load.', default: true }),
  minZoom: z
    .number()
    .optional()
    .meta({ description: "Zoom at which the layer starts to draw. Not the camera's `map.minZoom`." }),
  maxZoom: z.number().optional().meta({ description: 'Zoom at which the layer stops drawing.' }),
  symbology: symbologySchema,
  label: labelConfigSchema.optional(),
  popup: popupConfigSchema.optional(),
  actions: layerListActionsSchema
    .optional()
    .meta({ description: 'Override which row-menu items this layer shows.', defaultText: 'widgets["layer-list"].actions' }),
  geometryType: layerGeometryTypeSchema.optional().meta({
    description:
      "Sets the legend swatch shape and which sublayers are built. Omit for mixed geometry. PMTiles detects it from the archive's tilestats when omitted.",
  }),
  hideFromLegend: z
    .boolean()
    .optional()
    .meta({ description: 'Keep it on the map and in the layer list, but out of the legend.', default: false }),
  legend: legendOverrideSchema.optional().meta({
    description:
      "How it shows in the legend. Wins over a raw symbology's `legend`, and lets layers with no kit symbology (rasters, service-styled Esri) appear.",
    defaultText: 'derived from the symbology',
  }),
})

export const geoJsonLayerSchema = layerBase
  .extend({
    type: z.literal('geojson'),
    url: z.string().meta({ description: '`"./layers/<file>.geojson"` or a remote URL.' }),
    filters: filtersField,
    duckdb: z
      .union([
        z.boolean(),
        z.strictObject({
          mvt: z
            .boolean()
            .optional()
            .meta({ description: 'Draw as vector tiles cut on demand from an in-memory table.', default: false }),
          maxTileFeatures: z
            .number()
            .optional()
            .meta({ description: 'With `mvt`: most features per tile. The smallest are dropped first.', default: 5000 }),
          maxTileZoom: z
            .number()
            .optional()
            .meta({ description: 'With `mvt`: highest zoom tiles are cut at. MapLibre keeps drawing past it.', default: 14 }),
        }),
      ])
      .optional()
      .meta({
        description:
          "Read the file with DuckDB instead of MapLibre. On its own it isn't faster. Use it to query the layer with SQL, or with `{ \"mvt\": true }` to draw a large file as vector tiles cut on demand (see the GeoParquet `mvt` field). Downloads DuckDB (about 11.5 MB) at startup.",
        default: false,
      }),
  })
  .meta({ description: 'A GeoJSON file.', see: `${LAYERS_DOCS}#geojson` })

export const pmTilesSourceLayerSchema = z
  .strictObject({
    sourceLayer: z.string().meta({ description: "Layer name inside the archive (tippecanoe's `-l`)." }),
    name: z.string().optional().meta({ description: 'Name in the layer list and legend.', defaultText: 'sourceLayer' }),
    symbology: symbologySchema
      .optional()
      .meta({ description: 'How to draw it.', defaultText: 'an automatic color' }),
    geometryType: layerGeometryTypeSchema
      .optional()
      .meta({ description: 'Legend shape and which sublayers are built. Detected from tilestats when omitted.' }),
    legend: legendOverrideSchema.optional().meta({
      description: 'How it shows in the legend. Not inherited from the archive layer.',
      defaultText: 'derived from the symbology',
    }),
    label: labelConfigSchema.optional().meta({ description: 'Text labels.', defaultText: "the archive layer's label" }),
    popup: popupConfigSchema.optional().meta({ description: 'Feature popups.', defaultText: "the archive layer's popup" }),
    visible: z.boolean().optional().meta({ description: 'Visible on load.', defaultText: "the archive layer's visible" }),
    minZoom: z.number().optional().meta({ defaultText: "the archive's own zoom range for this layer" }),
    maxZoom: z.number().optional().meta({ defaultText: "the archive's own zoom range for this layer" }),
  })
  .meta({
    description:
      "One layer inside a tile source. Unset labels and popup fall back to the archive layer's own, and an unset `symbology` draws an automatic color.",
    see: `${LAYERS_DOCS}#pmtiles`,
  })

const vectorTileBase = layerBase.omit({ symbology: true }).extend({
  raster: z.literal(false).optional().meta({ description: 'Vector tiles (the default). Set `true` for image tiles.' }),
  sourceLayers: pmTilesSourceLayerSchema.array().optional().meta({
    description:
      'Which source layers to draw, in draw order (first on top), each with its own style. Omit (or `[]`) to draw every source layer the tiles list, in automatic colors. One entry shows as a normal layer under the layer\'s name. Two or more show as an expandable row in the layer list.',
    defaultText: 'every source layer',
  }),
  collapsed: z
    .boolean()
    .optional()
    .meta({ description: 'Start the expandable row collapsed in the layer list. Only with 2+ source layers.', default: true }),
  encoding: z
    .enum(['mvt', 'mlt'])
    .optional()
    .meta({ description: 'Tile format. `"mlt"` is MapLibre Tiles.', defaultText: '"mvt" (or what a TileJSON says)' }),
})

const rasterTileBase = layerBase.omit({ symbology: true, label: true, popup: true, geometryType: true }).extend({
  raster: z.literal(true).meta({ description: 'Marks the tiles as images.' }),
  rasterOpacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .meta({ description: 'Starting opacity, 0 to 1 (a raster has no symbology to hold it).', default: 1 }),
  tileSize: z
    .union([z.literal(256), z.literal(512)])
    .optional()
    .meta({ description: "Tile size in pixels. It isn't recorded with the tiles. Most use 512, some 256.", default: 512 }),
})

const pmTilesFields = {
  type: z.literal('pmtiles'),
  url: z.string().meta({ description: '`"./layers/<file>.pmtiles"` or a remote URL.' }),
}

export const pmTilesVectorLayerSchema = vectorTileBase
  .extend(pmTilesFields)
  .meta({ description: 'A PMTiles archive of vector tiles.', see: `${LAYERS_DOCS}#pmtiles` })

export const pmTilesRasterLayerSchema = rasterTileBase.extend(pmTilesFields).meta({
  description:
    'A PMTiles archive of image tiles (imagery, scanned maps). Draws below every vector layer. Visibility, transparency and zoom to extent only (no symbology, popups or legend entry).',
  see: `${LAYERS_DOCS}#raster-pmtiles`,
})

export const pmTilesLayerSchema = z
  .discriminatedUnion('raster', [pmTilesVectorLayerSchema, pmTilesRasterLayerSchema])
  .meta({ description: 'A PMTiles archive: vector tiles (default) or image tiles (`"raster": true`).' })

// bare {z}/{x}/{y} templates lack metadata: need sourceLayers + zooms
const tileServerFields = {
  type: z.literal('tiles'),
  url: z
    .string()
    .meta({ description: 'A TileJSON URL, or a template with `{z}`, `{x}` and `{y}`. Used as is (remote only).' }),
  minTileZoom: z
    .number()
    .optional()
    .meta({ description: 'Templates only: lowest zoom the server has tiles for. A TileJSON says this itself.', default: 0 }),
  maxTileZoom: z.number().optional().meta({
    description: 'Templates only: highest zoom the server has tiles for. MapLibre overzooms past it.',
    default: 14,
  }),
  attribution: z
    .string()
    .optional()
    .meta({ description: 'Templates only: attribution text or HTML. A TileJSON says this itself.' }),
}

export const tilesVectorLayerSchema = vectorTileBase.extend(tileServerFields).meta({
  description: 'Vector tiles from a tile server (Martin, pg_tileserv, GeoServer, MapTiler…).',
  see: `${LAYERS_DOCS}#tiles`,
})

export const tilesRasterLayerSchema = rasterTileBase.extend(tileServerFields).meta({
  description: 'Image tiles from a tile server (hillshade, imagery). Draws below every vector layer.',
  see: `${LAYERS_DOCS}#tiles`,
})

export const tilesLayerSchema = z
  .discriminatedUnion('raster', [tilesVectorLayerSchema, tilesRasterLayerSchema])
  .meta({ description: 'A tile server: vector tiles (default) or image tiles (`"raster": true`).' })

export const flatGeobufLayerSchema = layerBase
  .extend({
    type: z.literal('flatgeobuf'),
    url: z.string().meta({ description: '`"./layers/<file>.fgb"` or a remote URL.' }),
    bbox: z.enum(['all', 'dynamic']).optional().meta({
      description:
        "`\"all\"` loads the whole file once. `\"dynamic\"` fetches only what's in view. The host must serve the file uncompressed with Range requests.",
      default: 'all',
    }),
  })
  .meta({ description: 'A FlatGeobuf file.', see: `${LAYERS_DOCS}#flatgeobuf` })

const esriBase = layerBase.omit({ symbology: true }).extend({
  type: z.literal('esri'),
  symbology: symbologySchema
    .optional()
    .meta({ description: "Kit styling. Omit to use the service's own renderer. Ignored by raster services." }),
  esriOpacity: z.number().min(0).max(1).optional().meta({
    description:
      'Starting opacity, 0 to 1, for raster services and service-styled feature layers (no kit symbology to hold it). With kit `symbology`, use its `opacity` / `strokeOpacity` instead.',
    default: 1,
  }),
})

export const esriFeatureLayerSchema = esriBase
  .extend({
    service: z.literal('feature'),
    url: z.string().meta({ description: 'FeatureServer URL with the layer index, e.g. `.../FeatureServer/0`.' }),
    where: z.string().optional().meta({ description: 'ArcGIS where clause.', default: '1=1' }),
    filters: layerFilterConfigSchema
      .array()
      .optional()
      .meta({ description: 'Columns users can filter by. Combined with `where` on the server.' }),
  })
  .meta({ description: 'ArcGIS feature service: styled, with popups and legend.', see: `${LAYERS_DOCS}#esri` })

export const esriDynamicLayerSchema = esriBase
  .extend({
    service: z.literal('dynamic'),
    url: z.string().meta({ description: 'MapServer URL, no layer index.' }),
    layers: z.number().array().optional().meta({ description: 'Sublayer ids to draw, e.g. `[2, 3]`.', defaultText: 'all' }),
  })
  .meta({
    description: 'ArcGIS dynamic map service: a server-rendered image. Visibility and opacity only.',
    see: `${LAYERS_DOCS}#esri`,
  })

export const esriTiledLayerSchema = esriBase
  .extend({
    service: z.literal('tiled'),
    url: z.string().meta({ description: 'Tiled MapServer URL.' }),
  })
  .meta({ description: 'ArcGIS tiled map service: cached raster tiles. Visibility and opacity only.', see: `${LAYERS_DOCS}#esri` })

export const esriLayerSchema = z.discriminatedUnion('service', [
  esriFeatureLayerSchema,
  esriDynamicLayerSchema,
  esriTiledLayerSchema,
])

export const geoParquetLayerSchema = layerBase
  .extend({
    type: z.literal('geoparquet'),
    url: z.string().meta({ description: '`"./layers/<file>.parquet"` or a CORS-enabled URL.' }),
    limit: z.number().optional().meta({
      description: "Stop after this many features. There's no viewport filtering, so use it on big files.",
      defaultText: 'no limit',
    }),
    filters: filtersField,
    mvt: z.boolean().optional().meta({
      description:
        'Draw as vector tiles cut on demand by DuckDB from an in-memory copy, instead of one GeoJSON source. For large files. Starts at zoom 10 unless `minZoom` says otherwise.',
      default: false,
    }),
    maxTileFeatures: z
      .number()
      .optional()
      .meta({ description: 'With `mvt`: most features per tile. The smallest are dropped first.', default: 5000 }),
    maxTileZoom: z.number().optional().meta({
      description:
        "With `mvt`: highest zoom tiles are cut at. MapLibre keeps drawing past it. Raise it for very dense data that's still thinned at 14. Lower it for coarse data.",
      default: 14,
    }),
  })
  .meta({ description: 'A GeoParquet file.', see: `${LAYERS_DOCS}#geoparquet` })

export const layerConfigSchema = z
  .discriminatedUnion('type', [
    geoJsonLayerSchema,
    pmTilesLayerSchema,
    tilesLayerSchema,
    flatGeobufLayerSchema,
    esriLayerSchema,
    geoParquetLayerSchema,
  ])
  .meta({ description: 'One data layer. `type` picks the loader.', see: LAYERS_DOCS })

export const layersSchema = layerConfigSchema
  .array()
  .meta({ description: "The project's data layers (`layers.json`). Array order is draw order: first on top.", see: LAYERS_DOCS })
