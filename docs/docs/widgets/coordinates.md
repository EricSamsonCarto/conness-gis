---
icon: lucide/locate-fixed
---

# Coordinates

A small floating readout of live coordinates, for the cursor or the map center, with a copy button.

- id: `coordinates`
- Surfaces: `floating`

## Place it

In the editor, turn on **Coordinates** under **Widgets** and pick its **Where**. By hand:

```json
"floatingWidgets": [
  {
    "slot": "top-right",
    "widgets": [{ "widgetName": "coordinates" }]
  }
]
```

## Behavior

- A dropdown picks what it follows: **By Mouse** (the cursor) or **By Map Center**. Longitude always stays between -180 and 180, even after panning across the date line.
- By Mouse, a click on the map pins that point: a marker drops there and the readout holds its coordinates. **Clear** removes the pin and goes back to following the cursor. Until a point is pinned, clicking the map doesn't open popups, so the click that pins doesn't open one too. Close the widget or switch to By Map Center to click popups open again.
- The copy button puts the current coordinates on the clipboard.
- On mobile it opens in the bottom sheet like other floating widgets, unless `stayOnMobile` is set.

It has no settings block; it works as soon as it's placed.
