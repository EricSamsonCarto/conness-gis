---
icon: lucide/ruler
---

# Draw & Measure

The draw and measure widgets are built the same way. A controller class, separate from React, handles all map interaction and drawing. It wraps [@mapbox/mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw) ("Draw"), which owns the editable shapes and vertex editing, and adds its own layers on top for labels, drafts and per-feature color.

- `app/widgets/draw/lib/DrawController.ts`
- `app/widgets/measure/lib/MeasureController.ts`

The React component (`Widget.tsx`) stays small. It holds UI state, such as the active tool and the list of items, calls controller methods when the user acts, and gets updates back through callbacks (`onChange`, `onFinish`, `onSelect`, and measure's `onLive`).

## Using mapbox-gl-draw with MapLibre

mapbox-gl-draw is written for Mapbox. Both controllers create it with `addMapboxDraw` from `core/map/mapboxDraw.ts`, which adapts it in two ways:

1. **CSS class names.** Draw looks up DOM classes by their Mapbox names, so the controller points `MapboxDraw.constants.classes` at MapLibre's equivalents (`maplibregl-canvas`, `maplibregl-ctrl`, …), following MapLibre's official example. The `@types` package marks these readonly, so the code casts to a writable record.
2. **Control type.** `@types/mapbox__mapbox-gl-draw` types `MapboxDraw` against mapbox-gl's `Map`, so its `IControl` signature doesn't match MapLibre's. `addMapboxDraw` and `removeMapboxDraw` cast through `IControl`. At runtime this is MapLibre's documented setup.

Draw is created with `displayControlsDefault: false` (the widgets have their own tool buttons), `userProperties: true` (so the style array can read feature properties as `user_*`) and each widget's own `styles` array (`lib/drawStyles.ts`).

The same module holds everything else the two controllers share, so they look and behave the same:

- Draw fires its events (`draw.create`, `draw.update`, `draw.delete`, `draw.selectionchange`, `draw.render`) on the map, but MapLibre 6 types only its own event names, so the controllers subscribe through `drawEvents(map)`, a typed view of the same `on` / `off` / `once`.
- Draw renders every style twice, as `<id>.cold` and `<id>.hot`; `drawLayerIds(map, styles)` lists those layers, and the controllers' hover checks pass them to `queryRenderedFeatures`, so moving the mouse never searches the basemap.
- `setDrawVertexColor` colors the vertex handles, which can't follow the feature color through the style array because Draw strips `user_*` properties off vertex points.
- `setDrawHover`, `repaintDraw` and `featuresWithMeta` (below), `HOVER_COLOR` (the amber both style arrays use for a hovered feature), the swap helpers (see [Swapping without a blink](#swapping-without-a-blink)) and `DraftFeature` (see [Drawing a line or polygon](#drawing-a-line-or-polygon)).

## Per-feature color with `setFeatureProperty`

Both widgets give each feature a color. Measure cycles through a palette; draw starts from a palette and lets the user change it. The color is stored on the Draw feature with `setFeatureProperty(id, 'color', …)`, so it's included in `draw.getAll()` and the style array reads it as `user_color`.

`setFeatureProperty` doesn't repaint on its own, since Draw only re-renders on its own events. After changing a property, the controller calls `repaintDraw(draw)`, which sets the current FeatureCollection again (`draw.set(draw.getAll())`) to force a render without losing the selection or mode. List-row hover works the same way: `setDrawHover(draw, from, to)` moves a `user_hover` property and repaints.

## Surviving close and reopen

Closing the widget unmounts the component, which destroys the controller and removes Draw. To get the shapes back, each controller keeps a session snapshot at module level, outside the controller instance (`measureSession`, and the draw equivalent). It holds the finished features, with geometry and per-feature metadata, plus the color counter.

- `saveSession()` writes the snapshot on every change, from `featuresWithMeta(draw, meta)`: the Draw features the controller has metadata for.
- `restoreSession()`, called in the constructor, adds the saved features to the new Draw and refills the metadata map. Draw keeps a string `id` you give it, so features keep their identity.

Measure also stores the widget's settings (units, label toggles, keep on close) in the same session with `getMeasurePrefs` / `setMeasurePrefs`, so they don't reset on reopen.

## After a basemap switch

Nothing to do. A switch swaps only the basemap's layers, so Draw's layers, the controller's own layers and the kept overlays all stay.

## Swapping without a blink

Opening and closing swaps the same shapes between Draw's layers and the kept overlay. GeoJSON only reaches the screen after a trip through MapLibre's worker, so removing the old layers at once would leave a few blank frames. Both swaps add the new layers first and remove the old ones in `onSourcesLoaded(map, sourceIds, fn)` (`core/map/persistentOverlay.ts`), which runs `fn` once those sources have drawn (with a 1 s fallback, since a hidden source may never report loaded):

- **Close:** the overlay is drawn, then Draw (and Measure's live label layer) comes off once the overlay's sources have loaded.
- **Open:** Draw is added and the session restored; the overlay comes off once Draw has rendered (`draw.render`) and its `mapbox-gl-draw-cold` source (plus Measure's label source) has loaded. With nothing to restore, the overlay comes off at once.

`core/map/mapboxDraw.ts` keeps the swap still in progress in one module-level `pendingSwap`, shared by both widgets: `swapOverlayIn` sets it on close and `swapOverlayOut` on open. `addMapboxDraw` and each controller's `destroy` call `finishPendingSwap()` first, which finishes it at once. Draw's sources have fixed ids, so this keeps a second Draw off the map, also when the user goes straight from Draw to Measure (the old widget's Draw is removed before the new one is added), and leaves no stale overlay. `unbind()` and the cursor cleanup run immediately on close, so the tool stops responding even while Draw is still on the map.

## Labels (measure)

Measure draws its own labels as a `symbol` layer over a GeoJSON source, rebuilt by `buildLabelFeatures()` from Draw's current features:

- **Total label:** one per feature, at the centroid for areas and the last vertex for lines. Controlled by the *Show Total* toggle.
- **Segment labels:** one at each segment's midpoint, controlled by *Show Edge Labels*. Never shown for freehand shapes, whose many vertices would flood the map with labels.
- A `kind` property (`total`, `segment` or `segment-edit`) sets each label's size, color and offset through a MapLibre `case` expression. While a feature is being edited, its segment labels become `segment-edit` and move up, so the midpoint handles for adding vertices stay clickable.

After each refresh the controller moves the label layer back to the top (`moveLayer`), because Draw re-adds its own layers on top whenever it renders.

## Freehand (measure)

Draw has no freehand mode, so the controller handles it. On mousedown (or touchstart) with a freehand tool selected, it streams cursor positions into a dashed draft source; on mouseup (or touchend) it hands the finished shape to Draw as a normal editable feature. A finger drag fires only touch events, so both are bound to the same handlers. `dragPan` and `doubleClickZoom` are turned off while a freehand tool is selected, and turned back on through `setTool(null)` when it finishes. Setting `tool = null` directly would skip that and leave the map unable to pan.

Turning `dragPan` off also makes MapLibre switch the canvas to `touch-action: pan-x pan-y`, so on a phone a finger drag would scroll the page or pull to refresh. While a freehand tool is selected, the controller adds a `measure-freehand` class to the map container, and `measure.css` sets `touch-action: none` on the canvas under it.

## Drawing a line or polygon

`DraftFeature` (`core/map/mapboxDraw.ts`) handles the shape being drawn, in both widgets. On each `draw.render` while a tool is out, `update(meta, nextColor)` finds the draft (the newest feature Draw has that isn't in the controller's metadata yet) and:

- gives it its palette color from the first click, so it isn't the style's blue fallback, and colors its vertex handles to match;
- dots every placed vertex in its own source (`draw-draft-vertices` / `measure-draft-vertices`), since Draw only shows the newest one. Draw's draft ends with the point under the cursor, and a polygon then closes back to its first vertex, so those trailing points are left out.

`clear()` empties it when a shape finishes or the tool changes, and `remove()` takes its layer off on close.

## The keep-on-close overlay (measure)

`widgets.measure.persistOnClose` keeps finished measurements on the map after the widget closes. Draw only renders while it's attached, so `destroy(persist = true)` copies the shapes and labels into plain GeoJSON layers (the "persist overlay") before removing Draw. Reopening the widget hands drawing back to Draw and removes the overlay with `uninstallPersistOverlay()` (`removeOverlay` underneath), both through the swap above.

## Popups while drawing

Both widgets call `useMapClickLock` while a tool is out or a feature is being edited (`activeTool !== null || editingId !== null`), so popups don't open on clicks meant for the tool, and the popup handler leaves the widget's crosshair alone. A widget that's open but idle doesn't hold the lock. Escape and finishing a shape both report back through `onFinish`, which releases it. See [Popups](popups.md).

## Drop shadows

Measure draws a soft shadow under every measured line and polygon outline: a `measure-shadow` entry first in its Draw style array, and a matching layer in the keep-on-close overlay, both painted from one `SHADOW_PAINT` in `lib/drawStyles.ts`. Draw's shadow is per drawing: `shadow` and `shadowIntensity` on its style, read as `user_shadow` by a `draw-shadow` style entry while editing, and drawn by the Drawings layer's `-shadow` sublayer afterward. `shadowPaint()` scales opacity with intensity, so 50% matches Measure's shadow. `-shadow` is one of the sublayer suffixes `setLayerVisibility` walks, so shadows hide with the Drawings layer.

## Drawings as a layer (draw)

The draw widget adds a "Drawings" row to the layer list. While drawings exist, it writes `LayerMetadata` with id `__drawings__` to the store, and removes it when there are none. The metadata sets `labelIsGeometry: true`, so text drawings, which use the `-label` sublayer, show and hide with the layer instead of through a separate labels button. See [`setLayerVisibility(includeLabel)`](layers.md#layer-operations-layeropsts).

With the widget closed, the drawings stay on the map the same way as Measure's overlay. When it's drawn on close, the layer takes its visibility and opacity from the store, so hiding Drawings in the layer list carries over.

Saved sets and downloads are built on top. Saved sets use the shared `@/ui/useSavedItems` hook, the same one Bookmarks uses. `exportDrawings()` returns a copy of the drawings, so a saved set only changes when the user saves or overwrites it. Download opens `@/ui/ChoiceDialog` with the formats from `allowedExportFormats` (`core/export/download.ts`, which also holds `EXPORT_FORMATS`, the list the layer list's Export Data shares). `lib/exportGeoJSON.ts` builds the FeatureCollection, with just `id` (renumbered 1..n), `name` and `shape_type` per feature; GeoParquet is that collection through `core/export/writeGeoParquet.ts` (hyparquet-writer, imported on first use, typed columns plus GeoParquet `geo` metadata). `lib/exportKML.ts` writes KML with each drawing's own style, using the shared helpers in `core/export/writeKML.ts` (color conversion to KML's `aabbggrr`, geometry, escaping). `core/export/download.ts`'s `downloadFile` saves the result. Saved sets are stored per app, using [`branding.appId`](theme-storage.md#storage-corestoragekeyts).
