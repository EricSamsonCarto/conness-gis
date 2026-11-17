---
icon: lucide/navigation
---

# Map Controls

The `mapControls` block in your project's `settings.json` adds MapLibre's built-in controls to the map's corners: zoom buttons, a "locate me" button, fullscreen, a scale bar, a globe toggle and a terrain toggle. They're separate from the kit's [floating widgets](../widgets/placing-widgets.md), though both can share the same corners.

Include a control's key to add it, and leave the key out to skip it. Without a `mapControls` block there are no built-in controls.

!!! tip "In the editor"
    Each control is an on/off block under **Map Controls**, with its position and options. **Arrange corners**, at the top of the group, orders each corner's controls and floating widgets, and moves them between corners by dragging.

```json
"mapControls": {
  "navigation": { "position": "top-left" },
  "geolocate": { "position": "top-right", "trackUserLocation": true },
  "globe": { "position": "top-right" }
}
```

## Controls

| Key | Control | Default position |
|---|---|---|
| `navigation` | Zoom +/− buttons and a compass | `top-left` |
| `geolocate` | "Locate me" button (browser geolocation) | `top-left` |
| `fullscreen` | Toggles browser fullscreen on the map | `top-right` |
| `scale` | A distance scale bar | `bottom-left` |
| `globe` | Switches between globe and flat (mercator) | `top-right` |
| `spin` | Pauses and plays the globe's spin | `top-right` |
| `terrain` | Toggles 3D terrain | `top-right` |
| `zoomLevel` | Shows the current zoom, e.g. `z 12.4` | `bottom-left` |

All eight take an optional `position`: `"top-left" | "top-right" | "bottom-left" | "bottom-right"`, and an optional `order` (default `0`) that sets their place in the corner: lower comes first. Controls with the same `order` keep the kit's own order (navigation, geolocate, fullscreen, globe, spin, scale, zoom level, terrain). See [Ordering a corner](#ordering-a-corner).

## Per-control options

### `navigation`

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `top-left` | Corner |
| `showZoom` | `boolean` | `true` | Show the +/− zoom buttons |
| `showCompass` | `boolean` | `true` | Show the compass |
| `visualizePitch` | `boolean` | `true` | The compass tilts with the map, and one click on it returns to a flat, north-up view. `false` gives MapLibre's plain compass, where a click only turns north (MapLibre's own default is `false`) |

### `geolocate`

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `top-left` | Corner |
| `trackUserLocation` | `boolean` | `false` | Keep following the user as they move |
| `showUserLocation` | `boolean` | `true` | Show the location dot |
| `showUserHeading` | `boolean` | `false` | Show a heading cone |
| `showAccuracyCircle` | `boolean` | `true` | Show the accuracy halo |

### `scale`

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `bottom-left` | Corner |
| `style` | `"classic" \| "minimal" \| "alternating" \| "pill"` | `"classic"` | The bar's look (below) |
| `unit` | `"metric" \| "imperial" \| "nautical" \| "both"` | `"metric"` | Distance unit. `both` shows metric with imperial under it |
| `maxWidth` | `number` | `100` | Max bar width in pixels |

The bar always shows a round distance (1, 2, 3 or 5 times a power of ten) and shrinks below `maxWidth` to match it.

| Style | Looks like |
|---|---|
| `classic` | MapLibre's own box with a border on three sides |
| `minimal` | The distance above a thin line with end ticks, no box |
| `alternating` | A segmented cartographic bar, with 0 and the halfway distance under it and the full distance past its end |
| `pill` | The distance and a short line in a rounded chip, like the floating buttons |

