---
icon: lucide/map-pinned
---

# Map & Camera

The `map` block in your project's `settings.json` sets the starting view, camera limits and the optional globe.

!!! tip "In the editor"
    These are under **Map**: Starting View (center, zoom, bearing and pitch, then the basemap, with the zoom limits, max bounds and background color (with a color picker) under its Advanced), Globe, and Navigation for scroll to zoom. **Use current view**, under Pitch, copies the preview's center, zoom, bearing and pitch into the starting view, so you can tilt and turn the preview into a 3D view and keep it. A bearing or pitch of 0 is left out of `settings.json`, since 0 is the default. **Load only visible layers** (`onlyVisibleOnLoad`) is under **Layers**.

```json
"map": {
  "style": "https://tiles.openfreemap.org/styles/positron",
  "center": [-98.5, 39.5],
  "zoom": 4
}
```

## Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `style` | `string \| object` | required | The starting basemap: a URL to a MapLibre style JSON, or an inline style object |
| `center` | `[lng, lat]` | required | Starting map center |
| `zoom` | `number` | required | Starting zoom level |
| `pitch` | `number` | `0` | Starting tilt in degrees. 0 looks straight down. Use it for 3D or oblique views |
| `bearing` | `number` | `0` | Starting rotation in degrees |
| `backgroundColor` | `string` | `"#000000"` | Fill behind the map. Shows past the globe's edge, past a flat map's edges, before tiles load, and everywhere when the Basemap widget's [No Basemap](../widgets/basemap.md#no-basemap) is picked |
| `minZoom` | `number` | `1.5` | How far out the user can zoom |
| `maxZoom` | `number` | `16` | How far in the user can zoom |
| `maxBounds` | `[[west, south], [east, north]]` | none | Keep panning inside a region |
| `globe` | object | none | Globe projection, starry background and auto-spin (see below) |
| `onlyVisibleOnLoad` | `boolean` | `false` | Load only layers visible at startup; hidden data layers load when first turned on (see [below](#load-only-visible-layers)) |
| `scrollZoom` | `boolean` | `true` | Zoom with the mouse wheel or trackpad scroll (see [below](#scroll-zoom)) |

!!! note "Camera limits vs. layer zoom range"
    `map.minZoom` and `map.maxZoom` limit the camera (how far the user can zoom the whole map). A layer's own `minZoom` and `maxZoom` set the zooms at which that layer draws (see [Adding Layers](adding-layers.md)).

!!! warning "World-wide `maxBounds`"
    Don't use exactly `-180` / `180` for longitude; MapLibre crashes on load. Pull it in slightly, e.g. `[[-179.9999, -85], [179.9999, 85]]`.

### Example with camera limits

A camera held to the San Francisco Bay Area:

```json
"map": {
  "style": "https://tiles.openfreemap.org/styles/liberty",
  "center": [-122.4, 37.8],
  "zoom": 11,
  "pitch": 45,
  "minZoom": 9,
  "maxZoom": 18,
  "maxBounds": [[-123.2, 37.2], [-121.6, 38.3]]
}
```

## Scroll zoom { #scroll-zoom }

`"scrollZoom": false` stops the mouse wheel and trackpad scroll from zooming the map, which helps when the map is embedded in a longer page that people scroll past. The zoom buttons, double-click and keyboard still zoom, and pinch zoom on touch screens isn't affected.

## Load only visible layers { #load-only-visible-layers }

By default every layer loads at startup, hidden ones included, and the [loading overlay](ui-layout.md#loading-overlay-uiloader) waits for all of them, so everything is ready when it fades. With many or large hidden layers that makes startup slow. Set `"onlyVisibleOnLoad": true` in `map` to load only the layers visible at startup.

- Hidden `geojson` (by URL or with `duckdb`), `geoparquet` and `flatgeobuf` layers load the first time they're turned on. Until their data is drawn, a small spinner takes the place of their eye in the [Layer List](../widgets/layer-list.md). After that, toggling is instant.
- The loading overlay doesn't wait for them, so startup is faster.
- PMTiles, tile servers, raster layers and Esri services aren't affected: they only ever fetch what's in view, hidden or not.

## Basemaps

`map.style` is the starting basemap. The full list users can switch between is in your project's `basemaps.json`, used by the [Basemap widget](../widgets/basemap.md):

```json
{
  "$schema": "../../schema/basemaps.schema.json",
  "basemaps": [
    { "id": "positron-openfreemap", "name": "Positron (OpenFreeMap)", "style": "https://tiles.openfreemap.org/styles/positron" },
    { "id": "liberty-openfreemap", "name": "Liberty (OpenFreeMap)", "style": "https://tiles.openfreemap.org/styles/liberty" }
  ]
}
```

A `style` can also be an inline MapLibre style object instead of a URL (the demo's Satellite (ESRI) entry is one).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique id, by convention `<name>-<source>` in kebab case (e.g. `positron-openfreemap`). Also the thumbnail filename (see [Basemap widget](../widgets/basemap.md#thumbnails)) |
| `name` | `string` | Name in the switcher, by convention `Name (Source)` |
| `style` | `string \| object` | Style URL or inline style object |
| `thumbnail` | `string` | Optional: an image's name in the project's `basemap-images/` folder (or the catalog's), or an image URL. Omit to use the image named after `id` (see [Basemap widget](../widgets/basemap.md#thumbnails)) |
| `license` | `"commercial-safe" \| "restricted"` | Omit for commercial-safe, the default. See [Commercial Use](commercial-use.md) |

A basemap only provides the map's look. If its style declares a `projection` or a `sky` (VersaTiles styles declare a globe projection), the kit ignores them, so switching basemaps never turns the globe on or off. The projection comes only from the `globe` block below and the [Globe control](map-controls.md).

## Default catalog

The Basemap widget's catalog (`app/widgets/basemap/catalog.json`) has 17 basemaps: [Esri](https://www.esri.com/) World Imagery, five [OpenFreeMap](https://openfreemap.org/) styles and eleven [VersaTiles](https://versatiles.org/) themes. None needs an API key. A new project (and the demo) starts with five of them: Satellite (ESRI), Positron, Liberty, Dark and Natural (VersaTiles). Add others from the catalog in the Conness editor (Basemap → Basemaps → Add basemap), or copy their entries from `catalog.json` into your `basemaps.json`.

| Name | Source | Commercial use |
|---|---|---|
| Satellite (ESRI) | Esri World Imagery | Restricted. See [Commercial Use](commercial-use.md) |
| Positron (OpenFreeMap) | OpenFreeMap | ✅ |
| Liberty (OpenFreeMap) | OpenFreeMap | ✅ |
| Bright (OpenFreeMap) | OpenFreeMap | ✅ |
| Dark (OpenFreeMap) | OpenFreeMap | ✅ |
| Fiord (OpenFreeMap) | OpenFreeMap | ✅ |
| Satellite (VersaTiles) | VersaTiles | ✅ |
| Colorful (VersaTiles) | VersaTiles | ✅ |
| Colorful Dark (VersaTiles) | VersaTiles | ✅ |
| Natural (VersaTiles) | VersaTiles | ✅ |
| Natural Dark (VersaTiles) | VersaTiles | ✅ |
| Muted (VersaTiles) | VersaTiles | ✅ |
| Muted Dark (VersaTiles) | VersaTiles | ✅ |
| Gray (VersaTiles) | VersaTiles | ✅ |
| Gray Dark (VersaTiles) | VersaTiles | ✅ |
| Toner (VersaTiles) | VersaTiles | ✅ |
| Toner Dark (VersaTiles) | VersaTiles | ✅ |

## Globe projection

Add a `globe` block to start the map as a 3D globe, with optional stars, comets, a glow around the edge and an auto-spin. Leave it out for a flat (mercator) map.

```json
"globe": {
  "enabled": true,
  "stars": true,
  "comets": true,
  "atmosphere": true,
  "spin": { "direction": "east", "speed": 6, "continuous": false }
}
```

It goes inside `map`. A speed of 6 degrees per second is about one turn a minute.

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Start on the globe. The [Globe control](map-controls.md) can still switch it at runtime |
| `stars` | `boolean` | `false` | A parallax starfield over `map.backgroundColor` |
| `comets` | `boolean` | `false` | Occasional shooting stars. Needs `"stars": true` |
| `atmosphere` | `boolean` | `true` | A soft glow around the globe's edge |
| `starsZoomCutoff` | `number` | `7.3` | Zoom above which stars and comets hide |
| `spin` | object | none | Auto-spin, starting once the map has finished its first load. Leave it out for no spin |
| `spin.direction` | `"east" \| "west"` | `"east"` | `"east"` matches Earth's real rotation |
| `spin.speed` | `number` | `6` | Degrees of longitude per second |
| `spin.continuous` | `boolean` | `false` | `false` pauses the spin on the first interaction or camera move, and it stays paused until the [`spin` button](map-controls.md#spin) plays it again. `true` pauses it while the user interacts and resumes a moment later. |

!!! note "`atmosphere` defaults to on"
    `atmosphere` is the only field here that defaults to `true`, so a bare `"globe": { "enabled": true }` already shows the glow. Set it to `false` to turn it off.

!!! note "Reduced motion"
    When the device asks for reduced motion, the spin starts paused and comets don't show. The [`spin` button](map-controls.md#spin) still starts it.

!!! note "Zoom cutoff"
    Stars and comets hide above `starsZoomCutoff`. The glow hides earlier, around zoom 3.3, and that isn't configurable.

The stars, comets and glow are adapted from [Leonel J. Dias's globe atmosphere, halo and comets technique](https://leoneljdias.github.io/posts/globe-atmosphere-halo-comets/).
