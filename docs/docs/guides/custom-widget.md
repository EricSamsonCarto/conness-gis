---
icon: lucide/wrench
---

# Building a Custom Widget

The reference for writing widgets: the manifest, surfaces, placement options, icons, colors and the shared components. It assumes you've done [Your First Widget](your-first-widget.md). The repo has a shorter version of this page at `app/widgets/WIDGETS.md`, written for people and AI assistants working in the code.

## Anatomy of a widget

A widget is a folder under `app/widgets/` with three required files: `settings.ts` (its plain facts, `about`, and its settings, if users can change any), `widget.config.ts` (the manifest: `about` plus its icon and component) and `Widget.tsx`. Every built-in widget lays out the rest the same way, and yours should too, so anyone opening a widget folder knows where things are:

```
app/widgets/my-widget/
├── settings.ts        ← `about` (id, label, surfaces, defaults) and the settings schema
├── widget.config.ts   ← the manifest: `about` + icon + component
├── Widget.tsx         ← the component the manifest points at
├── Widget.mobile.tsx  ← optional, the phone view (see Phone version)
├── components/        ← sub-UI used by Widget.tsx
├── lib/               ← non-UI logic: controllers, storage, unit math, map style specs
└── assets/            ← icon.svg, images, CSS
```

Only `settings.ts`, `widget.config.ts`, `Widget.tsx` and the optional `Widget.mobile.tsx` sit at the root. Add `components/`, `lib/` or `assets/` when you have something to put in them, using those names. The component inside `Widget.tsx` keeps a descriptive name, such as `export function LayerListWidget()`, so React DevTools and error messages can tell widgets apart.

The shell skips folders whose name starts with `_`. That's how `_template` stays out of your app. A widget's folder name must match its `about.id`; the shell stops with an error if they differ.

`settings.ts` is read outside the app as well: Node checks projects against it, and the Conness editor builds the widget's block from it. So it must not import React, components, CSS or assets, and its imports are relative with a `.ts` extension (`'../../src/core/widget-types.ts'`).

Widgets are shared by every project. `npm run dev` loads all of them, so a newly placed widget works at once. `npm run build` bundles only the widgets the project places (`topBarWidgets`, `sidePanelWidgets`, `floatingWidgets`, `mobileWidgets`), with their components, CSS and libraries, and stops if a placed name has no widget folder. The build log lists what was bundled and left out.

## The manifest

The manifest is `about` from `settings.ts`, spread in `widget.config.ts` and joined by the icon and component:

```ts
// settings.ts
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'my-widget',
  label: 'My Widget',
  description: 'What it does.',
  surfaces: ['top-bar'],
  defaults: { panelWidth: 320 },
}

// widget.config.ts
import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import { about } from './settings'

export const manifest: WidgetManifest = {
  ...about,
  icon,
  component: lazy(() => import('./Widget').then((m) => ({ default: m.MyWidget }))),
}
```

`component` is lazy: `Widget.tsx` and everything it imports load the first time the widget opens, not with the app, and the panel shows a small spinner meanwhile. So keep the manifest's imports to `settings.ts` and the icons. Nothing outside the widget's folder should import from its `Widget.tsx`, `components/` or `lib/` either, or that code joins the startup download again. State kept at a module's top level (Draw's drawing session) survives closing the widget, since a lazy module loads once and stays loaded. State inside the component is lost on close.

The full shape:

