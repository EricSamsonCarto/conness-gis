---
icon: lucide/ruler
---

# Measure

Measures distances and areas on the map, by clicking points or drawing freehand. It shows a live total while you draw, labels on the map, and a list of your measurements. Built on [@mapbox/mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw) and [Turf.js](https://github.com/Turfjs/turf).

- id: `measure`
- Surfaces: `top-bar`, `side-panel` (the panel is too big for a map corner)

## Place it

In the editor, turn on **Measure** under **Widgets** and pick its **Where**. By hand:

```json
"topBarWidgets": [{ "widgetName": "measure" }]
```

## Behavior

- Pick a tool, then click on the map to measure. The total updates as you go. The freehand tools follow a mouse drag or a finger on a touch screen.
- Each measurement gets a total label on the map, and optionally a length label on each segment.
- The list shows every measurement, and you can clear them one at a time. Clear All asks first.
- Measured lines and outlines draw with a soft drop shadow, so they stand out from the basemap and your data, including after closing with Keep on Close.
- Three options sit in one row of toggles above the units: Edge Labels, Total and Keep on Close. Hover one for what it does.
- Escape cancels the current measurement and puts the tool down.
- While a tool is out or a measurement is being edited, clicking a layer doesn't open its popup.
- On phones the widget leaves out its info section and puts the four tools on one row, in the order Line, Freehand, Area, Freehand. Both freehand tools are labeled "Freehand" there, and their icons tell line from area. The live distance or area shows above the tools, where it's easy to see while drawing.
- Settings only set each control's starting value. Users can change them, and their changes stick when the widget closes and reopens, until the page reloads. A setting that changes while the page is open (a new default unit, say) replaces the user's choice for that control.

## Configuration: `widgets.measure`

```json
"widgets": {
  "measure": {
    "persistOnClose": false,
    "showTotal": true,
    "showEdgeLabels": false,
    "defaultLinearUnit": "kilometers",
    "defaultAreaUnit": "square-kilometers",
    "precision": 2,
    "linearUnits": ["kilometers", "miles", "meters"],
    "areaUnits": ["square-kilometers", "square-miles", "acres"]
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `persistOnClose` | `boolean` | `false` | Keep finished measurements on the map after the widget closes. They come back as editable shapes when it reopens either way |
| `showTotal` | `boolean` | `true` | Show the total length or area label |
| `showEdgeLabels` | `boolean` | `false` | Show a length label on each segment |
| `defaultLinearUnit` | `"miles" \| "kilometers" \| "meters" \| "feet" \| "yards"` | `"kilometers"` | Starting distance unit |
| `defaultAreaUnit` | `"acres" \| "square-miles" \| "square-kilometers" \| "square-meters" \| "square-feet" \| "hectares"` | `"square-kilometers"` | Starting area unit |
| `precision` | `number` | `2` | Decimal places in the panel and on map labels |
| `linearUnits` | `LinearUnit[]` | all | Which distance units the dropdown offers, in this order |
| `areaUnits` | `AreaUnit[]` | all | Which area units the dropdown offers, in this order |
