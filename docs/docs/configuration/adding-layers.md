---
icon: lucide/layers
---

# Adding Layers

Your data layers live in your project's `layers.json`, in its `layers` list. The app reads it as `settings.layers`. It's a separate file only to keep `settings.json` readable.

!!! tip "In the editor"
    Under **Layers**, open **Layers** and click **Add layer** to upload a file or paste a URL. Each layer's screen edits the fields below, with General, Style, Labels, Popup and Filters screens of its own. The Layers list sets the order and the groups. See [Layers in the editor](../editor/layers.md).

Each entry is an object, and its `type` picks the loader:

```json
{
  "$schema": "../../schema/layers.schema.json",
  "layers": [
    {
      "id": "parks",
      "type": "geojson",
      "name": "National Parks",
      "geometryType": "polygon",
      "url": "./layers/parks.geojson",
      "symbology": { "kind": "simple", "color": "#2c8a3e" }
    }
  ]
}
```

The examples below show one layer each, an entry in that list.

Array order sets both the layer-list order and the draw order: the first layer draws on top. Raster layers (Esri `dynamic` and `tiled`, and `"raster": true` PMTiles and tile servers) are the exception and always draw below every vector layer. A group appears where its `group` name first shows up in the array, so a layer can sit anywhere in the array for draw order and still display inside its group.

