---
icon: lucide/message-square
---

# Popups

Popup logic lives in `app/src/core/popups/` (resolving settings and handling clicks), and drawing in `app/src/shell/PopupHost.tsx` and `PopupContent.tsx`.

## Resolution: `resolvePopup.ts`

`resolvePopup(layer, uiPopups)` merges one layer's popup settings:

> shell defaults ← `settings.ui.popups` ← `layer.popup`

It returns `null` for a layer with popups off (no `popup` field, `popup: false` or `enabled: false`). Otherwise it returns a `ResolvedPopupConfig` with the final `trigger`, `displayType`, `title`, `fields` (`null` means all fields), the `header` template, and the layer's `group`, which the `{group}` placeholder needs.

## Handlers: `popupHandlers.ts`

`registerPopupHandlers(map, layers, uiPopups)` sets up one `click` handler and one `mousemove` handler for every layer with popups. Separate handlers per layer would race each other when a click lands on overlapping features.

`layers` is a list of `PopupLayer` (id, name, group, popup), not raw settings. `MapView` builds it from `settings.layers`, swapping in any entries a loader published to the store's `popupLayerOverrides`. PMTiles publishes one per source layer it draws, named `<layer> / <source layer>`, with the entry's popup config falling back to the layer's. Those can arrive after registration (a whole archive's children wait for its metadata), so `MapView` subscribes to `popupLayerOverrides` and re-registers the handlers whenever it changes.

When it registers, it:

- Calls `resolvePopup` for each layer and sorts the layers into click and hover groups.
- Checks every `displayType`. A template name that isn't in `popups.tsx` throws with the list of names that are. `MapView` catches the error and logs it, so popups stay off for every layer until it's fixed.

The click handler:

- Does nothing while any widget holds the map-click lock (`mapClickOwners` isn't empty), because that widget owns the click. Widgets claim it with `useMapClickLock` while a tool is out or a feature is being edited (Draw, Measure, and Coordinates while it waits for a pin). A claim is released a tick late, so the click that finishes a drawing doesn't open a popup.
- Queries every click-enabled sublayer at the point and removes duplicates by `(layerId, feature id || stringified props)`, since `queryRenderedFeatures` can return the same polygon once per tile it crosses.
- Writes the features to the store with trigger `'click'`.
- Closes a click popup when the click hits no feature, unless `ui.popups.closeOnMapClick` is `false`.

The mousemove handler sets the pointer cursor over any interactive layer and drives hover popups, where the top feature wins. While the map-click lock is held it closes any hover popup and leaves the cursor alone, so the widget's own cursor stays. Moving off a feature closes a hover popup; click popups are unaffected, since the two have separate lifecycles.

The handlers build sublayer ids from the layer id (`-fill`, `-line`, `-point`). `MapView` registers them once, after `registerLayers`; a basemap switch leaves them alone. They're registered again only when a loader publishes new `popupLayerOverrides` (PMTiles children arriving).

## Store and rendering

The store holds `selectedFeatures` (always an array; hover writes one item so the host doesn't need a special case), `selectedFeatureIndex` and `selectedFeatureTrigger`. Its actions are `setSelectedFeatures`, `advancePopup` (wraps around) and `closePopup`.

- **`PopupHost`** (desktop) places the popup at the map's bottom left, or where the user dragged it (`popupPosition`). It applies the `ui.popups` sizes (`height`, `maxHeight`, `width`, `maxWidth`) and handles dragging by the header. With `ui.popups.resizable`, the container is a [re-resizable](https://github.com/bokuweb/re-resizable) `Resizable` with handles on every edge and corner. Starting a resize pins the popup's top-left, a top or left edge moves that corner by the size change, and the final size goes to the store's `popupSize`. The configured size is the minimum; the maximum is `maxWidth` × `maxHeight` (440 × 500 by default, or the configured size if larger), bounded by the map area. `maxHeight` also caps an `"auto"` popup. On mobile it renders nothing, because the bottom sheet shows popups there. The sheet shows a popup over any open widget, which stays mounted underneath (`MobileSheet` hides it), so closing the popup returns to the widget as it was. `setSelectedFeatures` doesn't clear `mobileSheetWidgetId`; `openMobileWidget` on the widget already under a popup just closes the popup.
- **`PopupContent`**, shared by the desktop popup and the mobile sheet, renders the header bar, the template and, for overlapping click results, a pager fixed to the bottom. It fills in the `header` placeholders for each feature (`{layerName}` and `{group}`, and any other `{name}` from the feature's properties, the same syntax as a label's `text`, which `core/layers/labelText.ts` turns into a MapLibre expression), and reads the title from `feature.properties[title]`.

## Highlight: `highlight.ts`

`registerHighlight(map)`, called by `MapView` next to the popup handlers, watches the store's selection and redraws the highlight on every change: it removes its layers (`kit-highlight-fill`, `-outline`, `-casing`, `-point`) and, if the current feature's resolved `highlight` is on, adds them on the source and source layer of the sublayer the feature was picked from (`SelectedPopupFeature.sublayerId`), filtered to that feature: its `id` when it has one, else all its plain properties (the identity `popupHandlers.ts` already uses to de-duplicate). Polygons get a tint and outline on top, lines a casing just under the line, points a ring sized from the point's own `circle-radius` and stroke plus a gap (`paintSize.ts`, which keeps zoom curves top-level).

Filtered layers rather than the alternatives: `setFeatureState` needs a stable id per feature (`promoteId` per vector source layer) and edits to every paint expression, and a GeoJSON copy of the clicked geometry comes back cut at tile edges, so large polygons would be outlined in pieces. A filter change only rebuilds the highlight layer for the tiles in view, in the worker. The color is the theme's `featureHighlight`, resolved to `rgb()` by `resolvedThemeColor` (`core/theme/theme.ts`), since MapLibre paint can't read CSS variables.

The templates themselves are in the user files, in your project's `popups.tsx`; see [Popups configuration](../configuration/popups.md).
