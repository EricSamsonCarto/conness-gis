# Building widgets

A reference for anyone, person or AI assistant, adding or changing a widget in this folder: which files a widget needs, what the shell and the Conness editor read from them, and which shared pieces already exist so you don't rebuild them. The longer guides are on the docs site: [Your First Widget](https://conness-gis.com/guides/your-first-widget/) and [Building a Custom Widget](https://conness-gis.com/guides/custom-widget/).

## Quick start (a checklist)

1. Copy `_template/` to a new folder whose name is the widget's id, lowercase with dashes (`widgets/trail-finder/`). Folders starting with `_` are skipped, which is why the template isn't a widget.
2. In the new `settings.ts`, set `about.id` to the folder name, and fill in `label`, `description`, `surfaces` and `defaults` (below). The editor reads every widget's `settings.ts` once, when `npm start` starts: restart it after changing one.
3. If users should configure it, describe its settings in `settings.ts`'s `settings` schema (below); otherwise delete that export.
4. Build the UI in `Widget.tsx`, using `@/ui` pieces and the theme's classes (below). Keep the component's descriptive name (`export function TrailFinderWidget()`).
5. Replace `assets/icon.svg` with the widget's icon.
6. Place it in a project's `settings.json` (below), run `npm run dev <project>`, and open it.
7. Check it: `npm run test`, `npm run typecheck`, `npm run lint`.

There is no list to register in: the shell finds every `widgets/*/widget.config.ts` on its own, Node and the editor find every `widgets/*/settings.ts`. `npm run dev` loads every widget; `npm run build` bundles only the widgets a project places, so an unplaced widget costs the built app nothing.

## The files

```
widgets/my-widget/
├── settings.ts        required: `about` (the widget's facts) and, if it has settings, their schema
├── widget.config.ts   required: the manifest, `about` plus the icon and component
├── Widget.tsx         required: the component
├── Widget.mobile.tsx  optional: the phone view (see Phone version)
├── components/        sub-UI used by Widget.tsx (only if needed)
├── lib/               non-UI logic: controllers, storage, unit math, map style specs (only if needed)
└── assets/            icon.svg, images, CSS
```

Nothing else sits at the root, and the optional folders use exactly those names.

### `settings.ts` (required)

The plain facts about the widget, read by the engine, the build, validation and the Conness editor, some of them in Node without React. So this file must not import React, components, CSS or assets, and its imports are relative with a `.ts` extension.

```ts
import { z } from 'zod'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'my-widget',              // the folder's name; unique (a duplicate stops the app at boot)
  label: 'My Widget',           // panel title, tooltip, mobile carousel, its block in the editor
  description: 'What it does.', // tooltip, optional
  surfaces: ['top-bar'],        // where it can go: 'top-bar' | 'side-panel' | 'floating'
  defaults: { panelWidth: 320 },
}

// only if users configure it (see Settings below)
export const settings = z.strictObject({
  greeting: z.string().optional().meta({ description: 'Text at the top of the panel.', default: 'Hello!' }),
})
export type MyWidgetSettings = z.input<typeof settings>
```

`defaults` are the widget's placement options, which a placement can override: `panelWidth` (px, top bar and floating; the side rail has its own width), `hasUI` (`false` for a floating button that only runs an action), `chromeless` (floating only, no title bar), `stayOnMobile` (floating only) and `opens` (floating only, `'sideways'` or `'vertically'`). `widget-types.ts` documents each one; hover them in your editor.

Any icon in a map control button sits in a `.maplibregl-ctrl-icon` span or uses `WidgetIcon`, so it follows the icon size (`ui.floatingControls.iconSize`). Don't give it a fixed width or height.

### `widget.config.ts` (required)

```ts
import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import { about } from './settings'

export const manifest: WidgetManifest = {
  ...about,
  icon,
  component: lazy(() => import('./Widget').then((m) => ({ default: m.MyWidget }))),
  // optional, see Phone version
  mobileComponent: lazy(() => import('./Widget.mobile').then((m) => ({ default: m.MyWidgetMobile }))),
}
```

