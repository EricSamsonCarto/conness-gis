---
icon: lucide/layers
---

# Layer List

Turns layers on and off, with a menu on each row for zoom, labels, transparency, filters and export. Layers appear in their `layers.json` order, grouped by their `group` field. The same order sets which layer draws on top (see [Adding Layers](../configuration/adding-layers.md)).

- id: `layer-list`
- Surfaces: `side-panel`, `top-bar`

## Place it

In the editor, turn on **Layer List** under **Widgets** and pick its **Where**. By hand:

```json
"sidePanelWidgets": [{ "widgetName": "layer-list" }]
```

## Behavior

- Each layer has an eye (or checkbox) toggle. With `rowClickToggle` on, the default, clicking anywhere on the row toggles the layer. While a layer's data is still on its way, a small spinner takes the eye's place: on the first toggle of a layer deferred by [`map.onlyVisibleOnLoad`](../configuration/map-camera.md#load-only-visible-layers), and while DuckDB layers refill after a basemap switch.
- The ⋮ button on each row opens the layer's menu. Near the bottom of the panel or the screen, it opens upward so it stays in view. A layer with nothing to offer (every item turned off, or none it supports) has no ⋮:
    - **Zoom to Extent** fits the map to the layer's data, or to the filtered features if a filter is on. Esri raster services read their extent from the service. Extents in Web Mercator are converted to degrees. If the service gives no extent, or one in another projection, the item does nothing.
    - **Labels** turns the layer's labels on and off. Only on layers with a [`label`](../configuration/adding-layers.md#labels) config.
    - **Adjust Transparency** opens an opacity slider under the row. ✕ closes it. It starts at 100% and fades the whole layer (fill and outline together) on top of the opacity set in its [symbology](../configuration/symbology.md).
    - **Filter** opens the [filter panel](#filtering). Only on layers with [`filters`](../configuration/adding-layers.md#filtering).
    - **Export Data** asks which format to download (see [Exporting data](#exporting-data)). Only on `geojson` and `geoparquet` layers. A GeoParquet layer with a `limit` exports only the rows it loaded.
    - **Zoom Range** opens a slider under the row that changes the zooms the layer shows at, to see it closer or farther out than it's set to. Its two thumbs move the layer's start and end zoom, anywhere between the map's own `minZoom` and `maxZoom`, and a tick marks the current zoom. Reset puts back the configured range, and ✕ closes the slider. The change lasts until the page reloads, and bookmarks don't save it. A label with a later [`label.minZoom`](../configuration/adding-layers.md#labels) still waits for its own zoom. Off by default: turn it on with `"actions": { "visibilityZoom": true }`. It only appears on layers with a `minZoom` or `maxZoom`.
- Layers with the same `group` sit under a header with its own toggle, which shows a half state when only some of them are on. Click the header to expand or collapse the group. An open group's layers sit on a faintly tinted band with a guide line, their toggles lined up under the header's.
- A [PMTiles](../configuration/adding-layers.md#pmtiles) layer that draws several source layers looks like any other row, plus a chevron. It starts collapsed (set `"collapsed": false` on the layer to start it open). Expanded, its source layers appear one step further in, in draw order, on the same tinted band, each with its own toggle and menu (Zoom to Extent, Labels, Adjust Transparency). The parent's toggle works like a group header's, with a half state when only some are on, and its menu has Zoom to Extent (the whole archive) and Adjust Transparency (sets every source layer at once). These rows can sit inside a group.
- A layer's name turns gray when the map's zoom is outside its `minZoom`/`maxZoom` range.

Visibility, opacity, labels and filters all carry over when the basemap changes.

## Exporting data { #exporting-data }

Export Data opens a pop-up with the formats in `exportFormats` ([Configuration](#configuration)) (all four by default). Every format contains the layer's features with all their properties. If a filter is on, only the features that pass it, and the pop-up says so. The file is named after the layer.

| Format |  |
|---|---|
| GeoJSON | Geometry and every property, no styling |
| KML | Opens in Google Earth. Keeps the layer's colors for `simple` symbology (see below), every property under each placemark |
| GeoParquet |The geometry column is `geometry`, so a property with that name is written as `geometry_attr`, and whole numbers too large for a 64-bit integer are written as decimals. |
| CSV | Every property as a column, plus `longitude` / `latitude` for points and a `wkt` column for lines and polygons. A property already named one of those is renamed (`longitude_1`, …), so no column name repeats.  |

With one format in `exportFormats`, Export Data downloads it directly instead of asking.

!!! note "KML styling only covers simple symbology"
    A layer with [`simple` symbology](../configuration/symbology.md) exports its line color, width and opacity, polygon fill and border, and point color and size. Categorized or graduated layers (`raw` symbology) export with the viewer's default styling, since that would need a separate style per feature. This is a deliberate limit. If you need it, `app/src/core/export/writeKML.ts` (`featuresToKML`) is the place to add a style per category.

## Filtering { #filtering }

- **Toggles.** "Filter this layer" turns the whole layer's filtering on and off, and each column has its own toggle. The layer toggle turns on the first time you open the panel. Turning a toggle off pauses that filter but keeps its values.
- **Categorical columns** show a checklist of the column's values, all unchecked at first. Checked values move to the top, lists of more than 10 values get a search box. Clear unchecks everything.
- **Numeric columns** take one condition: `>`, `≥`, `<`, `≤`, `=`, `≠` or `between` (inclusive). It applies on Enter, when the box loses focus, or after a short pause in typing. Invalid input, like text or a minimum above the maximum, gets a red outline and is ignored.

Filters on different columns combine with AND, and every change applies right away. While a filter is on, a funnel icon appears next to the row's ⋮ button. Clicking it reopens the filter panel.

A filter also limits Zoom to Extent, Export Data, [layer search](search.md) and popups, since only visible features can be clicked. The legend doesn't change. Filters reset when the page reloads.

## Configuration: `widgets["layer-list"]` { #configuration }

```json
"widgets": {
  "layer-list": {
    "toggleStyle": "eye",
    "actions": { "opacity": true, "labels": true, "zoomToExtent": true, "filter": true, "export": true },
    "rowClickToggle": true,
    "groupsCollapsedByDefault": true,
    "exportFormats": ["geojson", "kml", "geoparquet", "csv"]
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `toggleStyle` | `"eye" \| "checkbox"` | `"eye"` | The control that shows and hides layers |
| `actions` | object: `opacity`, `labels`, `zoomToExtent`, `filter`, `export`, `visibilityZoom` (each `boolean`) | all on except `visibilityZoom` | Which items appear in each row's menu. Labels only appears on layers with a `label` config, Filter only on layers that declare `filters`, Export Data only on `geojson` and `geoparquet` layers, and Zoom Range only on layers with a `minZoom` or `maxZoom` |
| `rowClickToggle` | `boolean` | `true` | A click anywhere on a layer row toggles the layer, not only a click on the eye or checkbox. Group headers aren't affected |
| `groupsCollapsedByDefault` | `boolean` | `true` | Whether layer groups start collapsed |
| `exportFormats` | list of `"geojson"`, `"kml"`, `"geoparquet"`, `"csv"` | all four | Formats Export Data offers, in this order. With one, Export Data downloads it directly instead of asking. An empty list means all |

Set collapse per group with the top-level `layerGroups` block (`"layerGroups": { "ESRI Services": { "collapsed": false } }`), and override menu items per layer with the layer's [`actions`](../configuration/adding-layers.md#common-fields-every-layer-type) field. A layer's setting wins over the global one.