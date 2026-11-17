---
icon: lucide/list-tree
---

# Legend

Shows symbology for the layers that are currently visible: single swatches, category lists and gradient bars, each shaped for its geometry (dot, line or square).

- id: `legend`
- Surfaces: `side-panel`, `top-bar`

## Place it

In the editor, turn on **Legend** under **Widgets** and pick its **Where**. By hand:

```json
"sidePanelWidgets": [{ "widgetName": "legend" }]
```

## Behavior

- Only visible layers with kit symbology or a [`legend`](../configuration/adding-layers.md#custom-legend) appear. Raster layers and Esri layers using the service's own styling have nothing for the legend to read, so they're skipped unless they set `legend`.
- Layers with `simple` symbology get one swatch, shaped by `geometryType` and drawn at the symbology's `opacity` and `strokeOpacity`. A layer without `geometryType` (mixed geometry) gets a small dot, line and square side by side in its color.
- Categorized and graduated layers (`raw` symbology with `match` or `interpolate` expressions) become a category list or a gradient bar.
- When a `raw` symbology also sizes its dots (`circle-radius`) or lines (`line-width`) by a data column, a row of sizes sits under the colors: one dot or line per stop, with its value, spread across the panel like the gradient bar. They're in the layer's color when that doesn't change, otherwise in a neutral gray, so size reads apart from color.
- A layer's `symbology.description` appears as a muted line under its name, e.g. *"Annual passengers"*.
- Order: layers with `raw` symbology or their own `legend` first, then points, lines and polygons, keeping your layer order within each.
- A [PMTiles](../configuration/adding-layers.md#pmtiles) layer that draws several source layers gets its own block after the other layers: the layer's name as a header, with its visible source layers indented below in draw order. Hidden source layers drop out, and the block disappears when none are visible.

## Controlling what shows

- Set [`legend`](../configuration/adding-layers.md#custom-legend) on any layer or PMTiles source layer to choose its swatches (categories or a gradient), or to bring a raster or service-styled Esri layer into the legend. It wins over a [`raw` symbology's `legend`](../configuration/symbology.md#legend-overrides).
- Hide a layer from the legend, but keep it on the map, with [`"hideFromLegend": true`](../configuration/adding-layers.md#hiding-a-layer-from-the-legend). It works with any symbology.

The legend has no settings block of its own. Everything comes from your layers' symbology and `legend` fields.
