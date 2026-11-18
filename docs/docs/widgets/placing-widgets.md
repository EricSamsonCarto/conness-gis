---
icon: lucide/layout-panel-left
---

# Placing Widgets

Each widget lists the surfaces it supports.

!!! tip "In the editor"
    Under **Widgets**, each widget has an on/off switch. When it's on, **Where** picks the top bar, the side rail or a map corner (whichever it supports), and **On mobile** adds it to the mobile carousel; its own settings follow. **Reorder widgets** orders the top bar, side rail and carousel, and moves a widget between them by dragging. **Arrange corners**, under Map Controls, does the same for the map's corners.

By hand, add the widget's `id` to the matching array in `settings.json`:

```json
"topBarWidgets": [{ "widgetName": "measure" }, { "widgetName": "draw" }],
"sidePanelWidgets": [{ "widgetName": "layer-list" }, { "widgetName": "legend" }, { "widgetName": "basemap" }],
"floatingWidgets": [
  { "slot": "top-left", "widgets": [{ "widgetName": "search", "order": -1 }] },
  { "slot": "top-right", "widgets": [{ "widgetName": "coordinates" }] }
],
"mobileWidgets": ["layer-list", "legend", "basemap", "bookmarks", "measure", "draw"]
```

| Surface | Where it appears | Placement array |
|---|---|---|
| `top-bar` | An icon button in the top bar; its UI opens in a panel beside the map | `topBarWidgets` |
| `side-panel` | An icon in the side rail; its UI slides out beside the map | `sidePanelWidgets` |
| `floating` | A button floating over a map corner | `floatingWidgets` |

A widget that supports several surfaces can appear in several places. The other placement fields (`panelWidth`, `header`, `order`, `stayOnMobile`) are covered in [Building a Custom Widget](../guides/custom-widget.md).

`mobileWidgets` lists, in order, the widgets in the mobile carousel, which sits in the top bar or, with [`ui.layout.mobileWidgetBar`](../configuration/ui-layout.md#mobile-widget-bar) set to `"bottom"`, in its own bar under the map. Floating widgets keep their buttons in the map corners. A widget can be in the carousel without being placed anywhere on desktop.

## The built-in widgets

| Widget | id | Surfaces | What it does |
|---|---|---|---|
| [Layer List](layer-list.md) | `layer-list` | side-panel, top-bar | Toggle layers, in groups; zoom, labels, transparency and filters per layer |
| [Legend](legend.md) | `legend` | side-panel, top-bar | Symbology swatches for visible layers |
| [Basemap](basemap.md) | `basemap` | top-bar, side-panel | Switch the basemap, and turn on hillshade |
| [Search](search.md) | `search` | floating | Search for places and for features in your layers |
| [Measure](measure.md) | `measure` | top-bar, side-panel | Measure distances and areas |
| [Draw](draw.md) | `draw` | top-bar, side-panel | Draw points, lines, polygons and text |
| [Bookmarks](bookmarks.md) | `bookmarks` | side-panel, top-bar | Save and restore map views |
| [Coordinates](coordinates.md) | `coordinates` | floating | Live coordinates of the cursor or map center |

Most widgets have their own settings, under `widgets.<id>` in `settings.json` and in their block under **Widgets** in the editor, documented on the widget's page.

To build your own, start with [Your First Widget](../guides/your-first-widget.md).
