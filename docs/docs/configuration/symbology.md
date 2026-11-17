---
icon: lucide/paintbrush
---

# Symbology

Symbology is how a layer is drawn, including its opacity. Every layer has a `symbology` field (Esri layers can leave it out). PMTiles and tile-server layers have none of their own: each of their [source layers](adding-layers.md#source-layers) has one instead, or an automatic color. You can write `simple` or `raw` symbology inline, or use `ref` to point at a named entry in your project's `symbology.json`. Inline `simple` symbology on a layer in `layers.json`:

```json
"symbology": { "kind": "simple", "color": "#2c8a3e", "strokeColor": "#fff", "strokeWidth": 1 }
```

!!! tip "In the editor"
    A layer's **Style** screen picks Simple, a named entry from `symbology.json`, or the automatic or service colors where a layer allows them, and edits a simple style's colors and widths. Named and `raw` styles are written in `symbology.json` by hand; the editor shows a raw inline style read-only.


A reference to a named entry in `symbology.json`:

```json
"symbology": { "kind": "ref", "name": "airports-by-passengers" }
```

## `simple`

One color plus a few paint options. What each field does depends on the layer's geometry. Colors take any CSS color: `"#0891b2"`, `"white"` or `"rgba(8, 145, 178, 0.5)"`.

| Field | Type | Default | Applies to |
|---|---|---|---|
| `color` | `string` | required | point: dot fill · line: line color · polygon: fill color |
| `width` | `number` | `2` | line width |
| `radius` | `number` | `5` | point dot radius |
| `strokeColor` | `string` | `#ffffff` | point: ring color · polygon: border color |
| `strokeWidth` | `number` | `1` (point), `0` (polygon) | point: ring width · polygon: border width (0 = no border) |
| `opacity` | `number` (0 to 1) | `1` | opacity of `color`: dot fill, line, polygon fill |
| `strokeOpacity` | `number` (0 to 1) | `1` | opacity of `strokeColor`: point ring, polygon border. Lines have no stroke |

A point layer:

```json
"symbology": { "kind": "simple", "color": "#0891b2", "radius": 6, "strokeColor": "#fff", "strokeWidth": 3 }
```

A translucent polygon layer with a visible outline:

```json
"symbology": { "kind": "simple", "color": "#838291", "opacity": 0.4, "strokeColor": "#fff", "strokeWidth": 1 }
```

These two opacities are the layer's styling. The layer list's Adjust Transparency fades the whole layer on top of them, fill and outline together, starting at 100%.

Polygon borders only draw on layers known to be polygons: `"geometryType": "polygon"`, or a PMTiles source layer whose archive records it. A layer without `geometryType` is treated as mixed and draws polygon fills, lines and points with this one style, but no borders.

!!! note "Simple symbology carries into KML"
    When a layer is exported as KML from the [Layer List](../widgets/layer-list.md#exporting-data), `simple` symbology's colors, widths and opacities go with it. `raw` symbology doesn't (each feature would need its own style), so those layers export with the viewer's default styling.

## `raw`

A MapLibre paint object, with full control, including data-driven expressions for categorized and graduated styling. Use it when `simple` isn't enough.

| Field | Type | Description |
|---|---|---|
| `paint` | object | A MapLibre paint object (e.g. `circle-color`, `fill-color`, `line-width`) |
| `layout` | object | Extra MapLibre layout properties |
| `legend` | object | An explicit legend (below) |
| `description` | `string` | A short muted note under the layer name in the legend, e.g. `"Annual passengers"`. Reads better than a raw column name |

Raw paint is written for one kind of MapLibre layer, so it draws one geometry. If the layer has no `geometryType`, the kit reads it from the paint's property names: `circle-*` for points, `fill-*` for polygons (with `line-*` as their outline), `line-*` for lines. If the paint mixes `circle-*` with `fill-*` or `line-*`, or has none of them, the layer is skipped and the console asks for a `geometryType`. A polygon's paint can mix `fill-*` keys with `line-*` keys for its outline: the fill takes the `fill-*` keys and the outline the `line-*` ones (`layout` keys split the same way). With no `line-*` keys, the polygon draws no outline. The layer list's Adjust Transparency multiplies the paint's `*-opacity` values, except zoom-based `interpolate` or `step` expressions, which stay as written.

### Categorized (a `match` expression)

The last color is for every other value.

```json
{
  "kind": "raw",
  "description": "Energy source",
  "paint": {
    "circle-color": [
      "match", ["get", "primsource"],
      "solar", "#f59e0b",
      "wind", "#22c55e",
      "natural gas", "#60a5fa",
      "coal", "#78716c",
      "#94a3b8"
    ],
    "circle-radius": 4,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 0.5
  }
}
```

### Graduated (an `interpolate` expression)

```json
{
  "kind": "raw",
  "description": "Annual passengers",
  "paint": {
    "circle-color": [
      "interpolate", ["linear"], ["get", "passengers"],
      0, "#bfdbfe", 2000000, "#60a5fa", 8000000, "#2563eb", 20000000, "#1e3a8a"
    ],
    "circle-radius": [
      "interpolate", ["linear"], ["get", "passengers"],
      0, 4, 2000000, 7, 8000000, 11, 20000000, 16
    ]
  }
}
```

The legend reads common `match` and `interpolate` expressions on color properties and turns them into category swatches or a gradient bar. When `circle-radius` or `line-width` interpolates on a data column too, the legend adds a row of dots or lines under the colors, one per stop with its value. Sizes that change only with zoom aren't shown. For anything it can't read, add an explicit `legend` (below).

## `ref`

Points at a named entry in your project's `symbology.json`, so several layers can share one definition that you edit in one place.

```json
"symbology": { "kind": "ref", "name": "airports-by-passengers" }
```

Your project's `symbology.json` maps names to `simple` or `raw` symbology:

```json
{
  "$schema": "../../schema/symbology.schema.json",
  "airports-by-passengers": {
    "kind": "raw",
    "description": "Annual passengers",
    "paint": { "circle-color": "#2563eb", "circle-radius": 6 }
  }
}
```

If a layer names an entry that doesn't exist, no layers load, and the browser console names the missing entry and lists the ones that exist.

## Legend overrides { #legend-overrides }

If the legend can't read your `raw` paint, or you want to choose exactly what it shows, add a `legend` field. It takes one of three shapes. Any layer can also set the same field on itself, whatever its symbology (see [Custom legend](adding-layers.md#custom-legend)); the layer's wins.

Discrete swatches:

```json
"legend": {
  "kind": "categories",
  "entries": [
    { "label": "Solar", "color": "#f59e0b" },
    { "label": "Wind", "color": "#22c55e" }
  ]
}
```

A continuous gradient bar:

```json
"legend": {
  "kind": "gradient",
  "stops": [
    { "value": 0, "label": "Low", "color": "#bfdbfe" },
    { "value": 20000000, "label": "High", "color": "#1e3a8a" }
  ]
}
```

Leave this raw layer out of the legend:

```json
"legend": { "kind": "hidden" }
```

!!! tip "Hiding any layer from the legend"
    Here, `"legend": { "kind": "hidden" }` belongs to a `raw` symbology. To hide a layer with any kind of symbology, set [`"hideFromLegend": true`](adding-layers.md#hiding-a-layer-from-the-legend) or `"legend": { "kind": "hidden" }` on the layer itself.