`component` is lazy: `Widget.tsx` and everything it imports load the first time the widget opens, not with the app, and the shell shows a small spinner in the panel meanwhile. So keep the manifest's imports to `settings.ts` and the icons. A static `import { MyWidget } from './Widget'` still works, but puts the widget in the startup download. Nothing outside the widget's folder may import from `Widget.tsx`, `components/` or `lib/` either, or that code loads at startup again.

State kept at a module's top level (Draw's drawing session) lives on after the widget closes, since a lazy module loads once and stays loaded. State in the component is lost on close, as before.

Add `icons: { mobile: iconMobile }` only for a different icon shape on one surface (layer-list has a simpler mobile icon).

## Settings

A widget's settings live under its id in a project's `settings.json`:

```json
"widgets": {
  "my-widget": { "greeting": "Welcome" }
}
```

Declare them in `settings.ts` as `settings`, a `z.strictObject`. That one schema is all there is: projects are validated against it, `settings.json` shows its descriptions on hover, and the Conness editor builds the widget's block from it.

- Make every field `.optional()`, and apply its default in the widget (`config?.greeting ?? 'Hello!'`). The schema's `default` is for hover and the editor; it isn't filled in for you.
- Read them in the widget with `widgetSettings`, typed by your schema:

  ```ts
  import { widgetSettings } from '@/core/widgetSettings'
  import { about, type MyWidgetSettings } from './settings'

  const config = widgetSettings<MyWidgetSettings>(about.id)
  ```

  Never read `settings.<id>` or `settings.widgets` directly.
- Describe each field with `.meta()`:

| Key | What it does |
|---|---|
| `description` | Hover text in `settings.json` and the editor's description bubble. |
| `default` / `defaultText` | The default, as a value (`20`) or in words (`'all four'`); shown on hover and dimmed in the editor. |
| `see` | A docs link, shown on hover. |
| `label` | The editor's row name. Without it, the key in words (`maxItems` → "Max items"). |
| `advanced: true` | Puts the row under the block's collapsed **Advanced**. Leave it off for the settings most projects change; use it for fine-tuning. |
| `dependsOn: { path, equals? }` | Hides the row while another of this widget's settings is off, or isn't `equals`. `path` is relative to the widget (`'actions.export'`). |
| `editor: '<screen>'` | A list edited on one of the editor's screens (Search's `layers` uses `'search-layers'`); the row becomes a link to it. |

A nested object (`defaultStyle: z.strictObject({…})`) becomes its fields' rows, in place; `advanced: true` on the object makes all of them advanced.

### How a widget shows in the Conness editor

Under Widgets, each widget has a block. Top to bottom:

1. Its name and **On** switch (placed anywhere or not).
2. **Where** (the surfaces in `about.surfaces`) and **On mobile**.
3. **Show info section**, only if the widget renders an `InfoSection`.
4. Its placement options: **Panel width** (not in the side rail), and when floating **Opens** and **Stay on mobile**, defaulting to `about.defaults`.
5. Its own settings without `advanced`, in the order the schema lists them.
6. **Advanced** (collapsed): its settings with `advanced: true`, in schema order, then **Show title** and **Show divider** (its panel header, following Widget Headers until set).

So order your schema's keys the way they should read, most-used first.

## Placing it

A widget appears only once a project's `settings.json` (`app/projects/<name>/`) places it, on a surface `about.surfaces` lists:

```json
"topBarWidgets": [{ "widgetName": "my-widget" }],
"sidePanelWidgets": [{ "widgetName": "layer-list" }],
"floatingWidgets": [{ "slot": "top-right", "widgets": [{ "widgetName": "coordinates" }] }],
"mobileWidgets": ["layer-list", "my-widget"]
```