```ts
export interface WidgetManifest {
  id: string
  label: string
  description?: string
  icon: string
  icons?: Partial<Record<IconSurface, string>>
  surfaces: WidgetSurface[]
  defaults?: WidgetDefaults
  component: ComponentType | LazyExoticComponent<ComponentType>
  mobileComponent?: ComponentType | LazyExoticComponent<ComponentType>
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique id. Two widgets with the same id stop the app at boot |
| `label` | `string` | Name in the panel header, tooltip and mobile carousel |
| `description` | `string` | Optional tooltip text |
| `icon` | `string` | The launcher icon (an imported SVG) |
| `icons` | per-surface map | A different icon shape for one surface (below). Rarely needed |
| `surfaces` | `('top-bar' \| 'side-panel' \| 'floating')[]` | Surfaces the widget can be placed on |
| `defaults` | `WidgetDefaults` | Default placement options (below) |
| `component` | `ComponentType` | Your React component, usually lazy (above) |
| `mobileComponent` | `ComponentType` | Optional. The [phone view](#phone-version), shown in place of `component` in the phone layout |

### `defaults`

```ts
defaults: { panelWidth: 320, hasUI: true, chromeless: false, stayOnMobile: false, opens: 'sideways' }
```

| Field | Type | Default | Description |
|---|---|---|---|
| `panelWidth` | `number` | `320` | Panel width, on the top bar and in floating pop-outs. It doesn't apply in the side rail, whose width is [`ui.layout.sideRailPanelWidth`](../configuration/ui-layout.md#layout-uilayout) |
| `hasUI` | `boolean` | `true` | Whether the widget opens a panel. Set `false` for floating buttons that only perform an action |
| `chromeless` | `boolean` | `false` | Floating only. No title bar; the widget fills its pop-out. Search uses this |
| `stayOnMobile` | `boolean` | `false` | Floating only. On phones, keep the widget's button over the map and open it there, instead of in the bottom sheet |
| `alwaysOnMap` | `boolean` | `false` | Floating only. Like `stayOnMobile`, but a placement can't turn it off, and the editor hides the Stay on mobile row. Search uses this, since its bar only makes sense beside its button |
| `opens` | `'sideways' \| 'vertically'` | by corner | Floating only. Which way the pop-out opens from its button: toward the middle of the map, or straight down (top corners) / up (bottom corners). Unset: `sideways` in a vertical corner, `vertically` in a horizontal one. Search sets `sideways`, since its bar is horizontal |

## Surfaces

A widget lists the surfaces it supports. The editor offers only those in the widget's **Where**, and by hand you place it by adding its id to the matching array in `settings.json`. Placing a widget on a surface it doesn't list stops the app at boot.

| Surface | Placement array | UI location |
|---|---|---|
| `top-bar` | `topBarWidgets` | A panel beside the map, opposite the side rail |
| `side-panel` | `sidePanelWidgets` | A slide-out panel beside the map |
| `floating` | `floatingWidgets` | A pop-out over a map corner |

### Placement options

Each placement is a `WidgetPlacement`:

```json
{ "widgetName": "my-widget", "panelWidth": 360, "header": { "showTitle": false } }
```

| Field | Type | Applies to | Description |
|---|---|---|---|
| `widgetName` | `string` | all | The widget's `id` |
| `panelWidth` | `number` | top-bar / floating | Overrides the manifest default. Ignored in the side rail |
| `header` | object | top-bar / side-panel / floating | Title bar settings for this placement (`showTitle`, `showDivider`, `titleColor`). On the side rail, `"showTitle": false` hides the panel's whole header bar |
| `order` | `number` | floating | Position within the corner (below) |
| `stayOnMobile` | `boolean` | floating | Overrides the manifest default, unless the manifest sets `alwaysOnMap` |
| `opens` | `"sideways" \| "vertically"` | floating | Overrides the manifest default (see `defaults` above) |

In the editor, these are rows in the widget's block under **Widgets**: Panel width, Opens and Stay on mobile where they apply, and Show title and Show divider for `header`. `order` is set by dragging in **Arrange corners** (Map Controls), and the order of the top bar, side rail and mobile carousel in **Reorder widgets**.

### Floating placement { #floating-placement }

Floating widgets go in a slot named for its corner:

```json
"floatingWidgets": [
  {
    "slot": "top-left",
    "widgets": [{ "widgetName": "search", "order": -1 }]
  },
  {
    "slot": "top-right",
    "direction": "horizontal",
    "widgets": [{ "widgetName": "coordinates" }, { "widgetName": "legend" }]
  }
]
```

`slot` is one of `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`. `direction` is `"vertical"` (the default) or `"horizontal"`.

MapLibre adds its own controls to a corner first, at `order: 0`. A negative `order` (e.g. `-1`) puts your widget above them, and a positive one puts it below.

`direction: 'horizontal'` lays that slot's widgets out in one row, 10px apart (the gap MapLibre's controls use). Each widget's `order` sorts it within the row, and the row's lowest `order` places the whole row among the native controls, so `-1` still lifts it above them. Pop-outs in a horizontal row open below the button in top corners and above it in bottom corners, unless the widget or placement sets `opens`. Two slot entries for the same corner stack as separate blocks.

## Phone version { #phone-version }

On phones a widget opens in the bottom sheet, unless it's a floating widget with `stayOnMobile`. By default the sheet shows the same `Widget.tsx`. When the phone needs a different layout, give the component in `Widget.tsx` a `mobile` prop, and add a `Widget.mobile.tsx` that only wraps it:

```tsx
import { MyWidget } from './Widget'

