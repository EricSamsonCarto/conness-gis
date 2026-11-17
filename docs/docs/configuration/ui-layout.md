---
icon: lucide/layout-dashboard
---

# UI & Layout

The `ui` block in your project's `settings.json` adjusts the shell: panel sides and widths, the top bar, the layer list, the info modal, the loading overlay, mobile sizing and more. Every sub-block is optional; leave one out to use its defaults.

!!! tip "In the editor"
    These are spread over several groups: **Layout** (arrangement, top bar, side rail, floating buttons, mobile and loading screen; the switches beside the Top Bar and Side Rail names show or hide each one), **App Style** (text sizes), **Branding** (the info modal), **Widgets** (widget headers, and each widget's Show info section switch), **Layers** (label defaults) and **Interaction** (the right-click menu and button cursor). The top of Layout has buttons that make every logo and icon 1 px bigger or smaller, and App Style has the same for text, above its text sizes.

Sizes are written in px, measured at the browser's default font size (16px). Icon sizes, logo sizes and the top-bar height grow and shrink with the user's font-size setting, like the text does. Panel widths stay fixed, so a larger font fits fewer words per line in a panel but doesn't take more of the map.

```json
"ui": {
  "layout": {},
  "topBar": {},
  "floatingControls": {},
  "info": {},
  "loader": {},
  "widgetHeader": {},
  "layerDefaults": {},
  "mobile": {},
  "textSizes": {},
  "hideWidgetInfo": [],
  "buttonCursor": "pointer",
  "popups": {}
}
```

`ui.popups` has its own page, [Popups](popups.md). Everything else is below.

## Layout: `ui.layout`

Sets which side of the desktop layout each region sits on, the side rail's sizes, which parts of the shell show, and where the widget buttons sit on phones. The mobile layout ignores the side settings.

| Field | Type | Default | Description |
|---|---|---|---|
| `sideRailSide` | `"left" \| "right"` | `"left"` | Side of the side rail (icon strip and slide-out panel) |
| `topBarPanelSide` | `"left" \| "right"` | opposite `sideRailSide` | Side a top-bar widget's panel opens on. Only needed when the side rail has no widgets |
| `topBarWidgetsSide` | `"left" \| "right"` | `"right"` | Side of the top-bar widget buttons. The logo, title and info button take the other side |
| `showInfo` | `boolean` | `true` | Show the info (ⓘ) button in the top bar |
| `showBranding` | `boolean` | `true` | Show the logo and title |
| `showTopBar` | `boolean` | `true` | Show the top bar, with its title, logo, info button and widgets |
| `showSideRail` | `boolean` | `true` | Show the side rail and its widgets |
| `sideRailOpenOnLoad` | `string` | closed | A side panel widget's `id` (e.g. `"layer-list"`) whose panel is open when the app loads |
| `topBarOpenOnLoad` | `string` | closed | A top-bar widget's `id` (e.g. `"bookmarks"`) whose panel is open when the app loads |
| `sideRailPanelWidth` | `number` | `288` | Width (px) of the side rail's slide-out panel |
| `sideRailStripWidth` | `number` | `48` | Width (px) of the side rail's icon strip, which is always visible |
| `sideRailIconSize` | `number` | `20` | Size (px) of the side-rail widget icons. Each button is the icon plus 12px of padding |
| `sideRailChevronSize` | `number` | `16` | Size (px) of the side panel's collapse chevron |
| `sideRailShadow` | object | none | Shadow beside the side rail, over the map only. Same fields as the [top bar's](#shadows) |
| `mobileWidgetBar` | `"top" \| "bottom"` | `"top"` | Where the widget buttons sit in the [mobile layout](#mobile-uimobile). `"bottom"` gives them their own bar under the map, where thumbs reach |

The strip is 48px wide by default, so icons above about 36px crowd it. To fit bigger icons, raise `sideRailStripWidth` past 48.

A top-bar widget's panel opens opposite the side rail, so the two never overlap. When both the side rail and the top bar have widgets, setting `topBarPanelSide` to the rail's side stops the app at boot with an error that explains the fix. With an empty side rail, it can open on either side.

`showTopBar` and `showSideRail` only hide the bar on desktop, and a hidden top bar takes its shadow with it; the mobile layout keeps its own bar and still offers every widget in its carousel. Widgets placed on a hidden bar are skipped on desktop, with a note in the browser console (`[conness-gis] …`). A `sideRailOpenOnLoad` id that isn't in `sidePanelWidgets`, or a `topBarOpenOnLoad` id that isn't in `topBarWidgets`, logs a warning and the panel starts closed. Both open on desktop only, and a hidden bar opens nothing.

## Top bar: `ui.topBar`

On narrow screens the title shortens with an ellipsis (hover shows it in full), so the widget buttons always stay on screen.

| Field | Type | Default | Description |
|---|---|---|---|
| `height` | `number` | `56` | Top-bar height in pixels; the map resizes to fit |
| `iconSize` | `number` | `20` | Size (px) of the widget icons and the info icon. Each widget button is twice the icon, and the info button is the icon plus 12px |
| `mobileIconSize` | `number` | `iconSize` | Icon size in the [mobile layout](#mobile-uimobile): the carousel and the info icon |
| `logoSize` | `number` | `32` | Logo height (px). The width follows the image's proportions, so a wide logo isn't squashed |
| `mobileLogoSize` | `number` | `logoSize`, then `28` | Logo height in the [mobile layout](#mobile-uimobile) |
| `titleSize` | `number` | `18` | The app title's text size (px) |
| `mobileTitleSize` | `number` | `16` | The app title's text size in the [mobile layout](#mobile-uimobile) |
| `mobileVisibleCount` | `number` | `3` | How many widget buttons the mobile carousel shows at once |
| `mobileCarouselMode` | `"step" \| "paged"` | `"step"` | `"step"` moves one widget per arrow click; `"paged"` moves a full window |
| `mobileHeight` | `number` | `height`, or `45` with the widget bar at the bottom | Top-bar height in the [mobile layout](#mobile-uimobile). Below 45 the bar looks cramped |
| `shadow` | object | none | Shadow cast onto the map (see [Shadows](#shadows)) |

The bar has three separate sizes: `height` for the bar, `iconSize` for the widget icons and their buttons, and `logoSize` for the logo. Nothing caps the last two, so a large icon or logo can overflow the bar; raise `height` along with them. An SVG logo needs a `viewBox`, or its width won't scale.

### Shadows { #shadows }

`ui.topBar.shadow` puts a light shadow under the top bar, and `ui.layout.sideRailShadow` puts one beside the side rail. Both fall only over the map, so the top bar's stays put when a panel slides out. The side rail's shows on desktop while the rail is shown and has widgets. Both take the same fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Turn the shadow on |
| `strength` | `number` (0 to 1) | `0.4` | Scales both darkness and height. Try `0.2` for a faint shadow, `0.7` for a strong one |

```json
"topBar": { "height": 56, "shadow": { "enabled": true, "strength": 0.4 } },
"layout": { "sideRailShadow": { "enabled": true, "strength": 0.3 } }
```

## Floating controls: `ui.floatingControls`

Sizes the floating widget buttons and MapLibre's built-in controls (zoom, geolocate, globe, …) together, so the two sets match.

| Field | Type | Default | Description |
|---|---|---|---|
| `iconSize` | `number` | `25` | Icon size (px). The icon fills 75% of its button, so the default button is about 33px |
| `mobileIconSize` | `number` | `iconSize` | Icon size in the [mobile layout](#mobile-uimobile) |

## Layer list { #layer-list }

The Layer List's settings are the widget's own: they're under `"widgets": { "layer-list": … }`, on the [Layer List](../widgets/layer-list.md#configuration) page.

## Info modal: `ui.info`

The "About this app" modal shows your project's `info.md`. By default it only opens from the top bar's ⓘ button. These settings make it open on load and set its size. The markdown renderer is downloaded the first time the modal opens. The file's first `#` heading becomes the modal's title, in a fixed top bar with the ✕ and a line across the full width. The rest of the text scrolls under that bar, with a scrollbar in theme colors. While there's more to read, a fade shows at the bottom. That fade is the cue on phones, where scrollbars stay hidden until you scroll. Without a `#` heading, the bar holds only the ✕. When `autoOpen` is on, the modal waits for its text and opens at full size.

| Field | Type | Default | Description |
|---|---|---|---|
| `autoOpen` | `boolean` | `false` | Open the modal on load |
| `allowDismiss` | `boolean` | `true` | With `autoOpen`, show a "don't show again" checkbox. The choice is tied to the content of `info.md`, so editing the file shows it to returning users again |
| `width` | `number` | `672` | Widest the modal gets (px). Narrow screens use their own width |
| `maxHeight` | `number` | `80` | Tallest the modal gets, as a percentage of the visible screen height. Longer content scrolls |
| `watermark` | `boolean` | `true` | A small "Made with Conness GIS" link at the right of the modal's bottom bar. The map's credits always include it (see [Map Controls](map-controls.md#attribution)) |

With `autoOpen` on, closing the modal (X, Escape or a click outside) only lasts until the next load. Only the "don't show again" checkbox stops it opening on load. Without `autoOpen` the checkbox never shows, since the modal only opens when someone asks for it.

## Loading overlay: `ui.loader`

An overlay shown at startup while layer data loads. It dims the app and blocks clicks, so nobody opens a widget mid-load. The spinner uses the `primary` color.

It waits for every layer, including ones hidden at startup: hidden data layers still load at boot, and the map would stay busy for a few seconds if the overlay closed before them. So the map is ready to use the moment the overlay fades. To skip hidden layers at startup and load them when they're first turned on, set [`map.onlyVisibleOnLoad`](map-camera.md#load-only-visible-layers); then the overlay doesn't wait for them. With no layers at all, it clears as soon as the basemap loads. Once startup loading finishes, the overlay doesn't come back, even after a basemap switch.

Under the label, one line says what's happening: [DuckDB](adding-layers.md#duckdb)'s startup steps while they run ("DuckDB", then each extension), then the name of a layer that's still loading, which changes as layers finish.

```json
"loader": {
  "label": ["Loading the map…", "Fetching layers…", "Almost there…"],
  "labelInterval": 2500,
  "showDetails": true
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Show the overlay |
| `label` | `string` or a list of strings | none | Text under the spinner, e.g. `"Loading…"`. A list shows one line at a time, looping, with a short fade between lines |
| `labelInterval` | `number` | `2500` | With a `label` list, how long each line shows, in ms |
| `showDetails` | `boolean` | `true` | Show the line under the label naming what's loading |

## Widget header: `ui.widgetHeader` { #widget-header }

The title bar at the top of every widget panel: the widget's name, a close X and an optional divider. On mobile the same settings apply to the bottom sheet's header row.

| Field | Type | Default | Description |
|---|---|---|---|
| `showTitle` | `boolean` | `true` | Show the widget's name |
| `showDivider` | `boolean` | `true` | Show the line under the title |

These apply to every widget, and each placement can override them (see [Building a Custom Widget](../guides/custom-widget.md)). The title color is a theme setting, `widgetTitleColor` in your project's `theme.json`; see [Theme](theme.md).

## Widget info sections: `ui.hideWidgetInfo`

Some widgets (Bookmarks, Draw, Measure) open with a short info section explaining how to use them. List a widget's `id` here to hide its info section:

```json
"hideWidgetInfo": ["measure", "draw"]
```

## Text sizes: `ui.textSizes` { #text-sizes-uitextsizes }

All of the shell's and the widgets' text uses one of these sizes, so changing one changes every piece of text that uses it. Set in px; like the other sizes, they still follow the browser's font size.

| Field | Default | Used for |
|---|---|---|
| `small` | `11` | Fine print: coordinates, opacity percentages, badges, hints |
| `medium` | `12` | Layer names in the layer list, captions, widgets' info sections, and any text without its own size |
| `large` | `14` | Layer group names, list rows, menus, inputs, the info modal and the loading screen |
| `title` | `14` | Widget and side panel titles |
| `button` | `14` | Buttons inside widgets |
| `dialogButton` | `12` | Cancel and confirm buttons in dialogs |

```json
"textSizes": { "medium": 13, "large": 15 }
```

The app title has its own size, [`ui.topBar.titleSize`](#top-bar-uitopbar), and popups have three of their own on the [Popups](popups.md#text-sizes) page. Map labels are sized per layer or in [`ui.layerDefaults`](#global-layer-defaults).

## Global layer defaults: `ui.layerDefaults` { #global-layer-defaults }

Set a default once for every layer instead of repeating it on each. A layer's own values always win. For now this covers label styling, and only affects layers that have labels.

```json
"layerDefaults": {
  "label": { "bold": true, "fontSize": 12, "color": "#333333", "haloColor": "#ffffff", "haloWidth": 1 }
}
```

The fields match a layer's [`label`](adding-layers.md#labels) config, minus `field`, `text`, `expression` and `minZoom`, which stay per layer. That includes `spacing`, which only line layers use. Without it, labels use Noto Sans Regular at 12px in `#333` with a white halo; `"bold": true` switches to Noto Sans Bold.

## Mobile: `ui.mobile`

The mobile layout is used below 500 px wide, which means portrait phones. Landscape phones, tablets and anything wider get the desktop layout. Turning a phone or resizing a window across 500 px swaps the layout and leaves the map as it was: same view, basemap, layers and filters. The mobile layout fits screens down to 320 px wide.

`ui.mobile` sets the heights of the mobile bottom sheet, as a percentage of the visible screen height. On a phone that's the height between the browser's address bar and toolbar, and it follows them as they show and hide. The whole app is sized the same way, so it never scrolls past the bottom of the screen.

| Field | Type | Default | Description |
|---|---|---|---|
| `initialSheetVh` | `number` | `25` | Height when the sheet first opens |
| `minSheetVh` | `number` | `12` | Smallest the user can drag it to |
| `maxSheetVh` | `number` | `65` | Largest the user can drag it to |
| `widgetBarHeight` | `number` | `35` | Height (px) of the bottom widget bar, when `ui.layout.mobileWidgetBar` is `"bottom"` |

The sheet has one header row: the widget's name on the left, the grab bar in the middle and a close X on the right. Drag anywhere on the row to resize the sheet. The name follows [`ui.widgetHeader`](#widget-header) and the title color, like a desktop panel's. A feature popup opened on mobile uses the same row, with its header text on the left and its [action buttons](popups.md) left of the close X.

### Widget bar at the bottom { #mobile-widget-bar }

By default the phone's widget buttons sit in the top bar's carousel. With `ui.layout.mobileWidgetBar` set to `"bottom"`, they move to their own bar under the map, where thumbs reach, spread across its width:

```json
"ui": {
  "layout": { "mobileWidgetBar": "bottom" },
  "mobile": { "widgetBarHeight": 35 }
}
```

The top bar keeps the logo, title and info button, and it's 45 px tall unless `ui.topBar.mobileHeight` says otherwise. The bottom bar uses the same carousel settings, `mobileVisibleCount` and `mobileCarouselMode`. The bottom sheet, the floating corner buttons and the map's credits all sit above it. The open widget's button is marked, and tapping it again closes the sheet. A popup marks no button. A thin line and an upward shadow on the bar show where the sheet ends.

!!! tip "In the editor"
    These are in the **Mobile** group: **Widget buttons** picks top or bottom, and **Widget bar height** and **Top bar height** are under Advanced.

## Button cursor: `ui.buttonCursor`

| Value | Effect |
|---|---|
| `"pointer"` (default) | The hand cursor over every button: widgets, popups, panel toggles and map controls |
| `"default"` | Buttons keep the normal arrow, which feels more like a desktop app |

## Right-click context menu: `contextMenu`

A top-level block, not under `ui`. It sets up the right-click menu, which is desktop only. The menu opens toward the middle of the map, so it never runs off the edge. Set a built-in item to `true` to include it; `custom` items come last. Leave out the whole block, or set `"enabled": false`, to get the browser's own right-click menu back. `enabled` keeps your items for when you turn it on again.

```json
"contextMenu": {
  "enabled": true,
  "centerHere": true,
  "googleMaps": true,
  "googleStreetView": true,
  "custom": [
    { "label": "Open in Bing Maps", "url": "https://www.bing.com/maps?cp={lat}~{lng}&lvl={zoom}" }
  ]
}
```

`osm`, `appleMaps` and `copernicus` are the other built-in items.

| Field | Type | Description |
|---|---|---|
| `enabled` | `boolean` | Default `true`. `false` turns the menu off and gives the browser's menu back |
| `centerHere` | `boolean` | Fly the map to the clicked point |
| `googleMaps` / `googleStreetView` / `osm` / `appleMaps` / `copernicus` | `boolean` | "Open in …": opens that site in a new tab at the clicked point |
| `custom` | list of `{ "label", "url" }` | Your own items. `url` can use `{lat}`, `{lng}` and `{zoom}` placeholders. `{lng}` is always between -180 and 180, even after panning across the date line |
