---
icon: lucide/message-square
---

# Popups

Popups are turned on per layer; a layer with no `popup` field has none. Once on, clicking (or hovering) a feature opens a popup drawn by a template in your project's `popups.tsx`.

Two blocks set them up:

- `ui.popups` in `settings.json`: defaults for every layer (trigger, template, size, behavior).
- `popup` on a layer in `layers.json`: settings for one layer (which fields, which template, a header).

They merge as **kit default ← `ui.popups` ← `layer.popup`**.

!!! tip "In the editor"
    **Popup defaults**, at the top of **Layers**, sets `ui.popups`. Height, Max height, Width and Max width are together; tick **Auto** beside Height for `"auto"`. A layer's **Popup** screen sets its own `popup`, with the defaults it can override in an **Overwrite defaults for this layer** fold. New or changed templates are still written in `popups.tsx`.

On a [PMTiles](adding-layers.md#pmtiles) layer that draws several source layers, `layer.popup` applies to every source layer unless a `sourceLayers` entry sets its own `popup`. Those popups' layer name reads `<layer name> / <source layer name>`, e.g. *Protomaps / Roads*, so you can tell which source layer a feature came from.

## Global defaults: `ui.popups`

```json
"ui": {
  "popups": { "trigger": "click", "height": 300, "closeOnMapClick": true }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `trigger` | `"click" \| "hover"` | `"click"` | Trigger for every layer that doesn't set its own |
| `position` | `"bottom-left"` and the other three corners, or `"feature"` | `"bottom-left"` | Where the desktop popup opens: a map corner, or next to the feature (below) |
| `displayType` | `string` | `"standard"` | Template name from `popups.tsx` |
| `height` | `number \| "auto"` | `300` | Popup height in px. A fixed height keeps the popup from jumping as you page through stacked features. `"auto"` fits the content, up to `maxHeight` |
| `maxHeight` | `number` | `500` | The tallest the popup gets: fitting its content (`"auto"`) or resized by the user |
| `width` | `number` | `320` | Desktop popup width in px. On mobile the sheet is full width |
| `maxWidth` | `number` | `440` | The widest a user can resize the popup |
| `draggable` | `boolean` | `true` | Let users drag the desktop popup by its header. The new position sticks as popups open and close, and moves back inside the map if the map area shrinks (a panel opens, the window narrows) |
| `resizable` | `boolean` | `false` | Let users resize the desktop popup from any edge or corner, like a window. It can't get smaller than the configured size (`width` by `height`; 100 px tall with `"height": "auto"`) or bigger than `maxWidth` by `maxHeight` (or the configured size, if that's larger), and it stays inside the map. The size sticks until the page reloads. Mobile keeps the bottom sheet |
| `closeOnMapClick` | `boolean` | `true` | Clicking empty map closes a click popup. Set `false` for popups that only close with X, Escape or another feature |
| `highlight` | `boolean` | `true` | Outline the feature whose popup is open (see [Highlight](#highlight)) |
| `zoomToFeature` | `boolean` | `true` | A button that zooms to the feature (points fly to a fixed zoom) |
| `copyCoordinates` | `boolean` | `false` | A button that copies the feature's coordinates |
| `viewInGoogleMaps` | `boolean` | `false` | A button that opens the feature in Google Maps, with a pin at the exact point |
| `headerSize` | `number` | `14` | Text size (px) of the header bar, next to the close button |
| `titleSize` | `number` | `16` | Text size (px) of the title inside the popup. Templates without a title ignore it |
| `bodySize` | `number` | `14` | Text size (px) of the fields table and body text |

### Action buttons { #action-buttons }

`zoomToFeature`, `copyCoordinates` and `viewInGoogleMaps` add small buttons to the popup. On desktop they sit at the right of its footer. On phones they sit in the sheet's header, left of the close X, and the popup has no footer unless a tap hit several features. Then the footer holds only the ◀ 1 / 3 ▶ pager. Copying coordinates shows a short "Coordinates copied" label beside the button, which fades out after a moment.

### Next to the feature

With `"position": "feature"`, the popup opens above the feature (below it when there's no room), stays inside the map, and follows the map as it pans and zooms. A small arrow on its edge points at the feature: at a point itself, at the nearest spot on a line, and at the clicked spot inside a polygon. Paging through stacked features moves it to each one. Once a user drags or resizes the popup, it stays where they put it and the arrow goes away.

### Highlight { #highlight }

While a popup is open, its feature is highlighted in the theme's [`featureHighlight`](theme.md) color (cyan by default): polygons get an outline and a light tint, lines a wider band under them, and points a ring just outside their edge, whatever their size. It follows the pager through stacked features, works for hover popups too, and clears when the popup closes. It's drawn from the layer's own data, so a large polygon spanning many tiles is outlined whole, on every layer type. Turn it off with `"highlight": false` in `ui.popups`, or on one layer's `popup`.

### Text sizes

The three popup sizes reach the header bar through the shell and the inside of the popup through your templates: a template's title uses `text-popupTitle` and its body `text-popupBody` (see [Templates](#templates-popupstsx)). The built-in templates already do.

On mobile, a popup opens in the bottom sheet, over any widget that's open there. Closing the popup (X, or a tap on empty map) goes back to the widget as you left it, scroll position included. Tapping the open widget's button while a popup covers it does the same.

!!! note "Hover popups show one feature at a time"
    With `"trigger": "hover"`, a spot where features overlap shows only the top one, with no ◀ ▶ pager. Moving the mouse to the arrows would change what's under the pointer, so paging through stacked features only works with `"click"`. Use `"click"` on layers whose features overlap.

## Per-layer: `layer.popup`

Add a `popup` block to a layer to turn its popups on.

```json
"popup": {
  "displayType": "standard",
  "title": "plant_name",
  "header": "Power plant — {state}",
  "fields": {
    "primsource": "Energy Source",
    "capacity_mw": "Capacity (MW)"
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Set `false` to turn the popup off but keep its config |
| `trigger` | `"click" \| "hover"` | from `ui.popups` | Overrides the global trigger |
| `position` | as `ui.popups.position` | from `ui.popups` | Overrides the global position |
| `header` | `string` | layer name | Text of the bar along the top, with column placeholders (below) |
| `title` | `string` | none | Column whose value is the popup's title |
| `fields` | object of `"column": "Label"` | all fields | Which columns to show, and their labels |
| `displayType` | `string` | from `ui.popups` | Template name from `popups.tsx` |
| `highlight` | `boolean` | from `ui.popups` | Overrides the global highlight |
| `zoomToFeature` | `boolean` | from `ui.popups` | Overrides the global zoom-to-feature button |
| `copyCoordinates` | `boolean` | from `ui.popups` | Overrides the global copy-coordinates button |
| `viewInGoogleMaps` | `boolean` | from `ui.popups` | Overrides the global Google Maps button |

The header is the bar along the top of the popup, next to the close button. The title is a column's value at the top of the popup's content, under that bar, in templates that show one (all three of the demo's do).

The last three appear as buttons at the popup's bottom right, opposite the pager for stacked features. The Google Maps button differs from the [right-click menu](ui-layout.md#right-click-context-menu-contextmenu)'s "Open in Google Maps": the popup button drops a pin on the feature, while the menu item matches the map's current zoom and drops no pin.

### The `fields` dictionary

`fields` maps property names to labels, shown in the order you write them. To keep a name as is, repeat it as the label. Here `passengers` is renamed and `STATE` isn't:

```json
"fields": {
  "passengers": "Annual Passengers",
  "STATE": "STATE"
}
```

Leave out `fields` to show every property the feature has, in its own order, labeled by column name.

### Header placeholders

`header` replaces the header bar's text, which is otherwise the layer name. Put a column name in braces to fill in that column's value for each feature, the same way a label's [`text`](adding-layers.md#labels) works: `"header": "Airport — {city}"` shows *Airport — Denver* for a feature whose `city` is Denver. A feature without the column shows nothing in its place.

Two names are built in:

| Placeholder | Resolves to |
|---|---|
| `{layerName}` | The layer's display name |
| `{group}` | The layer's group (empty if it has none) |

They win over a column with the same name, so rename such a column to show it in a header.

### Three ways to turn a popup off

| Form | Meaning |
|---|---|
| Leave out `popup` | Off. The usual way |
| `"popup": false` | Off, explicitly |
| `"popup": { "enabled": false, … }` | Off, but the config stays, so you can turn it back on without rewriting the fields |

## Templates: `popups.tsx`

A popup's look is a React component. Your project's `popups.tsx` exports a `popupTemplates` object that maps names to components, and a layer picks one with `popup.displayType`.

```tsx
export const popupTemplates: PopupTemplates = {
  basic: BasicPopup,
  standard: StandardPopup,
  featureHighlights: FeatureHighlightPopup,
}
```

Each template receives:

| Prop | Type | Description |
|---|---|---|
| `feature` | `GeoJSON.Feature` | The clicked feature |
| `fields` | `Record<string, string> \| null` | The layer's `fields`, or `null` to show every property |
| `title` | `string \| undefined` | The title value (from `popup.title`) |
| `layerId` / `layerName` | `string` | The feature's layer |

Every new project ships three templates:

- `basic`: a plain label and value list.
- `standard` (the default): a card with a title in the brand color and a striped table.
- `featureHighlights`: the first field large at the top, the rest in a table below.

In all three, a column name longer than about 160 px wraps onto more lines, which leaves room for the values.

The Conness editor lists templates by their `displayName` (React's own property), else by their key in words: `StandardPopup.displayName = 'Standard'` shows as "Standard" in Popup defaults → Popup Template.

### Writing your own

Write a component and register it. A minimal template:

```tsx
const MyPopup: PopupTemplate = ({ title, fields, feature }) => {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  return (
    <div className="p-3 text-popupBody text-strongText">
      {title && <h3 className="mb-2 text-popupTitle font-semibold">{title}</h3>}
      {/* render fields… */}
    </div>
  )
}

export const popupTemplates: PopupTemplates = {
  standard: StandardPopup,
  myPopup: MyPopup,   // used from layers.json as "popup": { "displayType": "myPopup" }
}
```

Keep `standard` in the object unless you change `ui.popups.displayType`, because every layer without its own `displayType` uses it.

!!! note "A typo turns popups off"
    If a layer names a `displayType` that isn't in `popups.tsx`, popups stay off for every layer, and the browser console names the missing template and lists the ones that exist.

In your template, use the kit's theme classes (`text-text`, `text-strongText`, `text-primary`, `bg-surface`, `border-panelBorder` and so on) instead of fixed colors like `text-slate-900` or `bg-white`, and the popup sizes `text-popupTitle` / `text-popupBody` instead of Tailwind's `text-sm` or `text-base`. Then it follows the theme, dark presets included, and the size settings. The built-in `standard` and `featureHighlights` templates show how. See [Theme](theme.md).