export const MyWidgetMobile = () => <MyWidget mobile />
```

Then point the manifest's `mobileComponent` at the wrapper:

```ts
mobileComponent: lazy(() => import('./Widget.mobile').then((m) => ({ default: m.MyWidgetMobile }))),
```

The shell shows the wrapper in the phone layout and `Widget.tsx` everywhere else. Inside `Widget.tsx`, `mobile` should change only layout: leave out the `InfoSection`, pass `row={mobile}` to a `ToolButtonGrid`, or move a block up. The state, hooks and actions stay the same code, so the two views can't drift apart. The template ships with one, and Basemap, Draw, Measure and Bookmarks all work this way.

- Phone views leave out the `InfoSection`, since the sheet has little room.
- A small difference in behavior can stay an `isMobile` check from the store instead. Search does this to close its result list after a pick.
- When a window crosses the phone breakpoint, the open widget moves to the other layout and remounts. It keeps only what it keeps on close: state at a module's top level or in the store survives, state in the component doesn't.

## Connecting to the map

Use the hooks in `@/core/hooks`:

```tsx
import { useMap, useMapReady } from '@/core/hooks'

const map = useMap()       // the MapLibre map (or null before it exists)
const ready = useMapReady() // true once the style has loaded
```

Wait for `ready` before touching the map. For state shared between widgets, read the Zustand store with `useStore` from `@/core/store` (see [Architecture](../internals/architecture.md)).

Sources and layers you add stay through a basemap switch, since a switch only swaps the basemap's own layers. Never call `map.setStyle()` yourself: it would remove every data layer. Switch basemaps with `selectBasemap(map, id, style)` from `@/core/map/basemapSwitch`, using a basemap's `id` and `style` from `settings.basemaps`. It also records the new basemap, so the Basemap widget highlights it and bookmarks save it.

If your widget uses a large library, load it with `import()` the first time it's needed (`const { thing } = await import('big-library')`), so it stays out of the startup bundle. DuckDB, esri-gl, FlatGeobuf and the info modal's markdown renderer load this way.

### Using map clicks

If your widget takes clicks on the map (drawing, measuring, picking a point), claim them while the tool is in use:

```tsx
import { useMapClickLock } from '@/core/hooks'