## Common fields (every layer type)

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Unique across all layers |
| `name` | `string` | required | Name in the layer list and legend |
| `type` | `"geojson" \| "pmtiles" \| "tiles" \| "flatgeobuf" \| "esri" \| "geoparquet"` | required | Picks the loader |
| `symbology` | object | none | How to draw it, including its opacity (see [Symbology](symbology.md)). Required for most types; optional for Esri. PMTiles and tile servers style each source layer instead |
| `group` | `string` | none | Groups layers under one header in the layer list. Same name, same group |
| `visible` | `boolean` | `true` | Visible at startup |
| `minZoom` / `maxZoom` | `number` | MapLibre defaults | Zooms at which the layer draws. Separate from the camera limits in [Map & Camera](map-camera.md) |
| `geometryType` | `"point" \| "line" \| "polygon"` | none | Sets the legend swatch shape and which geometries draw. Leave it out for mixed geometry. PMTiles detects it when the archive records it |
| `label` | object | none | Text labels (see [Labels](#labels)) |
| `popup` | object or `false` | none (off) | Feature popups (see [Popups](popups.md)) |
| `hideFromLegend` | `boolean` | `false` | Keep the layer on the map and in the layer list, but out of the legend. Works with any symbology |
| `legend` | object | from the symbology | Choose what the legend shows for this layer (see [Custom legend](#custom-legend)). The only way to get a raster or a service-styled Esri layer into the legend |
| `actions` | object: `opacity`, `labels`, `zoomToExtent`, `filter`, `export`, `visibilityZoom` (each `boolean`) | global default | Override which items this layer's row menu shows. `visibilityZoom` (Zoom Range) is off unless turned on here or in the [Layer List](../widgets/layer-list.md#configuration) |
| `filters` | list | none | Columns users can filter by in the layer list (see [Filtering](#filtering)). `geojson`, `geoparquet` and Esri `feature` layers only |

Opacity belongs to the symbology (`opacity` and `strokeOpacity`, see [Symbology](symbology.md)), not the layer. A top-level `opacity` on a layer is an unknown key, reported when the project's files are read. Layers without kit symbology are the exception: Esri's `esriOpacity` and raster tiles' `rasterOpacity` set their starting opacity. The layer list's Adjust Transparency multiplies on top of either.

A layer without `geometryType` is treated as mixed: it draws polygon fills, lines and points, but no polygon outlines. Outlines only draw on layers known to be polygons, and only when the symbology sets a `strokeWidth`.

Features made of several parts (MultiPoint, MultiLineString, MultiPolygon) draw the same as single ones.

## Where files live

- **Local files** go in your project's `layers/`. Reference them as `"./layers/<file>"`; Vite resolves the path at build time. Supported extensions: `.geojson`, `.pmtiles`, `.fgb`, `.parquet` and `.geoparquet`. A build includes only the files `layers.json` points at, so other files in `layers/` (drafts, spare copies) stay out of it.
- **Remote URLs** (`http://` or `https://`) are used as they are. The server must allow cross-origin requests (CORS).

!!! warning "GeoJSON file size"
    A `geojson` layer loads and parses the whole file in memory on the main thread; nothing streams. Roughly: under 5 MB is fine, 5 to 20 MB adds noticeable startup lag, and past about 50 MB it isn't usable. `minZoom` only controls drawing, not parsing. For large data, use PMTiles or FlatGeobuf with `"bbox": "dynamic"`.

## `geojson`

The simplest type. One file becomes fill, line and point sublayers split by geometry, so a single file can mix points, lines and polygons.

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Path to a `.geojson` file (`./layers/…`) or a remote URL |
| `duckdb` | `boolean`, or an object with `mvt`, `maxTileFeatures`, `maxTileZoom` | Read the file with [DuckDB](#duckdb) instead of MapLibre. Default `false` |

```json
{
  "id": "airports",
  "type": "geojson",
  "name": "US Major Airports",
  "geometryType": "point",
  "url": "https://example.com/airports.geojson",
  "symbology": { "kind": "ref", "name": "airports-by-passengers" }
}
```

By default MapLibre reads the file itself. `"duckdb": true` reads it with [DuckDB](#duckdb) instead. That isn't faster, and it downloads DuckDB at startup, so only turn it on when you want DuckDB features: SQL queries (coming with a SQL widget), or `{ "mvt": true }` to draw a large file as [tiles cut on the fly](#tiles-on-the-fly), with the same `maxTileFeatures` and `maxTileZoom` options as GeoParquet. The demo's `world-places` layer (Natural Earth's populated places, about 7,300 points) uses `"duckdb": true`.

With `duckdb`, keep the file in your project's `layers/`. DuckDB's GeoJSON reader can't read a remote `.geojson` in the browser, so a URL fails with "Failed to read GeoJSON data" in the console. Remote GeoParquet works, since DuckDB reads Parquet another way.

## `pmtiles`

[PMTiles](https://protomaps.com/) vector tiles: a single archive file that streams only the tiles in view. The best choice for large datasets. An archive can hold several layers of its own (source layers); tippecanoe names them with `-l`.

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Path to a `.pmtiles` archive, local or remote |
| `sourceLayers` | list | Which source layers to draw, in draw order (first on top), each with its own style. Leave it out (or `[]`) to draw every source layer in the archive, in automatic colors |
| `collapsed` | `boolean` | Whether the expandable layer-list row starts collapsed. Default `true`. Only used with two or more source layers |
| `encoding` | `"mvt" \| "mlt"` | Tile format. Set `"mlt"` for a [MapLibre Tiles](https://maplibre.org/maplibre-tile-spec/) archive. Default `"mvt"` |
| `raster` | `boolean` | `true` for an archive of images; see [Raster PMTiles](#raster-pmtiles) |

How it shows depends on how many source layers it draws:

- **One** (a one-entry `sourceLayers`, or an archive that only has one): a normal layer, named by the layer's `name`. The source layer's own `name` isn't used.
- **Two or more** (listed, or every layer in the archive): an expandable row in the [Layer List](../widgets/layer-list.md), with one child row per source layer, and a block in the [Legend](../widgets/legend.md). They all draw from one source, so tiles are only fetched once.

### Source layers

Each `sourceLayers` entry names a source layer and styles it. The archive layer has no style of its own, so a source layer without `symbology` gets an automatic color. Other fields it leaves out fall back to the archive layer's own (`label`, `popup`, `visible`, `minZoom`, `maxZoom`), then to defaults. `legend` is the other exception: a source layer only uses its own, since the archive's would repeat under every source layer.

| Field | Type | Description |
|---|---|---|
| `sourceLayer` | `string` | Name of the layer inside the archive (required) |
| `name` | `string` | Name in the layer list and legend, with two or more source layers. Default: `sourceLayer` |
| `symbology` | object | Its style |
| `geometryType` | `"point" \| "line" \| "polygon"` | Leave it out to detect it, or to draw mixed geometry |
| `legend` | object | What the legend shows for this source layer (see [Custom legend](#custom-legend)) |
| `label`, `popup`, `visible`, `minZoom`, `maxZoom` | | Same as the [common fields](#common-fields-every-layer-type) |

```json
{
  "id": "counties",
  "type": "pmtiles",
  "name": "US Counties",
  "url": "./layers/US_counties.pmtiles",
  "sourceLayers": [
    {
      "sourceLayer": "US_counties",
      "symbology": { "kind": "simple", "color": "#838291", "opacity": 0.4, "strokeColor": "#fff", "strokeWidth": 1 }
    }
  ]
}
```

A whole basemap-style archive, styling some of its layers and leaving others out:

```json
{
  "id": "protomaps-styled",
  "type": "pmtiles",
  "name": "Protomaps",
  "url": "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles",
  "popup": { "displayType": "standard" },
  "sourceLayers": [
    {
      "sourceLayer": "places",
      "name": "Places",
      "geometryType": "point",
      "symbology": { "kind": "simple", "color": "#1f2937", "radius": 3 },
      "label": { "field": "name" }
    },
    {
      "sourceLayer": "roads",
      "name": "Roads",
      "geometryType": "line",
      "symbology": { "kind": "simple", "color": "#f59e0b", "width": 1.5 }
    },
    {
      "sourceLayer": "water",
      "name": "Water",
      "symbology": { "kind": "simple", "color": "#3b82f6", "opacity": 0.6 }
    },
    {
      "sourceLayer": "landuse",
      "name": "Land Use",
      "geometryType": "polygon",
      "symbology": { "kind": "simple", "color": "#22c55e", "opacity": 0.25 }
    }
  ]
}
```

The demo has both forms: `protomaps-plain` draws every source layer with automatic colors, and `protomaps-styled` lists eight and leaves out `earth`.

!!! warning "Use a host that allows your site"
    A remote archive needs a host that allows requests from your site (CORS). The demo uses Source Cooperative's copy of the Protomaps planet, which allows any site. Protomaps' own daily build at `latest.protomaps.com` only allows `http://localhost:5173`, so it works in `npm run dev` but fails in `npm run preview` and on any deployed site.

### Defaults and draw order

- **Automatic colors.** A source layer with no symbology gets the next color from a fixed palette, in order, so colors stay the same between visits. Automatic fills are 40% opaque so overlapping polygons don't hide each other; lines and points stay solid.
- **Draw order.** Every source layer's polygons draw first, then all lines, then all points, then all labels, which keeps points and lines above polygons. Within each of those, the `sourceLayers` order applies (first on top), or the archive's own order when nothing is listed. For a basemap-style archive, list the source layers so large polygons like land and water sit below the rest, or leave them out.
- **Zooms.** When the archive says a source layer only starts at a certain zoom (Protomaps' `buildings` start at 11), that becomes its minimum zoom, unless the entry sets its own. The archive's maximum zoom isn't applied, because MapLibre keeps drawing past the last zoom the archive has tiles for.
- **Geometry.** Archives built with tippecanoe record each source layer's geometry. When `geometryType` is left out, the kit reads it from there and styles the layer as if it were declared. Without that record (Planetiler archives like Protomaps don't have one), the source layer is drawn as mixed geometry.
- **Mistakes.** A listed source layer the archive doesn't have logs a warning with the valid names and is skipped. Listing one twice skips the whole layer with a console warning that explains the fix. The old `sourceLayer` field that `sourceLayers` replaced is an unknown key, reported when the project's files are read. An MLT archive without `"encoding": "mlt"`, or a `raster` flag that doesn't match the archive's tile type, logs a console warning.

### Raster PMTiles { #raster-pmtiles }

An archive of images (PNG, JPEG, WebP or AVIF tiles: imagery, scanned maps, hillshade) takes `"raster": true`:

```json
{
  "id": "flowers-raster",
  "type": "pmtiles",
  "raster": true,
  "name": "Flowers Imagery",
  "url": "https://air.mtn.tw/flowers.pmtiles"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `raster` | `true` | | Marks the tiles as images |
| `rasterOpacity` | `number` | `1` | Starting opacity, 0 to 1 |
| `tileSize` | `256 \| 512` | `512` | Tile size in pixels. The archive doesn't record it, and a wrong value draws the imagery at half or double scale |

A raster archive draws below every vector layer and stays sharp past its last zoom, because MapLibre keeps scaling the last tiles up. It supports visibility, transparency and Zoom to Extent only: there's no symbology, popup or legend entry. The demo's `flowers-raster` layer is one.

## `tiles` { #tiles }

Tiles served one at a time by a tile server, such as Martin, pg_tileserv, GeoServer, MapTiler or OpenFreeMap. `url` is either a TileJSON URL or a bare `{z}/{x}/{y}` template. URLs are used as they are, so the server must allow cross-origin requests; local tile files belong in [PMTiles](#pmtiles).

A **TileJSON** URL describes itself (source layers, zoom range, attribution), so it needs nothing else:

```json
{
  "id": "demotiles-tilejson",
  "type": "tiles",
  "name": "MapLibre Demo Tiles",
  "url": "https://demotiles.maplibre.org/tiles/tiles.json"
}
```

A **template** has no metadata, so it must list its `sourceLayers` (without them the layer is skipped, with a console warning) and should give the zoom range the server has:

```json
{
  "id": "demotiles-xyz",
  "type": "tiles",
  "name": "Countries",
  "url": "https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf",
  "maxTileZoom": 6,
  "sourceLayers": [
    {
      "sourceLayer": "countries",
      "geometryType": "polygon",
      "symbology": { "kind": "simple", "color": "#f472b6", "opacity": 0.3 }
    }
  ]
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | required | A TileJSON URL, or a template with `{z}`, `{x}` and `{y}` |
| `minTileZoom` | `number` | `0` | Templates only: lowest zoom the server has tiles for |
| `maxTileZoom` | `number` | `14` | Templates only: highest zoom the server has tiles for. Past it MapLibre scales the last tiles up instead of requesting tiles that don't exist |
| `attribution` | `string` | none | Templates only: attribution text or HTML |
| `encoding` | `"mvt" \| "mlt"` | `"mvt"` | Tile format. A TileJSON that declares MapLibre Tiles works on its own |

Vector tile servers work like PMTiles archives: `sourceLayers` (each with its own style), `collapsed`, the expandable row for two or more source layers, automatic colors, draw order, popups and the legend all behave as described under [PMTiles](#pmtiles).

For image tiles (imagery, scanned maps), set `"raster": true`, with `rasterOpacity` and `tileSize` as for [Raster PMTiles](#raster-pmtiles):

```json
{
  "id": "imagery",
  "type": "tiles",
  "raster": true,
  "name": "Aerial imagery",
  "url": "https://tiles.example.com/imagery/{z}/{x}/{y}.png",
  "tileSize": 256,
  "maxTileZoom": 18,
  "rasterOpacity": 0.8
}
```

Tile server layers can't be filtered or exported, since only the tiles in view are loaded. The demo's `Tile Servers` group has a TileJSON, a template and an MLT TileJSON. For shaded relief you don't need a layer: the Basemap widget has a [Hillshade](../widgets/basemap.md#hillshade) switch.

## `flatgeobuf`

[FlatGeobuf](https://flatgeobuf.org/) (`.fgb`) is a streamable vector format. The kit converts it to GeoJSON in the browser, so popups, the legend and the rest work the same as for `geojson`.

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | none | Path to a `.fgb` file, local or remote |
| `bbox` | `"all" \| "dynamic"` | `"all"` | How to load it |

- `"all"` reads the whole file into memory once. Fine for small and medium files; the size limits are the same as GeoJSON.
- `"dynamic"` uses the file's spatial index to fetch only the features in view, and fetches again when the map moves. That's how to use a large remote `.fgb` (hundreds of MB or more) without downloading all of it.

!!! warning "Dynamic mode needs an uncompressed host with Range support"
    `dynamic` reads byte ranges, so the server must send the file uncompressed and support HTTP Range requests. Hosts that gzip responses, such as GitHub Pages, send data the browser can't decode, and dynamic mode fails. S3, other object stores and most CDNs work.

## `esri`

ArcGIS REST services, through [esri-gl](https://github.com/muimsd/esri-gl). `service` picks the kind of service. esri-gl creates the source and the kit adds the styled layers. esri-gl is downloaded only when an app has an Esri layer, the first time one loads.

| `service` | Source | What works |
|---|---|---|
| `"feature"` | GeoJSON, queried for the current view | Kit styling, popups and the legend |
| `"dynamic"` | An image rendered by the server | Visibility and opacity only; no legend or popups |
| `"tiled"` | Cached raster tiles | Visibility and opacity only |

### Feature service

```json
{
  "id": "buoys",
  "type": "esri",
  "service": "feature",
  "name": "NDBC Buoys",
  "geometryType": "point",
  "url": "https://services5.arcgis.com/.../FeatureServer/0",
  "minZoom": 4,
  "symbology": { "kind": "simple", "color": "#a5d7f7", "radius": 5, "strokeColor": "#fff", "strokeWidth": 1 },
  "popup": { "displayType": "standard" }
}
```

For a feature service, `symbology` is optional. Set it to style the layer with the kit, or leave it out to use the service's own ArcGIS styling. It also takes `where`, an ArcGIS where clause (default `"1=1"`).

A feature service has no prebuilt tiles, so the kit queries it for the part of the map in view as you pan, a tile's worth at a time, simplified to screen detail. Each request is capped by the server's own record limit. The layer follows the service's own scale range, the way ArcGIS shows it: a service whose `minScale` is 1:1,000,000 isn't drawn or queried until you zoom in past about zoom 9, so a layer with millions of features doesn't load while zoomed out. `minZoom` and `maxZoom` on the layer replace the service's range.

The `url` ends with the layer number, as in `.../FeatureServer/0`. When the Conness editor adds a layer from a FeatureServer that has only one layer, it adds the number for you.

### Raster services

```json
{
  "id": "usa-dynamic",
  "type": "esri",
  "service": "dynamic",
  "name": "USA States/Counties",
  "url": "https://sampleserver6.arcgisonline.com/.../USA/MapServer",
  "layers": [2, 3],
  "esriOpacity": 0.7
}
```

`dynamic` takes an optional `layers` list: the MapServer sublayer ids to draw. `tiled` takes only the common fields.

Raster services, and feature services drawn with the service's own styling, have no kit symbology to hold an opacity. Set their starting opacity with `esriOpacity` (0 to 1, default 1). A feature service with kit `symbology` uses the symbology's `opacity` and `strokeOpacity` instead.

## `geoparquet`

[GeoParquet](https://geoparquet.org/) files are read by [DuckDB](#duckdb), which runs in the browser and converts them to GeoJSON.

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Path to a `.parquet` or `.geoparquet` file. A remote file needs CORS |
| `limit` | `number` | Stop after this many features. Leave it out to read the whole file |
| `mvt` | `boolean` | Draw the layer as vector tiles cut on the fly (see below). Default `false` |
| `maxTileFeatures` | `number` | With `mvt`: most features per tile; the smallest are dropped first. Default `5000` |
| `maxTileZoom` | `number` | With `mvt`: highest zoom tiles are cut at. Default `14` |

- **Geometry:** WKB, WKT and native geometry columns all work. The column comes from the file's GeoParquet metadata, or a common name like `geometry` or `geom`. A plain Parquet file with `lon` and `lat` columns works too, as points.
- **Projections:** files in another coordinate system are reprojected to WGS84 automatically, using the CRS in the file's metadata. The demo's `storm-reports-geoparquet-5070` layer is the storm reports file reprojected to EPSG:5070 (CONUS Albers), and it draws exactly on top of the original. To make one yourself with GeoPandas:

    ```python
    import geopandas as gpd
    gdf = gpd.read_parquet("app/projects/demo/layers/storm_reports.parquet")
    gdf.to_crs(5070).to_parquet("app/projects/demo/layers/storm_reports_5070.parquet")
    ```

!!! note "Large files"
    A GeoParquet layer reads the whole file. For large files, set a `limit`, trim the file, or draw it as [tiles on the fly](#tiles-on-the-fly). For very large data that doesn't change, [PMTiles](#pmtiles) is still the best choice.

### Tiles on the fly (`mvt`) { #tiles-on-the-fly }

Plain GeoParquet is the default choice. MapLibre already tiles it internally, simplifying shapes and dropping tiny polygons at low zoom, and for small and medium files it pans more smoothly. Set `"mvt": true` when a file is too big for that path, or to keep the data off the main thread (which also makes basemap switches lighter).

With `mvt`, the file loads once into DuckDB's memory (about three times its size), reprojected to Web Mercator, and MapLibre fetches vector tiles that DuckDB cuts as you pan. Each tile drops features smaller than about a pixel and keeps the largest `maxTileFeatures`, like tippecanoe's "drop smallest as needed": dense areas thin out at low zoom and show everything once a tile is small enough to fit them.

- Tiled layers start at zoom 10 unless the layer sets `minZoom`.
- `maxTileZoom` (14, the tippecanoe and Planetiler default, about 0.6 m precision) is the last zoom tiles are cut at; MapLibre keeps drawing past it. Raise it for very dense data that's still thinned at 14; lower it for coarse data.
- Filters, Export (in WGS84) and Zoom to Extent still work. Popups, the legend and labels work as for any vector-tile layer.
- Files over 100 MB log a console warning suggesting PMTiles.

GeoJSON layers get the same with `"duckdb": { "mvt": true }`. The demo has `scott-buildings` (plain) and `scott-buildings-mvt` (tiled) side by side to compare.

!!! tip "Optional: a covering bbox and spatial sorting"
    GeoParquet 1.1 files can carry a per-row bounding box column and be sorted spatially, which lets other tools, and partial reads of remote files, skip chunks that aren't needed. The kit's tiling doesn't need either. With GeoPandas 1.0 or later:

    ```python
    gdf = gdf.iloc[gdf.hilbert_distance().argsort()]
    gdf.to_parquet("out.parquet", write_covering_bbox=True)
    ```

## DuckDB { #duckdb }

GeoParquet layers, and GeoJSON layers with `duckdb`, are read by [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm) (DuckDB 1.5.6). It runs in a background worker, so reading doesn't block the page.

- **When it loads:** at startup, but only if at least one such layer is configured, whether or not it's visible. An app without one never downloads it, neither the engine nor its JavaScript client (about 200 kB). The loading overlay shows each step and stays up until those layers' data is on the map, and a layer turned on later appears instantly. With [`map.onlyVisibleOnLoad`](map-camera.md#load-only-visible-layers), a hidden DuckDB layer loads when it's first turned on instead, with a spinner in the layer list while it reads; if every DuckDB layer starts hidden, DuckDB itself isn't downloaded until then.
- **Size:** about 11.5 MB on the first visit (DuckDB plus its `parquet`, `httpfs` and `spatial` extensions). The browser caches it after that.
- **Where it comes from:** jsDelivr for DuckDB itself, and `extensions.duckdb.org` for the extensions, pinned to the version the app installs. If DuckDB can't load (a blocked CDN, for example), those layers stay empty with a console warning, and the rest of the map keeps working.

To host the files yourself, for an offline or intranet deploy, set `duckdb` in `settings.json`:

```json
"duckdb": {
  "bundleUrl": "https://intranet.example.com/duckdb/",
  "extensionsUrl": "https://intranet.example.com/duckdb-extensions"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `bundleUrl` | `string` | jsDelivr | Folder holding `duckdb-base.wasm` and `duckdb-browser-base.worker.js`, from the same `@duckdb/duckdb-wasm` version the app installs |
| `extensionsUrl` | `string` | `extensions.duckdb.org` | Extension repository for `parquet`, `httpfs` and `spatial`, matching that DuckDB version |

!!! note "Content Security Policy"
    If your site sends a Content Security Policy, allow `https://cdn.jsdelivr.net` (scripts, worker and WASM), `https://extensions.duckdb.org` (extension WASM) and `blob:` for workers. Self-hosting changes the first two to your own URLs.

## Labels { #labels }

Any vector layer can have text labels through a `label` block.

| Field | Type | Default | Description |
|---|---|---|---|
| `field` | `string` | none | Column to label by |
| `text` | `string` | none | Your own words with columns mixed in, each column name in braces: `"{faa_id}: {name}"`. A feature without one of the columns shows nothing in its place. Wins over `field` |
| `expression` | MapLibre expression | none | A MapLibre expression for the text, for anything `text` can't do; wins over `text` and `field`. E.g. `["concat", ["get", "name"], " (", ["get", "code"], ")"]` |
| `fontSize` | `number` | `12` | Text size in px |
| `bold` | `boolean` | `false` | Noto Sans Bold instead of Noto Sans Regular |
| `color` | `string` | `"#333333"` | Text color |
| `haloColor` | `string` | `"#ffffff"` | Outline color, for legibility |
| `haloWidth` | `number` | `1` | Outline width; 0 for none |
| `minZoom` | `number` | the layer's | Earliest zoom at which labels can appear, so the geometry can show first. A label that doesn't fit still stays hidden (see below) |
| `anchor` | `"center" \| "top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | `"center"` | Label position relative to the feature. Not used on line layers |
| `offset` | `number` | the text height | How far (px) a label at a corner sits from its feature, across and up or down. No effect on a centered label or a line layer |
| `spacing` | `number` | `500` | Line layers only: px between repeats of the label along a line |
| `allowOverlap` | `boolean` | `false` | Draw every label even where they collide. By default MapLibre drops colliding labels |

!!! note "The basemap must serve the font"
    MapLibre draws labels on the map canvas with fonts from the basemap style's `glyphs` URL. Labels use Noto Sans (Regular, or Bold with `"bold": true`), which every OpenFreeMap style (the default basemaps) serves. A style with no `glyphs` URL can't draw labels at all.

On a layer with `"geometryType": "line"`, labels follow the line. MapLibre puts the name wherever the line is straight enough to hold it (the text can bend up to 90°) and repeats it every `spacing` px along long lines. A label that doesn't fit along its line is left out, so a line cut into short pieces only gets labels when you zoom in. Joining the pieces in your data, for example with shapely's `linemerge`, lets names show at lower zooms.

Polygons, and layers without a `geometryType`, are labeled at a point MapLibre picks (for a polygon, its center), and `offset` moves the label from there.

To set label defaults for every layer at once, use [`ui.layerDefaults.label`](ui-layout.md#global-layer-defaults).

## Filtering { #filtering }

Add `filters` to a layer to let users filter it from the [Layer List](../widgets/layer-list.md#filtering). Each entry names a column and how to filter it:

On a layer in `layers.json`:

```json
"filters": [
  { "column": "state", "kind": "categorical", "label": "State" },
  { "column": "passengers", "kind": "numeric", "label": "Annual Passengers" }
]
```

| Field | Type | Default | Description |
|---|---|---|---|
| `column` | `string` | required | Feature property to filter on |
| `kind` | `"categorical" \| "numeric"` | required | `categorical`: a checklist of the column's values, read from the data. `numeric`: one condition the user types in (`>`, `between`, …) |
| `label` | `string` | `column` | Name shown in the filter panel |

Which layer types can be filtered:

| Layer type | Filterable | How |
|---|---|---|
| `geojson` | yes | In the browser |
| `geoparquet` | yes | In the browser, once the file has loaded |
| `esri` `feature` | yes | On the server, combined with the layer's `where` |
| `pmtiles`, `tiles` | no | Only tiles in view are loaded, so the full list of values isn't available |
| `flatgeobuf` | no | Not supported |
| `esri` `dynamic` / `tiled` | no | Rendered by the server; there are no features to filter |

Adding `filters` to an unsupported type, or listing the same column twice, stops the app at boot with an error pointing at `settings.layers["<id>"].filters`.

!!! note "Esri value lists are capped"
    An Esri `feature` layer gets its categorical values from one query, so the list stops at the service's `maxRecordCount` (often 1,000 to 2,000). Pick categorical columns with far fewer distinct values than that. Numeric filters aren't affected.

## Custom legend { #custom-legend }

The legend normally reads each layer's symbology. Set `legend` on a layer (or on a PMTiles or `tiles` source layer) to choose what it shows instead. It takes the same three shapes as a [raw symbology's `legend`](symbology.md#legend-overrides), and wins over it:

An Esri raster service, which has no kit symbology to read:

```json
{
  "id": "usa",
  "type": "esri",
  "name": "USA",
  "service": "dynamic",
  "url": "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer",
  "layers": [2, 3],
  "legend": {
    "kind": "categories",
    "entries": [
      { "label": "States", "color": "#94a3b8" },
      { "label": "Counties", "color": "#cbd5e1" }
    ]
  }
}
```

- `categories`: labeled swatches. Raster layers draw them as squares; other layers use their `geometryType` (dot, line or square).
- `gradient`: a continuous bar, with the first and last labels at its ends.
- `hidden`: leaves the layer out, like `"hideFromLegend": true`.

Rasters and Esri layers styled by the service only appear in the legend when they set `legend`.

## Hiding a layer from the legend

Set `"hideFromLegend": true` on any layer to keep it on the map and in the layer list but out of the legend. It works with every layer and symbology kind, as does `"legend": { "kind": "hidden" }` on the layer.
