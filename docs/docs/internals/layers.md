---
icon: lucide/layers
---

# Layers & Loaders

How `settings.layers` turns into layers on the map. The code is in `app/src/core/layers/`.

## Registration

`registerLayers(map, layers)` is the entry point. `MapView` calls it once, when the map is ready; a basemap switch doesn't call it again. It:

1. **Checks ids.** Duplicate layer ids throw.
2. **Checks symbology refs and opacity.** A `ref` whose name isn't in `symbology.json` throws here, before anything draws. (A top-level `opacity` on a layer is also checked here, but the loader's schema check rejects it as an unknown key first.) `MapView` catches these, logs them with `console.error` and registers no layers, so the map shows only the basemap.
3. **Keeps runtime state.** If the store already has metadata for a layer (when `MapView` registers again, e.g. under React's StrictMode in development), it uses that layer's `visible` instead of the settings default. Loaders read the layer-list opacity multiplier the same way, through `startOpacity` (`layers/recordLayer.ts`): the store's value, else the layer's `configuredOpacity` (Esri's `esriOpacity`, a raster tile layer's `rasterOpacity`), else 1.
4. **Calls the loader** for `layer.type`, rasters first. `isRasterLayer` (Esri `dynamic` / `tiled`, and `raster: true` PMTiles and tile servers) sorts them ahead of vector layers, so they end up below every vector layer, since MapLibre puts each new layer on top.
5. **Records the layer** with `recordLayer` (`layers/recordLayer.ts`). It stores the layer's hooks (`getBounds` in `layerBoundsGetters`, `getFeatures` in `layerFeatureGetters`, the `filter` handler in `layerFilterHandlers`), reapplies any saved filter, marks the layer in `pendingLayerData` until its `ready` promise settles (see [Loading overlay](#loading-overlay)), and writes its `LayerMetadata`, which the layer list and legend read. A loader can override fields of that record through the entry's `record` (PMTiles uses it for parent rows). Loaders that add layers after registration, like whole-archive PMTiles, call `recordLayer` themselves.
6. **Returns `RegisteredLayer[]`.** Each entry can have:
    - `teardown()`, which cleans up long-lived resources.
    - `getBounds()`, which finds the layer's extent for Zoom to Extent when the user clicks it. Results go through `isValidLngLatBounds` (`layers/bounds.ts`), so bad bounds do nothing instead of throwing.
    - `getFeatures()`, every feature in the layer, unfiltered, for the layer list's Export Data. The caller applies the active filter, then writes the chosen format (`core/export/download.ts`, `writeKML.ts`, `writeGeoParquet.ts`, `writeCSV.ts`). Only `geojson` (through the shared `loadGeoJsonFeatures` cache, or DuckDB's result with `duckdb`) and `geoparquet` set it, which is what hides Export Data on other types.
    - `filter`, the layer's filter mechanism (see [Filtering](#filtering)).
    - `ready`, for loaders that fill their source after registering (PMTiles while it reads an archive's layer list). It settles once the data is on the source and never rejects. Loaders that load whole files (DuckDB, GeoJSON by URL, FlatGeobuf) go through `loadWhenVisible` instead (see [Loading on demand](#loading-on-demand)), which marks `pendingLayerData` itself.
    - `record`, overrides for the store record (see step 5).

If a loader fails, for example because a local file is missing, the error is caught and the layer is skipped with a warning. One bad layer never blanks the map; it's just missing from the layer list and legend.

## The loader dispatch

```
type === 'geojson'    → loaders/geojson.ts     addGeoJsonLayer
type === 'pmtiles'    → loaders/pmtiles.ts      addPMTilesLayer
type === 'tiles'      → loaders/tiles.ts        addTilesLayer
type === 'flatgeobuf' → loaders/flatgeobuf.ts   addFlatGeobufLayer
type === 'esri'       → loaders/esri.ts         addEsriLayer
type === 'geoparquet' → loaders/geoparquet.ts   addGeoParquetLayer
```

`geoparquet`, and `geojson` with `duckdb`, both hand off to `loaders/duckdbLayer.ts`, or to `loaders/duckdbTiles.ts` with `mvt` (see [DuckDB layers](#duckdb-layers)). `pmtiles` and `tiles` both build on the shared vector-tile core (see [Vector tiles](#vector-tiles)).

Each loader creates the MapLibre source and the styled sublayers, then returns a `RegisteredLayer`.

Libraries only some layer types need are imported with `import()` the first time a layer uses them, so they stay out of the startup bundle: the DuckDB JavaScript client (`core/duckdb/engine.ts`, on top of the WASM engine it already loaded on demand), esri-gl (`loaders/esri.ts`) and FlatGeobuf's reader (`loaders/flatgeobuf.ts`). An Esri raster service can't add its layer until esri-gl arrives, so it first adds a hidden `<id>-slot` background layer to hold its place in the draw order, and adds the raster before it. Because of these splits, `vite.config.ts` raises `chunkSizeWarningLimit` to 1500 kB: the startup chunk is mostly MapLibre, and the limit still catches a new heavy import.

## The shared sublayer model

One layer in `settings.layers` becomes up to six MapLibre layers, named with a suffix on the layer id:

| Suffix | Type | Used by |
|---|---|---|
| `-fill` | fill | polygons |
| `-line` | line | lines, or polygon outlines on polygon layers |
| `-point` | circle | points |
| `-label` | symbol | labels |
| `-raster` | raster | image tiles: Esri raster services, raster PMTiles, raster tile servers |
| `-shadow` | line | the Draw widget's drop shadows (so they hide with the Drawings layer) |

Every vector layer goes through one builder, `addSublayers` in `loaders/sublayers.ts`: GeoJSON, FlatGeobuf, GeoParquet, Esri feature services with kit symbology, and vector tiles (which pass a `sourceLayer`). Each geometry sublayer is filtered by geometry type (`BASE_FILTERS`), so one source can mix points, lines and polygons with no extra config. Popups, the legend, opacity, labels and basemap switching work the same for all of them.

- **Which sublayers.** A declared `geometryType` builds only what that geometry needs. Without one the layer is mixed and gets all three, unless its symbology is `raw`: `geometryFromRawPaint` (`layers/symbology.ts`) reads the geometry from the paint's prefixes (`circle-`, `fill-`, `line-`), and a paint that points to no single geometry throws, which skips that layer with a console warning. The legend uses the same function, so the two always agree.
- **Outlines.** `BASE_FILTERS['-line']` matches only LineStrings, so mixed layers never trace polygon edges (that's heavy on big polygons). A polygon layer's `-line` sublayer is its outline instead: filtered with `POLYGON_OUTLINE_FILTER` and painted with `strokeColor` / `strokeWidth` / `strokeOpacity`. The builder records that per-sublayer base filter (`recordBaseFilter` / `baseFilterFor`) so the layer-list filter can build on it.
- **Insertion point.** `beforeIds` (per fill, line, point and label) inserts the sublayers below given layer ids instead of on top. PMTiles archives use it for their draw-order tiers.

FlatGeobuf and plain GeoParquet are converted to GeoJSON in the browser, so both hit the same memory limit as a `.geojson` file. Tiled layers (PMTiles, tile servers, raster layers) stream only what's in view, and GeoParquet with `mvt` keeps its data in DuckDB and serves tiles from there.

## Vector tiles { #vector-tiles }

`loaders/vectorTiles.ts` is the shared core for every vector-tile layer: PMTiles archives (`loaders/pmtiles.ts`), tile servers (`loaders/tiles.ts`) and DuckDB tiles (`loaders/duckdbTiles.ts`). Each supplies a provider (its MapLibre source, its metadata: source layers and tippecanoe tilestats, and its bounds) to `addVectorTileLayer`, which turns one layer into one or more drawn source layers, all from a single MapLibre source (`src-<id>`). Image tiles go through `addRasterTileLayer` instead: one `-raster` sublayer, starting at `rasterOpacity`, below every vector layer.

The rest of this section describes that core; PMTiles was the first provider, so some names still say so.

- **One source layer** (a one-entry `sourceLayers`) is built as a normal layer under the layer's own id.
- **Two or more** (listed, or every layer in the archive's `vector_layers` when none are listed) become a parent with children. The parent's `LayerMetadata` has `isParent` and `childIds` (draw order, first on top) and draws nothing itself; each child is `<id>/<sourceLayer>` with `parentId`. When nothing is listed, the children only exist once the archive's metadata arrives, so the parent returns `ready` for the boot overlay and records its children later through `recordLayer`. If the archive turns out to have one source layer, the placeholder parent is re-recorded as a normal layer.
- **Draw order.** The parent adds four invisible `background` layers at its place in the stack (`<id>-slot-fill`, `-slot-line`, `-slot-point`, `-slot-label`). Children insert each sublayer below its tier's marker (`beforeIds`), last child first, so every child's fills sit under every child's lines, and so on, and children that arrive late still land in the right place.
- **Resolving a child.** Each field falls back from the `sourceLayers` entry to the archive layer's own field, then to defaults: a `PALETTE` color (`core/theme/palette.ts`, shared with Draw) assigned by index, at `opacity: 0.4`. The archive's per-source-layer `minzoom` raises the floor unless the entry sets one. Listed names the archive doesn't have are warned about and their children removed.
- **Archive metadata.** `core/layers/pmtilesProtocol.ts` holds the one `pmtiles://` `Protocol` (registered in `MapView`). `pmtilesArchive(url)` reuses the reader MapLibre already uses, so the header isn't fetched twice, and `pmtilesMetadata(url)` caches the metadata JSON per URL. The loader reads it in the background for the source-layer check, tippecanoe's `tilestats` geometry (a detected polygon swaps its `-line` sublayer to the outline filter and paint), and zoom floors. Zoom to Extent reads the header's bounds.
- **Popups.** The loader publishes one popup target per drawn source layer to the store (`popupLayerOverrides`); see [Popups](popups.md).
- **Built-in archives on hosts that ignore Range.** A `.pmtiles` file from the project's `layers/` folder is read through `RangeOrWholeSource` (`core/layers/pmtilesSource.ts`), since Cloudflare Pages answers Range requests with the whole file. It makes the first read itself: a 206 means ranges work, and later reads go through pmtiles' `FetchSource`. A 200 body is the whole file, kept in memory and sliced for every read, so the file is downloaded once. Reads that start before the first one finishes wait for it and share its request. Remote archives skip this and must be on a host that honors Range.
- **PMTiles specifics.** `warnOnTileTypeMismatch` reads the archive header and warns when `raster` doesn't match the tile type, or when an MLT archive (tile type 6) has no `encoding: 'mlt'`, since the pmtiles protocol's TileJSON doesn't carry the encoding.
- **Tile servers.** A TileJSON URL is passed to MapLibre as the source `url`; the loader also fetches its own copy (cached per URL, so a basemap switch doesn't refetch it) for `vector_layers` and bounds. A template becomes a `tiles` source with `minTileZoom` / `maxTileZoom` / `attribution` from the layer, and must list `sourceLayers`.

## DuckDB layers { #duckdb-layers }

GeoParquet layers, and GeoJSON layers with `duckdb`, are read by DuckDB-WASM:

- **`core/duckdb/engine.ts`**: `getDuckDB()` starts one shared instance and caches its promise, so every caller shares a single startup (a failed start is cleared so it can retry). It loads from jsDelivr (`getJsDelivrBundles`, pinned to the installed `@duckdb/duckdb-wasm` version) unless `settings.duckdb.bundleUrl` is set. The worker starts from a same-origin blob URL, because browsers won't start a worker from another origin. Then it loads the `parquet`, `httpfs` and `spatial` extensions, from `settings.duckdb.extensionsUrl` if set. Each step goes to the store's `loadingStatus` for the overlay.
- **`core/duckdb/readGeo.ts`**: `describeGeoParquet` reads the file's `geo` metadata and `DESCRIBE` output to find the geometry column, its encoding and CRS (`describeGeoJSON` does the same for GeoJSON); the plain read and the tile table both start from it. `readGeoParquet` wraps the geometry in `ST_Transform(…, 'EPSG:4326')` when the CRS isn't WGS84, and selects the attributes plus `ST_AsGeoJSON`. `readGeoJSON` does the same from `describeGeoJSON`, through `ST_Read` (GDAL). Results become a FeatureCollection, cached per layer id and URL (and `limit`), so a basemap switch, which re-registers every layer, reuses them instead of re-querying, and a file swapped in the editor is read again. 64-bit integers become plain numbers, or strings when they're too large to be exact, so feature properties, filter values and MVT tiles all hold the same type.
- **`loaders/duckdbLayer.ts`**: `addDuckDBLayer` adds an empty GeoJSON source and the shared sublayers, waits for the engine, then fills the source with `setData`. `getBounds`, `getFeatures` and the filter handler all work off that FeatureCollection. A failed load isn't kept: the next toggle, export, filter or zoom tries again, and a successful retry fills the map too. `duckdbTiles.ts` does the same for its tile table. `teardown` marks the entry stale, so a late result doesn't write into a map that has since re-registered the layer.

With `mvt`, the layer is tiled instead:

- **`core/duckdb/tileTable.ts`**: `prepareTileTable` builds one in-memory table per layer, once (reused across basemap switches): attributes cast to types `ST_AsMVT` accepts, geometry in Web Mercator, and bbox and bbox-area columns so each tile query is a range filter. The table is then stored in Hilbert-curve order (`ST_Hilbert`), so each row group covers a small area. `tileBytes` cuts one tile: features in its envelope, skipping those under about a pixel, then the `maxTileFeatures` largest. The envelope goes into the query as plain numbers, since DuckDB only skips row groups by their min/max on comparisons with constants. If the sort fails (an older spatial extension), the layer still works, just with slower tiles. `distinctValues` and `allFeatures` (back in WGS84) serve the filter panel and Export.
- **`core/duckdb/tileProtocol.ts`**: the `duckdb://<layerId>/{z}/{x}/{y}` protocol, registered in `MapView`, answers MapLibre's tile requests from that table.
- **`loaders/duckdbTiles.ts`**: `addDuckDBTileLayer` draws the layer through the vector-tile core with one source layer, applies the default `minZoom` of 10, and logs a warning for files over 100 MB.

Every configured layer registers at boot, hidden or not, so DuckDB starts at boot whenever any layer needs it, and never otherwise. With `map.onlyVisibleOnLoad`, a hidden DuckDB layer's read waits until it's first turned on (`loadWhenVisible`), so if every DuckDB layer starts hidden, DuckDB isn't downloaded until one is shown.

## Loading overlay { #loading-overlay }

`useDataLoading` (`core/map/useDataLoading.ts`) gates the boot `LoadingOverlay`. It tracks every configured layer id in `settings.layers` (hidden ones too, except those deferred by `map.onlyVisibleOnLoad`); PMTiles children share their parent's source, so the parent covers them. A layer counts as loaded when `map.isSourceLoaded` is true **and** it isn't in `pendingLayerData`. The second check matters for DuckDB layers: their empty source reports loaded almost immediately, long before the data arrives. Tracking hidden layers matters too: a Safari profile showed a hidden 114k-polygon GeoParquet layer's `setData` blocking the main thread for about 800 ms after an overlay that only waited for visible layers had already faded. Once everything has loaded, a `done` latch keeps the overlay closed, so a later basemap switch (which marks DuckDB layers pending again) can't reopen it.

The overlay's detail line (`ui.loader.showDetails`) shows `loadingStatus` while DuckDB starts (the engine writes each step and clears it when ready), then the name of the last layer in `useDataLoading`'s `waiting` list.

## Loading on demand { #loading-on-demand }

`layers/lazyLoad.ts` is how a loader starts its data load. `isDeferred(layer)` is true when `settings.map.onlyVisibleOnLoad` is on, the layer is hidden, and its type loads whole files (`geojson`, `geoparquet`, `flatgeobuf`). `loadWhenVisible(layer, visibleNow, start)` runs `start` right away unless the layer is deferred; then it subscribes to the store and runs it the first time `layerMetadata[id].visible` turns true. Either way it marks the layer in `pendingLayerData` until `start` settles, which drives the layer list's spinner and the boot overlay. It returns an unsubscribe for the loader's `teardown`.

The DuckDB loaders keep their read in a lazy promise (`load()`), so Export Data, filter values and Zoom to Extent on a layer that hasn't loaded yet start the read themselves. A deferred GeoJSON-by-URL layer adds its source empty and hands MapLibre the URL on first show (`fillFromUrl`, which settles on the source's `sourcedata`).

## Layer operations: `layerOps.ts`

Visibility and opacity changes loop over the sublayer suffixes:

- **`setLayerVisibility`** sets `visibility` on the geometry sublayers. The `-label` sublayer is left alone by default, because the layer list has a separate labels button. `includeLabel` changes that; the draw widget uses it for text drawings, where the text is the geometry.
- **`setLayerOpacity`** applies the layer-list multiplier. The symbology's own opacity is the base: when `addSublayers` and `addLabelLayer` build a sublayer, `withLayerOpacity` (`layers/opacity.ts`) records each opacity property's base value and paints base × multiplier. `setLayerOpacity` recomputes from those bases. Numbers are multiplied, expressions are wrapped in `['*', base, m]`, and zoom-based expressions (which MapLibre requires at the top level) are left as written. Sublayers the kit didn't build (Draw's, esri-gl's own styling, rasters) have no recorded base and keep the old behavior: numbers are set directly and expressions skipped.
- **`setLayerZoomRange`** sets a layer's zoom range on every sublayer, for the Layer List's Zoom Range. No limit is MapLibre's own 0 and 24. A label with a later start than its layer (`labelMin`) keeps that start. The widget keeps the configured range in the layer's `configuredZoom` metadata, for Reset.
- **`setGeoJsonLayerFilter`** applies a user filter to a GeoJSON-backed layer, ANDed with each sublayer's geometry filter (`baseFilterFor`). The base filter is rebuilt on every call, never read back from the map, so filters can't stack. The `-label` sublayer is filtered too.

Missing sublayers are skipped, so each operation works whatever sublayers a layer has.

## Filtering { #filtering }

A layer's filter state (`layerFilters` in the store) compiles to three outputs in `core/filters/compile.ts`, all from the same normalized conditions:

| Output | Used by |
|---|---|
| MapLibre expression | `geojson` and `geoparquet` drawing, through `setGeoJsonLayerFilter` |
| JS predicate | Layer search and filtered Zoom to Extent (`currentFilterPredicate`) |
| ArcGIS `where` | Esri `feature` layers, through esri-gl's `setWhere`, ANDed with the layer's own `where` |

Each loader that supports filtering returns a `filter` handler with `apply(state)` and `getValues(column)`, which returns a column's distinct values and caches them per layer and column. Changes from the UI go through `updateLayerFilter` (`filters/apply.ts`), which writes the store and calls the handler. `validateLayerFilters` rejects unsupported types at boot.

`layers/geojsonFeatures.ts` caches each `geojson` layer's whole file, by layer id and URL. Search, filter values and Zoom to Extent all read from it instead of each fetching the file. DuckDB's tile tables (`duckdb/tileTable.ts`) are rebuilt the same way when a layer's URL changes.

## URL resolution

`resolveLayerUrl.ts` turns a path like `"./layers/parks.geojson"` into a bundled URL with Vite's `import.meta.glob('/layers/**/*', { query: '?url' })`. Full URLs pass through unchanged. A mistyped local path throws with a list of the files it does know about. Vite inlines small layer files as data URLs and writes larger ones as separate hashed files.

## Surviving a basemap switch

A basemap switch doesn't touch data layers. `swapBasemap` (`core/map/basemapLayers.ts`) removes the old basemap's layers and sources and adds the new ones underneath the lowest data layer, so sources keep their data and nothing is re-sent to MapLibre's worker. See the warning in the [Architecture](architecture.md#the-boot-lifecycle) page. `RegisteredLayer.teardown()` runs only when `MapView` unmounts.