useMapClickLock('my-widget', toolActive)
```

While any widget holds a claim, popups stay off: no click or hover popups, and no pointer cursor over features. Set your own map cursor while you hold it. Claim only while a tool is out or a feature is being edited, not just because the widget is open. Draw, Measure and Coordinates all work this way.

## Icons

The launcher `icon` is an imported SVG. One file is enough, and its color doesn't matter: the shell uses the icon's shape and fills it with the right theme color for where it appears.

| Where | Color |
|---|---|
| Floating button over the map | The map control icon color, black or white (the theme's [`mapControlIcons`](../configuration/theme.md#map-controls)), to match MapLibre's buttons |
| Side panel | `panelWidget` |
| Top bar and the mobile carousel (top or bottom bar) | `topBarWidget` |

So the same file works on every surface and in every preset. Guidelines:

- Use a 24×24 `viewBox` and `stroke-width="2"`, which matches MapLibre's zoom and compass buttons next to a floating icon. Solid fills work too.
- Use round `stroke-linecap` and `stroke-linejoin`, like the built-in icons.
- Draw in one color. To shade part of an icon, use `fill-opacity`; different solid colors all come out as the same flat shape.

`icons` is for the rare surface that needs a different shape, such as a simpler icon for the small mobile carousel button. Don't use it for color:

```ts
icon,                                  // used everywhere by default
icons: {
  mobile: iconMobile,                  // a simpler shape for the mobile carousel
},
```

## Color tokens

Use the theme classes for your widget's colors so it follows your project's `theme.json`, dark presets included. Fixed colors like `bg-white`, `text-slate-900` or `border-gray-200` stay light when someone picks a dark preset.

| Class | Use for |
|---|---|
| `bg-panelBg` / `border-panelBorder` | Widget background, borders and dividers |
| `text-text` / `text-strongText` | Body text / names, titles and emphasized text |
| `bg-surface` | Section headers, chips and info boxes |
| `bg-layerGroupBg` | Group header rows, like the layer list's |
| `bg-primary` / `text-primary` | Brand color, active states, main actions |
| `bg-danger hover:bg-dangerHover` | Delete and clear buttons |
| `bg-success hover:bg-successHover` | Done and confirm buttons |
| `bg-save hover:bg-saveHover` | Save buttons |
| `bg-actionActive` / `bg-actionNotActive` (+ `Hover`) | Selected and idle tool buttons |
| `bg-slider` | Toggle switches when on, range sliders |
| `disabled:bg-disabledBg disabled:text-disabledText` | Disabled buttons |
| `hover:bg-text/10` | A general hover tint (no token needed) |
| `bg-topBarBg` / `text-topBarWidget` | Only for UI that sits on the top bar |

The [Theme](../configuration/theme.md) page lists every token with its default.

These classes work on every surface, floating pop-outs included. A global rule removes MapLibre's own button hover style there, so you don't need CSS per surface.

If you style with a plain `.css` file, as the Draw and Measure widgets do, use `var(--color-<token>)`, e.g. `background: var(--color-panelBg)`, and never a hex value. For the rare thing a token can't reach, like an icon inside a data URI, target dark presets with `[data-theme='dark'] .my-widget …`. `app/widgets/draw/assets/draw.css` and `measure/assets/measure.css` are working examples.

Colors painted on the map are the exception: MapLibre layer styles can't read CSS variables.

For the standard list row hover (a tinted background), use `ItemRow` (below), or add the `kit-row-hover` class to a row of your own.

For a small scrolling box, add `kit-scrollbar` to keep a thin scrollbar visible. macOS, Safari especially, hides scrollbars until you scroll, so the box otherwise doesn't look scrollable.

For text, use only the kit's sizes, which follow the project's [`ui.textSizes`](../configuration/ui-layout.md#text-sizes-uitextsizes) and the user's browser font size:

| Class | Default | Use for |
|---|---|---|
| `text-small` | 11px | Fine print, badges |
| `text-medium` | 12px | Captions, secondary text, item names in long lists |
| `text-large` | 14px | Inputs, list rows, group names, longer reading |
| `text-title` | 14px | Titles inside the widget |
| `text-button` | 14px | Buttons (`ActionButton` and `ToolButtonGrid` already use it) |
| `text-dialogButton` | 12px | Cancel and confirm buttons in dialogs |

Never Tailwind's own sizes (`text-xs`, `text-sm`, …) or px sizes like `text-[11px]`: they ignore the settings, and `scripts/text-sizes.test.ts` fails on them. In a `.css` file, write `font-size: var(--text-medium)` and so on, write control sizes and spacing in rem (px ÷ 16), and keep px for borders. Give text a color class too (`text-text`, `text-strongText`, …); text without one falls back to `text`.

On phones, every text box, select and textarea is 16px whatever its class says, because iOS zooms into any input smaller than that when it's tapped. The rule is in `src/index.css` with `!important`, so your widget's input sizes only apply on desktop.

## Shared components: `@/ui`

The kit ships a small UI library in `app/src/ui/`, imported as `@/ui/...`. The built-in widgets are made from it; use it instead of building your own so every widget looks and behaves the same. Everything uses the theme tokens and works on every surface.

| Import | What it is |
|---|---|
| `@/ui/icons` | In-widget glyphs: `TrashIcon` (deletes data), `CloseIcon` (the X, dismisses), `EditNameIcon` (rename), `DownloadIcon`, `CopyIcon`, `CheckIcon`, `ChevronIcon` (`direction="right" \| "down" \| "left"`), `EyeIcon` / `EyeOffIcon`, `CheckboxIcon` (`state`), `FilterIcon`, `KebabIcon`, `ZoomToExtentIcon`, `ExternalLinkIcon`. They use `currentColor`, so color them through the button's text color |
| `@/ui/IconButton` | An icon-only button. `label` becomes its aria-label and tooltip; `variant` is `default`, `danger` or `primary` |
| `@/ui/ActionButton` | A labeled button, with an icon before the text if you want one. `variant` is `danger` (Clear All), `save`, `success` or `neutral` (Download, Copy) |
| `@/ui/ToolButtonGrid` | A two-column grid of map tools with an active state, as in Draw and Measure. `row` puts the tools on one line for phones, each as wide as its label, wrapping on the narrowest screens. There a tool shows its `shortLabel` if it has one |
| `@/ui/ItemRow` | `ItemRow` and `ItemRowLabel`: one row of an item list with the standard hover, an optional color dot, and room for `IconButton`s. `active` keeps the highlight on |
| `@/ui/RenameInput` | Inline rename inside a row. Enter or clicking away saves, Escape cancels, and an empty name cancels |
| `@/ui/EmptyState` | The placeholder for an empty list: a title and an optional hint |
| `@/ui/Spinner` | A small loading spinner in theme colors (`size` in px). Pair it with text or an `aria-busy` parent |
| `@/ui/showBusy` | The same spinner for a plain-DOM button, such as a MapLibre control: `const done = showBusy(button)` hides the button's icon behind the spinner and sets `aria-busy`, and `done()` puts it back. The globe and terrain buttons use it |
| `@/ui/RangeSlider` | A two-thumb slider for a min to max range: `value={[lo, hi]}`, `onChange`, and an optional `marker` tick. The Layer List's Zoom Range uses it |
| `@/ui/InfoSection` | A collapsed "Info" box at the top of a widget explaining how to use it. A project can hide it with [`ui.hideWidgetInfo`](../configuration/ui-layout.md#widget-info-sections-uihidewidgetinfo); it knows its widget through `WidgetIdContext`, which the shell sets around every widget, so there's nothing to pass |
| `@/ui/ChoiceDialog` | A "pick one" pop-up with the same look and rules as `ConfirmDialog`: a title, an optional message, and a list of choices with descriptions. Draw and the layer list use it for download formats |
| `@/ui/ConfirmDialog` | "Are you sure?" prompts. Render it inside your widget's root element and give that root `relative`; it dims and blocks the widget until the user chooses. `variant="danger"` makes the confirm button red, `variant="default"` uses the brand color |
| `@/ui/ToggleSwitch` | An on/off switch: `<ToggleSwitch checked={on} onChange={setOn} ariaLabel="Show totals" />`. It has no text of its own, so put a label next to it and always pass `ariaLabel` |
| `@/ui/useCopyToClipboard` | `const { copied, copy } = useCopyToClipboard()`. `copy(text, key?)` copies and sets `copied` to `key` for about a second, so one widget can tell its copy buttons apart |
| `@/ui/useSavedItems` | A named list saved in the browser, as used by Bookmarks and Draw's Saved Drawings: `add`, `replace` (overwrite by name), `rename`, `remove`, `findByName`, and an optional `maxCount`. At the cap, `full` is true and `add` saves nothing and returns `false`, so your widget can say the list is full; `replace` still works. `saveFailed` is true when the last change didn't reach storage (full or blocked), so you can warn the user. Your widget shows its own overwrite and delete prompts |

The Bookmarks widget is a compact example of several of these together.

## Map helpers: `@/core`

Two modules in `app/src/core/` cover what Draw and Measure share. Use them in any widget that draws on the map.

| Import | What it is |
|---|---|
| `@/core/map/persistentOverlay` | Layers that stay on the map after your widget closes. `removeOverlay(map, { layers, sources })` removes them. `onSourcesLoaded(map, sourceIds, fn)` runs `fn` once those sources have drawn: add the new layers first and remove the old ones in `fn`, so swapping between your live and kept layers doesn't blink |
| `@/core/map/mapboxDraw` | For widgets built on mapbox-gl-draw. `addMapboxDraw(map, styles)` adds it with the MapLibre fixes and without its built-in buttons, and `removeMapboxDraw` takes it off again. Only one mapbox-gl-draw can be on the map, so on close hand your swap to `swapOverlayIn(map, sources, removeLive)`, and on open to `swapOverlayOut(map, removeOverlay)`; call `finishPendingSwap()` first thing on close. `drawLayerIds(map, styles)` lists the layers it renders; pass them as `layers` to `queryRenderedFeatures` so a hover check skips the basemap. `drawEvents(map).on('draw.create', …)` subscribes to Draw's own events (MapLibre 6 only types its own event names). `setDrawVertexColor(map, vertexStyleId, color)` colors the vertex handles, `setDrawHover(draw, from, to)` moves a hover highlight, `repaintDraw(draw)` repaints after `setFeatureProperty`, and `featuresWithMeta(draw, meta)` lists the features your widget tracks. `DraftFeature` colors the shape being drawn and dots its placed vertices. `HOVER_COLOR` is the map highlight color |

## If a widget crashes

A widget that throws while rendering only breaks its own pane. The pane shows "This widget couldn't load" and the error goes to the browser console. The map and the other widgets keep working, and opening the widget again tries again. Errors in click handlers or async code don't reach this; they only log to the console.

## Widget-specific settings

If users should be able to change your widget, export `settings` from its `settings.ts`: a [Zod](https://zod.dev/) object for the widget's own block in `settings.json`, under its id:

```json
"widgets": {
  "my-widget": { "greeting": "Welcome", "maxItems": 50 }
}
```

```ts
// settings.ts
import { z } from 'zod'

