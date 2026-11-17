---
icon: lucide/bookmark
---

# Bookmarks

Saves the current map view so it can be restored later with one click. Bookmarks are stored in the browser's `localStorage`.

- id: `bookmarks`
- Surfaces: `side-panel`, `top-bar`

## Place it

In the editor, turn on **Bookmarks** under **Widgets** and pick its **Where**. By hand:

```json
"topBarWidgets": [{ "widgetName": "bookmarks", "panelWidth": 270 }]
```

or

```json
"sidePanelWidgets": [{ "widgetName": "bookmarks" }]
```

## Behavior

- Save the current view under a name. Reusing a name asks before overwriting.
- Click a bookmark to restore it: the map flies to its view and brings back everything it saved. A spinner shows at the start of its row until the flight and any basemap change are done and the map has drawn.
- Restoring turns off any layer filter the bookmark didn't have, so the map matches the saved view. The same goes for a saved filter whose columns are all gone from the layer's filters.
- If part of a bookmark can't be restored, the rest still loads and the browser console says what was skipped and why. That happens for a layer or basemap that's no longer configured, a globe or terrain the app doesn't have, and a filter column that's no longer a filter column or changed between categorical and numeric (the bookmark's other filter columns still apply). Saved category values aren't checked, so a value that's gone from the data just matches nothing.
- Rename and delete bookmarks. Deleting asks for confirmation.
- Bookmarks are stored per app, using [`branding.appId`](../configuration/branding.md), so several apps on one domain keep separate lists. Two open tabs of the same app don't overwrite each other's bookmarks.
- If the browser's storage is full or blocked, a red "Couldn't save to this browser" line appears under the Save row. Bookmarks saved while it shows are lost on reload.
- On phones the widget leaves out its info section, so the list has more room.

## What a bookmark saves

| Part | Saved |
|---|---|
| Camera | center, zoom, bearing, pitch and roll |
| Basemap | the selected basemap, or [No Basemap](basemap.md#no-basemap) |
| Globe, terrain, hillshade and contours | whether each is on (terrain with its exaggeration) |
| Each layer | visibility, opacity and its labels toggle |
| Filters | each layer's active filter from the layer list |

Bookmarks saved by an earlier version have only the camera, basemap, visibility and opacity. Restoring one leaves globe, terrain, hillshade, contours, labels and filters as they are.

## Configuration: `widgets.bookmarks`

```json
"widgets": {
  "bookmarks": {
    "maxCount": 35
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `maxCount` | `number` | `35` | Most bookmarks a user can keep. At the limit, saving a new one is refused, with a note, until one is deleted; overwriting an existing name still works. `0` means no limit |
