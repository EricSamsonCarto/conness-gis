---
icon: lucide/map
---

# Basemap

Switches the basemap. It lists every entry in `settings.basemaps` with a thumbnail and name. Picking one swaps the basemap's layers underneath yours, so your layers, popups, drawings, and any visibility or opacity changes aren't touched. The picked basemap is highlighted at once, and a spinner shows over its thumbnail until the map has drawn it. If its style can't load, the highlight goes back to the basemap still on the map, and the console says why. Restoring a bookmark switches basemaps the same way. Clicking the active basemap does nothing. The widget also has switches for [No Basemap](#no-basemap), [Hillshade](#hillshade) and [Contours](#contours). On phones the list uses smaller thumbnails so more basemaps fit, and the switches come after the list.

- id: `basemap`
- Surfaces: `top-bar`, `side-panel`

## Place it

In the editor, turn on **Basemap** under **Widgets** and pick its **Where**. By hand:

```json
"sidePanelWidgets": [{ "widgetName": "basemap" }]
```

or

```json
"topBarWidgets": [{ "widgetName": "basemap" }]
```

## Configuration

The list comes from the top-level [`basemaps`](../configuration/map-camera.md#basemaps) array:

```json
"basemaps": [
  { "id": "positron-openfreemap", "name": "Positron (OpenFreeMap)", "style": "https://tiles.openfreemap.org/styles/positron" },
  { "id": "liberty-openfreemap", "name": "Liberty (OpenFreeMap)", "style": "https://tiles.openfreemap.org/styles/liberty" }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique id, also used to find the thumbnail |
| `name` | `string` | Name in the switcher |
| `style` | `string \| StyleSpecification` | Style URL or inline style object |
| `thumbnail` | `string` | Optional: an image's name in the project's `basemap-images/` folder (or the catalog's), or an image URL (see [Thumbnails](#thumbnails)) |

[Basemaps](../configuration/map-camera.md#basemaps) has the full field list. A new project starts with five basemaps; the widget's catalog (`app/widgets/basemap/catalog.json`) has all 17, listed in the [default catalog](../configuration/map-camera.md#default-catalog). In the Conness editor, Basemap → Basemaps → Add basemap offers the catalog's basemaps a project doesn't have, or your own style URL.

## No Basemap

The No Basemap switch turns the basemap off, so only your data shows, drawn on [`map.backgroundColor`](../configuration/map-camera.md) (black unless you set one). Your labels keep drawing with the last basemap's fonts. Turning the switch off brings back the basemap that was on before. Picking a basemap from the list does the same. Bookmarks remember it.

It sits in one group with the Hillshade and Contours switches. On desktop the group is pinned above the list. On phones it comes after the list, so the basemaps show first on a small screen.

Hide the switch with `widgets.basemap`:

```json
"widgets": {
  "basemap": {
    "showNone": false
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `showNone` | `boolean` | `true` | Show the No Basemap switch |

## Hillshade { #hillshade }

The Hillshade switch shades the terrain so hills and valleys stand out. It's in the same group as [No Basemap](#no-basemap). A spinner shows beside it while the shading loads.

The shading is drawn over the basemap and under your data, so your layers stay on top and the basemap is never faded. MapLibre draws it from [Mapterhorn](https://mapterhorn.com/)'s free elevation tiles, the same source the [terrain](../configuration/map-controls.md#terrain) button uses, and the map's credits show "© Mapterhorn" while it's on. The defaults follow Mapterhorn's own hillshade example. Switching basemaps keeps the shading in place.

```json
"widgets": {
  "basemap": {
    "hillshade": { "enabled": true, "opacity": 0.5 }
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Turn the hillshade on when the app loads, even with no Basemap widget placed |
| `showToggle` | `boolean` | `true` | Show the Hillshade switch in the widget. Turn it off to keep the shading always on (with `enabled`) or never offered |
| `opacity` | `number` | `0.5` | How strong the shading is, 0 to 1. MapLibre's hillshade has no opacity of its own, so this scales the alpha of the three colors |
| `exaggeration` | `number` | `0.5` | How much the shading exaggerates the terrain, 0 to 1 |
| `method` | `"standard" \| "basic" \| "combined" \| "igor" \| "multidirectional"` | `"standard"` | MapLibre's shading method. `igor` keeps flat ground clear |
| `highlightColor` | `string` | `"rgb(255, 255, 228)"` | Color of slopes facing the light |
| `shadowColor` | `string` | `"rgb(114, 124, 131)"` | Color of slopes facing away |
| `accentColor` | `string` | `"#000000"` | Color of the steepest slopes, with the `standard` method |
| `source` | object | Mapterhorn | Elevation tiles to shade, the same fields as the terrain button's [`source`](../configuration/map-controls.md#terrain) |

!!! tip "In the editor"
    These are in the **Hillshade** pop-out under Basemaps, in the Basemap widget's block: On at load, Toggle in widget, Opacity, Shading strength and Shading method, then the three colors (with color pickers) and Elevation source under Advanced. Elevation source opens the same screen as the terrain button's Terrain source.

## Contours { #contours }

The Contours switch draws elevation lines with labels. It's in the same group as Hillshade. The lines are drawn in the browser by [maplibre-contour](https://github.com/onthegomap/maplibre-contour) from Mapterhorn's elevation tiles, the same tiles Hillshade uses. That code only loads the first time someone turns the lines on. They sit above the hillshade and under your data, and the map's credits show "© Mapterhorn" while they're on. The defaults follow Mapterhorn's own contour example.

```json
"widgets": {
  "basemap": {
    "contours": { "enabled": true, "unit": "feet" }
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Turn the contours on when the app loads, even with no Basemap widget placed |
| `showToggle` | `boolean` | `true` | Show the Contours switch in the widget |
| `unit` | `"meters" \| "feet"` | `"meters"` | Unit of the intervals and labels |
| `minZoom` | `number` | `10` | Zoom the lines appear from |
| `labels` | `boolean` | `true` | Label the lines with their elevation and unit |
| `labelMinZoom` | `number` | `minZoom` | Zoom the labels appear from |
| `labelMaxZoom` | `number` | no limit | Zoom the labels hide past |
| `labelSize` | `number` | the label defaults' font size, else `12` | Label size in px |
| `lineColor` | `string` | `"rgb(215, 151, 60)"` | Line color |
| `labelColor` | `string` | `"rgb(172, 120, 48)"` | Label color, drawn on a white halo |
| `width` | `number` | `1` | Width of the major lines in px. Minor lines are half as wide |
| `thresholds` | object | per unit | Line intervals by zoom, `{ "12": [100, 500] }` draws a line every 100 and a major line every 500 from zoom 12 up. Meters default to `{ 10: [200, 1000], 12: [100, 500], 14: [20, 100] }`, feet to `{ 10: [500, 2500], 12: [250, 1000], 14: [50, 250] }` |
| `source` | object | Mapterhorn | Elevation tiles to draw from, as a tile URL template. A TileJSON `url` doesn't work here |

!!! tip "In the editor"
    These are in the **Contours** pop-out under Hillshade, in the Basemap widget's block. `thresholds` and `source` are under Advanced. The editor shows `thresholds` read-only, so change it in `settings.json`.

## Thumbnails { #thumbnails }

Each basemap's thumbnail is found by name: its `thumbnail` if set, else its `id`. The widget looks first in the project's own `basemap-images/` folder (`app/projects/<name>/basemap-images/`), then in its catalog folder (`app/widgets/basemap/assets/basemap-images/`), for a file with that exact name or that name plus `.jpg`, `.jpeg`, `.png` or `.webp`. A `thumbnail` that's a URL is used as is. A missing image shows a plain placeholder. Every catalog basemap has a thumbnail.

To give a basemap your own image, put it in the project's `basemap-images/` folder, named after the basemap's `id` (or set `thumbnail` to its file name). The editor's Thumbnail picker lists the project's and the catalog's images, and its Upload saves into that folder.

A build carries only the thumbnails of the project's own basemaps. Images are cropped to a square from the center, so roughly square screenshots line up. Save them as color (RGB) JPEG or PNG: Chrome can leave grayscale JPEGs blank at thumbnail size.