export const settings = z.strictObject({
  greeting: z.string().optional().meta({ description: 'Text at the top of the panel.', default: 'Hello!' }),
  maxItems: z.number().optional().meta({ description: 'Most items kept.', default: 20, label: 'Item limit', advanced: true }),
})
export type MyWidgetSettings = z.input<typeof settings>
```

That one schema is all there is. Projects are checked against it when their files are read, `settings.json` shows its descriptions on hover, and the Conness editor builds the widget's block from it, with no editor code. The built-in Search, Measure, Draw, Bookmarks, Basemap and Layer List widgets all work this way; see their `settings.ts`.

- **Every field `.optional()`**, and apply its default in the widget: the schema's `default` is shown on hover and in the editor, not filled in for you.
- **Read them** with `widgetSettings`, typed by your schema:

  ```ts
  import { widgetSettings } from '@/core/widgetSettings'
  import { about, type MyWidgetSettings } from './settings'

  const config = widgetSettings<MyWidgetSettings>(about.id)
  const limit = config?.maxItems ?? 20
  ```

- **Describe each field** with `.meta()`:

| Key | What it does |
|---|---|
| `description` | Hover text in `settings.json` and the editor's description bubble |
| `default` / `defaultText` | The default, as a value or in words (`'all four'`) |
| `see` | A docs link, shown on hover |
| `label` | The editor's row name; without it, the key in words (`maxItems` → "Max items") |
| `advanced: true` | Puts the row under the widget block's collapsed Advanced |
| `dependsOn: { path, equals? }` | Hides the row while another of the widget's settings is off, or isn't `equals`; `path` is relative to the widget (`'actions.export'`) |
| `editor` | A list edited on one of the editor's screens (Search's `layers`) |

A nested object becomes its fields' rows, in place; `advanced: true` on the object makes them all advanced.

### Regular and advanced settings

A setting without `advanced` is a **regular** setting: its row is always visible in the widget's block. Use it for what most projects change. `advanced: true` makes it an **advanced** setting, under the block's collapsed Advanced, for fine-tuning. Draw's style fields and Measure's display options are advanced; their tools and units are regular.

### The order in the Conness editor

Under Widgets, each widget's block reads, top to bottom:

1. Its name and **On** switch.
2. **Where** (from `about.surfaces`) and **On mobile**.
3. **Show info section**, if the widget renders an `InfoSection`.
4. Its placement options: **Panel width** (not in the side rail), and when floating **Opens** and **Stay on mobile**, defaulting to `about.defaults`.
5. Its **regular** settings, in the order the schema lists them.
6. **Advanced** (collapsed): its **advanced** settings in schema order, then **Show title** and **Show divider** (its panel header).

So list the schema's keys in the order they should read, most-used first.

### Common mistakes

- Importing React, a component, CSS or an asset in `settings.ts`.
- A setting without `.optional()`: every project that doesn't set it fails to load.
- Reading `settings.<id>` instead of `widgetSettings<T>(about.id)`: the settings are under `widgets.<id>`.
- `about.id` different from the folder name.

The JSON Schema in `app/schema/` that drives the hover help is regenerated the next time `npm run dev` or `npm run build` starts. Commit it with your change. The editor and the dev server read `settings.ts` when they start, so a new widget, or a schema edited while one runs, needs `npm start` or `npm run dev` restarted to show up.

In the repo, `app/widgets/WIDGETS.md` has all of this as a step-by-step checklist, written for people and AI assistants.

