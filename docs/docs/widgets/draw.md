---
icon: lucide/pencil
---

# Draw

Draw points, lines, polygons and text on the map, each with its own style. Drawings show up as a "Drawings" layer in the layer list. You can save them in the browser as named sets or download them as GeoJSON, KML or GeoParquet. Built on [@mapbox/mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw).

- id: `draw`
- Surfaces: `top-bar`, `side-panel` (the panel is too big for a map corner)

## Place it

In the editor, turn on **Draw** under **Widgets** and pick its **Where**. By hand:

```json
"topBarWidgets": [{ "widgetName": "draw" }]
```

## Behavior

- Four tools: point, line, polygon and text. Click to place a point or text. For lines and polygons, click to add vertices (each placed vertex shows a dot in the shape's color) and double-click (or press Enter) to finish. Escape cancels.
- Click a drawing, or its row in the list, to edit its shape and style: color, width, radius, the text and its size, and for polygons the boundary color, width and opacity and the fill opacity. Opacity changes show once you click Done.
- Lines and polygons can have a drop shadow, so they stand out from the basemap: tick "Drop shadow" in the style panel and set its intensity with the slider below it. The shadow is saved with the drawing and hides with the Drawings layer.
- Rename a drawing or a saved set inline: Enter or clicking away saves, Escape cancels, and an empty name keeps the old one.
- Clear All asks before removing every drawing, since unsaved drawings can't be recovered.
- While a tool is out or a drawing is being edited, clicking a layer doesn't open its popup. Popups come back as soon as you finish.
- On phones the widget leaves out its info section and puts the four tools on one row. Each button is only as wide as its label, and on the narrowest phones the row wraps.
- Drawings appear as a Drawings layer in the layer list and toggle like any other layer; text toggles with its drawing. That row's menu only offers Zoom to Extent, which fits all current drawings. Transparency is set per drawing in the widget's style panel.
- **Saved sets.** Save the current drawings in the browser (`localStorage`) under a name, then rename, reload or delete sets. A saved set is a snapshot: it only changes when you save or overwrite it, not when you keep editing the drawings on the map. Sets are stored per app, using [`branding.appId`](../configuration/branding.md). If the browser's storage is full or blocked, a red "Couldn't save to this browser" line appears under the Save row, and sets saved while it shows are lost on reload.
- **Download.** Download the drawings on the map, or a saved set (its download icon), as GeoJSON, KML or GeoParquet, picked in a pop-up (only the formats in `exportFormats`; with one, it downloads directly). Every format has three properties per drawing: `id` (numbered 1, 2, 3… in export order), `name` and `shape_type` (`point`, `line`, `polygon` or `text`).
    - **GeoJSON:** no styling, and text drawings export as plain points without their wording.
    - **KML:** keeps each drawing's style, so it opens styled in Google Earth: line color and width, polygon fill and boundary color and opacity, point color and size, and text drawings as colored labels. Drop shadows and halos have no KML equivalent and are left out.
    - **GeoParquet:** geometry plus the three properties, with GeoParquet 1.1 metadata so QGIS, GeoPandas and DuckDB read it. Written in the browser, loaded the first time it's used.

## Configuration: `widgets.draw`

```json
"widgets": {
  "draw": {
    "tools": ["polygon", "line"],
    "defaultStyle": {
      "width": 2.5,
      "radius": 6,
      "strokeColor": "#ffffff",
      "strokeWidth": 2,
      "fillOpacity": 0.2,
      "boundaryOpacity": 1,
      "shadow": false,
      "shadowIntensity": 0.5,
      "fontSize": 20
    },
    "exportFormats": ["geojson", "kml", "geoparquet"],
    "maxCount": 50
  }
}
```

Every field is optional; `"draw": {}` (or no `draw` block) uses the defaults.

| Field | Type | Default | Description |
|---|---|---|---|
| `tools` | `("point" \| "line" \| "polygon" \| "text")[]` | all four | Which tools to offer, in this order. An empty array means all |
| `defaultStyle` | `DrawDefaultStyle` | kit defaults | Style for new drawings. Their color comes from a rotating palette |
| `exportFormats` | `("geojson" \| "kml" \| "geoparquet")[]` | all three | Formats Download offers, in this order. With one, Download skips the pop-up. An empty list means all. No CSV: drawings have no table of attributes |
| `maxCount` | `number` | `50` | Most drawing sets a user can save. At the limit, saving a new set is refused, with a note, until one is deleted. `0` means no limit |

`defaultStyle` takes `width`, `radius`, `strokeColor`, `strokeWidth`, `fillOpacity`, `boundaryOpacity`, `shadow`, `shadowIntensity` and `fontSize`, all optional. Anything left out uses the kit default: width 2.5, radius 6, a white outline 2 wide, fill opacity 0.2, a fully opaque polygon boundary, no shadow (intensity 0.5 when turned on) and text size 20. Sets saved before boundary opacity and shadows existed load with a full boundary and no shadow. Users can still restyle any drawing after they create it.
