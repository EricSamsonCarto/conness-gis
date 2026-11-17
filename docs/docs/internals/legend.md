---
icon: lucide/list-tree
---

# Legend

The legend turns a layer's symbology into swatches. The logic is in `app/src/core/legend/introspect.ts` and the rendering in `app/widgets/legend/Widget.tsx` (the `LegendWidget` component).

## The swatch model

`legendForLayer(layer)` returns a `LegendSwatch`, or `null` for a layer with neither a `legend` nor symbology. A layer's own `legend` wins (raster layers get square category swatches); otherwise `legendForSymbology(symbology, geometryType)` reads the symbology:

| Kind | Comes from | Renders |
|---|---|---|
| `single` | `simple` symbology | One swatch shaped by `geometryType` (dot, line or square) |
| `categories` | a `match` expression, or a `categories` override (layer or `raw`) | A list of labeled swatches |
| `gradient` | an `interpolate` expression, or a `gradient` override (layer or `raw`) | A continuous bar |
| `hidden` | `legend: { kind: 'hidden' }` | Nothing |
| `unknown` | `raw` paint the legend can't read | A plain "custom" marker |

The swatch shape comes from the layer's `geometryType`, not from symbology fields, so a stray `radius` on a polygon layer can't produce the wrong shape.

## Reading raw paint

For `raw` symbology without a `legend` override, the legend reads the paint:

1. `findColorExpression` finds the first color property whose value is an expression, checking `circle-color`, then `fill-color`, then `line-color`.
2. A `['match', ['get', prop], val, color, …, fallback]` becomes category entries.
3. An `['interpolate', …, ['get', prop], stop, color, …]` becomes gradient stops.
4. Anything else becomes `unknown`: the legend shows a "custom" marker, and the author can add an override.

Sizes are read alongside: `sizeStops(paint)` in `core/legend/sizes.ts` turns a `circle-radius` (else `line-width`) `interpolate` on a data input into `{ kind: 'dot' | 'line', stops }`, and skips zoom curves. `introspectRaw` puts it on the swatch as `sizes`, for `single`, `categories` and `gradient` alike, and an override `legend` leaves it out. The widget's `SizeRow` draws one dot (2 × the radius across, capped at 28 px) or line per stop under the color part, spread edge to edge. It's in the layer's color when the color is a single value, else in `--color-text`. `sizes.ts` has no imports, so `sizes.test.ts` runs it under plain Node.

An explicit `legend` override always wins: the layer's first, then the `raw` symbology's.

## What the widget renders

`LegendWidget` keeps layers that are visible, have kit `symbology` or a `legend`, and don't set `hideFromLegend`. Raster layers and Esri layers using the service's own styling have no `symbology`, so they're skipped unless they set `legend`. It then sorts: layers with `raw` symbology or their own `legend` first, then points, lines and polygons, keeping the declared order within each.

The layer's `legend` travels like `hideFromLegend`: copied into `LayerMetadata` by `recordLayer`. PMTiles and `tiles` source layers carry their own (`resolveSpec` in `loaders/vectorTiles.ts`); they don't inherit the archive's, except a lone source layer, which is the layer itself.

A layer's `symbology.description` (a `raw` field) appears as a muted line under its name in category and gradient legends.

## Hiding a layer

- `legend: { kind: 'hidden' }` on the layer, or on `raw` symbology, produces a `hidden` swatch.
- `hideFromLegend: true` on the layer removes it before the legend reads anything, whatever its symbology. It's copied into `LayerMetadata` and checked in the widget's filter.