A placement can override `panelWidth`, `header` (`showTitle`, `showDivider`), and for floating widgets `order`, `opens` and `stayOnMobile`. A surface the widget doesn't declare stops the app at boot with an error. On mobile, top-bar and side-panel widgets open from the carousel in `mobileWidgets` (a widget can be listed there without a desktop placement); floating widgets keep their map-corner buttons. The editor does all of this from the widget's block.

## Phone version

On phones a widget opens in the bottom sheet (a `stayOnMobile` floating widget stays over the map). By default it shows the same `Widget.tsx` there. When the phone needs a different layout, give `Widget.tsx` a `mobile` prop and add a `Widget.mobile.tsx` that is only the wrapper:

```tsx
import { MyWidget } from './Widget'

export const MyWidgetMobile = () => <MyWidget mobile />
```

Point the manifest's `mobileComponent` at it. The shell shows it in the mobile layout and `Widget.tsx` everywhere else. Inside `Widget.tsx`, `mobile` switches only layout (`{!mobile && <InfoSection>…}`, `row={mobile}` on a `ToolButtonGrid`, a block moved up), so the two never drift apart: the state, hooks and actions are the same code. `_template/`, `basemap/` (smaller thumbnails, the switches after the list), `draw/`, `measure/` and `bookmarks/` all do this.

- A small difference in behavior, not layout, can stay an `isMobile` check instead (Search closes its result list on a pick).
- Phone views drop the `InfoSection`, since the sheet has little room.
- When a window crosses the breakpoint, the open widget moves to the other layout and remounts, so it keeps only what it keeps on close: state at a module's top level or in the store survives, state in the component doesn't.

## Map and state

```ts
import { useMap, useMapReady, useMapClickLock } from '@/core/hooks'
import { useStore } from '@/core/store'
```

- `useMap()` returns the MapLibre map or `null`; `useMapReady()` turns true once the style has loaded. Wait for both before touching the map.
- `useStore` is the one Zustand store. Read slices with a selector, `useStore((s) => s.layerMetadata)`. The ones widgets use most: `layerMetadata` (per-layer visibility, opacity, labels), `currentBasemapId`, `isMobile`, `selectedFeatures` (popup state), and `layerBoundsGetters` / `layerFeatureGetters` (zoom to extent, export). In event handlers, read current state with `useStore.getState()`.
- `useMapClickLock(owner, active)`: if your widget uses map clicks (drawing, measuring, picking a point), claim them while the tool is out or a feature is being edited. Popups and their feature highlight stay off while any widget holds a claim. Set your own cursor while you hold it. Don't claim while the widget is merely open. Draw, Measure and Coordinates all use it.
- A basemap switch swaps only the basemap's own layers, so the sources and layers you added stay. Switch basemaps only through `selectBasemap(map, id, style)` in `@/core/map/basemapSwitch`, never `map.setStyle()`, which would remove every data layer. It also records the new basemap, so the Basemap widget and bookmarks stay in step.

## Shared building blocks: `@/ui`

Use these before writing your own, so every widget looks and behaves the same. They're styled with theme tokens and work on every surface, floating pop-outs included.