Every style takes its colors from the theme. The lines and text are the map controls' icon color at full strength (black, or white with `mapControlIcons: "white"`), and an outline in the controls' background (`mapControlBg`, else `panelBg`) keeps them readable on light and dark basemaps. The text is [`ui.textSizes.medium`](ui-layout.md#text-sizes-uitextsizes).

### `fullscreen` and `globe`

Both take only `position`. Turning the globe on or off can take a moment while the map redraws, so the globe button shows a spinner in place of its icon until the map has drawn.

### `spin` { #spin }

A pause / play button for the globe's [auto-spin](map-camera.md#globe-projection). It shows only while `map.globe.spin` is set, and takes only `position` and `order`. The icon is a globe with a turning arrow, with pause bars while it spins and a play triangle while it's paused.

In the editor its switch is in **Map** › **Globe**, under the spin settings, as **Pause / play button**. Its place in the corner is set in **Arrange corners**, where it's called **Globe spin**.

### `zoomLevel` { #zoom-level }

A small read-only readout of the current zoom (`z 12.4`), updating as the map zooms. Handy when picking a layer's `minZoom` / `maxZoom`. It follows the theme and never takes clicks from the map. In the bottom-left corner it stacks above the scale bar.

```json
"mapControls": {
  "zoomLevel": { "position": "bottom-left", "precision": 1 }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `bottom-left` | Corner |
| `precision` | `number` | `1` | Decimal places shown |

### `terrain`

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `top-right` | Corner |
| `exaggeration` | `number` | `1` | Elevation multiplier. Higher values make terrain more dramatic |
| `enabled` | `boolean` | `false` | Start with terrain on. The button can still turn it off. In the editor it's under Exaggeration |
| `source` | object | Mapterhorn | Use a different elevation source (below) |
| `source.tiles` | `string[]` | Mapterhorn's | A raster-DEM tile URL template (a list only for mirrors of the same tiles). Use this or `url`, not both |
| `source.url` | `string` | none | A TileJSON URL, instead of `tiles`. Its tile size and zoom range come from the TileJSON |
| `source.encoding` | `"terrarium" \| "mapbox" \| "custom"` | `"terrarium"` | How elevation is packed into the tile colors: `terrarium` (Mapterhorn, Mapzen), `mapbox` (Mapbox Terrain-RGB), or `custom` |
| `source.tileSize` | `number` | `512` | Tile size in pixels |
| `source.maxzoom` | `number` | `17` | Highest zoom with real tiles. Past it, MapLibre stretches the last tiles instead of requesting more |

Leave out `source` to use [Mapterhorn](https://mapterhorn.com/), free open terrain tiles built from public elevation data (`https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`, terrarium encoding, 512 px tiles up to zoom 17). They're free for commercial use too, as long as they're credited, so the map's credits show "© Mapterhorn", linking to [the page that lists every source](https://mapterhorn.com/attribution).

With your own source, set either `tiles` or `url`. Only `encoding` keeps its `terrarium` default: tile size and max zoom fall back to MapLibre's (512 and 22) unless you set them, and the Mapterhorn credit is dropped, so add your source's own credit to its tiles. In the Conness editor, Terrain source offers the three as one choice, and its URL box shows the URL in use in gray. Typing in it makes a tile URL template of your own, and picking Tile URL template starts from Mapterhorn's.

Like the globe button, the terrain button shows a spinner while terrain turns on or off, until the elevation tiles have loaded and the map has drawn.

## Attribution { #attribution }

The map's credits button is always shown, since the data and tile licenses require it; you can't add or remove it, only move it. It starts expanded and collapses once the user pans the map; the "ⓘ" button expands it again. Its credits always include "Made with Conness GIS", linking to conness-gis.com. They keep MapLibre's light box with dark text on every theme, so they stay readable whatever the controls' colors.

```json
"mapControls": {
  "attribution": { "position": "bottom-left", "order": 1000 }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `position` | `string` | `bottom-right` | Corner |
| `order` | `number` | `1000` | Place in its corner. The high default keeps it at the corner's edge, below (or after) everything else there |

## Ordering a corner

The built-in controls and the kit's [floating widgets](../widgets/placing-widgets.md) share the four map corners, and both take an `order` on one scale: lower stacks first, from the top in a top corner and from the top of the stack in a bottom one. Everything defaults to `0` except the credits button (`1000`), and ties keep the controls first, then the floating widgets. Give a floating widget a negative `order` to lift it above the controls (the demo's search widget does this; see [Building a Custom Widget](../guides/custom-widget.md#floating-placement)), or give a control a higher one to push it below a widget.

```json
"mapControls": {
  "navigation": { "position": "top-right", "order": 2 },
  "globe": { "position": "top-right", "order": 1 }
}
```