| Import | Use it for |
|---|---|
| `@/ui/icons` | In-widget glyphs: `TrashIcon` (delete data), `CloseIcon` (dismiss), `EditNameIcon` (rename), `DownloadIcon`, `CopyIcon`, `CheckIcon`, `ChevronIcon` (`direction`), `EyeIcon` / `EyeOffIcon`, `CheckboxIcon`, `FilterIcon`, `KebabIcon`, `ZoomToExtentIcon`, `ExternalLinkIcon`. They draw in `currentColor`. |
| `@/ui/IconButton` | An icon-only button. `label` becomes its aria-label and tooltip; `variant` is `default`, `danger` or `primary`. |
| `@/ui/ActionButton` | A labeled button with an optional leading icon. `variant`: `danger` (Clear All), `save`, `success`, `neutral` (Download, Copy). |
| `@/ui/ToolButtonGrid` | The two-column grid of map tools with an active state (Draw, Measure). `row` puts them on one line for phones (wrapping when the row is too narrow), showing a tool's `shortLabel` when it has one. |
| `@/ui/ItemRow` | `ItemRow` + `ItemRowLabel`: one row of an item list with the standard hover tint, an optional color dot, and room for `IconButton`s. `active` keeps the highlight on. |
| `@/ui/RenameInput` | Inline rename in a row. Enter or blur saves, Escape cancels, an empty name cancels. |
| `@/ui/EmptyState` | The placeholder for an empty list: a title and an optional hint. |
| `@/ui/Spinner` | A small loading spinner in theme colors (`size` in px). Pair it with text or an `aria-busy` parent. |
| `@/ui/RangeSlider` | A two-thumb slider for a min–max range (`value: [lo, hi]`, `onChange`), with an optional `marker` tick. The Layer List's Zoom Range uses it. |
| `@/ui/showBusy` | The same spinner on a plain-DOM button (a map control, say): `const done = showBusy(button)` hides its icon behind the spinner and sets `aria-busy`, and `done()` puts it back. |
| `@/ui/InfoSection` | A collapsed "Info" box at the top of a widget explaining how to use it. A project hides it per widget (`ui.hideWidgetInfo`, the editor's Show info section); it finds its widget by itself. |
| `@/ui/ChoiceDialog` | A "pick one" pop-up: a title and a list of choices, each with an optional description. Draw uses it for download formats. |
| `@/ui/ConfirmDialog` | "Are you sure?" prompts. Render it inside your widget's root and give that root `relative`. `variant="danger"` for anything destructive. |
| `@/ui/ToggleSwitch` | An on/off switch. Always pass `ariaLabel`, and put a text label next to it. |
| `@/ui/useCopyToClipboard` | `const { copied, copy } = useCopyToClipboard()`; `copy(text, key?)` sets `copied` to the key for about a second. |
| `@/ui/useSavedItems` | A named list saved in the browser (bookmarks, drawing sets): `add`, `replace` by name, `rename`, `remove`, `findByName`, and an optional `maxCount`: at the cap `add` returns `false` and saves nothing, and `full` is true, so you can show a limit warning. `saveFailed` is true when the last change didn't reach storage. Your widget owns the overwrite and delete prompts. |

Bookmarks and Draw's Saved Drawings are the clearest examples of these pieces working together.

Two map helpers in `@/core` cover what Draw and Measure share, for any widget that draws on the map:

| Import | Use it for |
|---|---|
| `@/core/map/persistentOverlay` | Layers that stay on the map after your widget closes. `removeOverlay(map, { layers, sources })` removes them. `onSourcesLoaded(map, sourceIds, fn)` runs `fn` once those sources have drawn: add the new layers first and remove the old ones in `fn`, so a swap doesn't blink. |
| `@/core/map/mapboxDraw` | Widgets built on mapbox-gl-draw. `addMapboxDraw(map, styles)` adds it with the MapLibre fixes and no built-in buttons; `removeMapboxDraw`; `drawLayerIds(map, styles)` lists its rendered layers for `queryRenderedFeatures`; `setDrawVertexColor(map, vertexStyleId, color)`. |

If your widget throws while rendering, only its own pane is affected: it shows "This widget couldn't load" and the error goes to the browser console. The map and other widgets keep working, and reopening the widget tries again.

## Styling

Use the theme's Tailwind classes so a widget follows the project's `theme.json`, dark presets included: `bg-panelBg`, `border-panelBorder`, `text-text` (body text, inputs, dropdowns), `text-strongText` (names, titles, and an icon button's hover: `hover:text-strongText`), `bg-surface` (info-style blocks, section headers), `bg-layerGroupBg` (group rows), `bg-primary` / `text-primary`, `bg-danger`, `bg-save`, `bg-success`, `bg-actionActive` / `bg-actionNotActive`. Raw palette classes such as `bg-white` or `text-slate-900` stay light in dark presets. The full token list is on the [Theme](https://conness-gis.com/configuration/theme/) page.

Two global helper classes: `kit-row-hover` (the standard list-row hover, used by `ItemRow`) and `kit-scrollbar` (a thin scrollbar that stays visible in small scroll boxes).

**Text sizes:** only the kit's six, which follow `ui.textSizes`: `text-small` (11px: fine print, badges), `text-medium` (12px: captions, layer names), `text-large` (14px: inputs, list rows, group names, longer reading), `text-title` (14px: titles), `text-button` (14px: buttons) and `text-dialogButton` (12px: dialog Cancel/Confirm). `ActionButton` and `ToolButtonGrid` already use `text-button`. In widget CSS, `font-size: var(--text-medium)` etc. Never Tailwind's own sizes (`text-xs`, `text-sm`, …) or px/rem sizes like `text-[11px]`: `scripts/text-sizes.test.ts` fails on them. Give text a color class too (`text-text`, `text-strongText`, …); unclassed text falls back to `text`.

**Inputs on phones:** text boxes, selects and textareas are forced to 16px under the mobile breakpoint (`src/index.css`), since iOS zooms into anything smaller. Your widget's input sizes apply on desktop only.

If a widget needs its own CSS file, put it in `assets/`, scope it under a widget class, and use `var(--color-<token>)` instead of hex. Write font sizes, control sizes and spacing in rem (px ÷ 16) and keep px for borders. Draw and Measure do this.

Colors painted on the map are the exception: MapLibre layer paint can't read CSS variables, so map colors are plain strings (see `HOVER_COLOR` in `@/core/map/mapboxDraw`).

## Icons

The launcher icon is `assets/icon.svg`, imported in `widget.config.ts`. Draw it on a 24×24 `viewBox` with `stroke-width="2"` and round caps and joins, in any single color: the shell uses only its shape and tints it from the theme for each surface.

Glyphs inside your widget's UI come from `@/ui/icons`. Add a new shared glyph there if more than one widget will use it; one-off glyphs can stay in the widget.

## Libraries already installed

MapLibre GL (`maplibre-gl`), `@turf/turf` for geometry math, `@mapbox/mapbox-gl-draw` for drawing and editing on the map (Draw and Measure wire it to MapLibre), React, Zustand, Zod and Tailwind. Check `app/package.json` before adding a dependency.

## Conventions

- Comments are rare and lowercase, and only explain why something non-obvious is done.
- A widget never imports another widget. Shared code goes in `@/ui` or `@/core`.
- Shell code under `app/src/` imports user files through `@user/…`; widgets import the shell through `@/…` (except `settings.ts`, which uses relative `.ts` imports).

## Common mistakes

- Importing React, a component, CSS or an asset in `settings.ts`: Node and the editor read that file and can't load them.
- A setting without `.optional()`: every project that doesn't set it fails validation.
- Reading the widget's settings from `settings.<id>`: they're under `widgets.<id>`; use `widgetSettings<T>(about.id)`.
- `about.id` different from the folder name, or a duplicate id: the app stops at boot.
- Tailwind's text sizes or hex colors: use the kit's text sizes and theme classes.
- Writing a new list, button, dialog or spinner: check `@/ui` first.

## Examples to read

- `_template/`: the smallest widget with one setting and a phone view.
- `basemap/`: a phone view with smaller rows and the switches moved below.
- `coordinates/`: small, uses the map, the click lock and the copy hook.
- `bookmarks/`: a saved list with rename, overwrite and delete prompts, and one setting (`maxCount`).
- `layer-list/`: a large widget with a drill-in sub-view in `components/`, and settings with a nested object and a `dependsOn`.
- `search/`: settings with a list edited on its own editor screen (`editor: 'search-layers'`).
- `draw/` and `measure/`: map tools with controllers in `lib/`, their own CSS in `assets/`, mostly advanced settings, and phone views with the tools on one row (Measure moves its live total to the top).
