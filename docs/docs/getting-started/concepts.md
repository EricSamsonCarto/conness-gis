---
icon: lucide/lightbulb
---

# Concepts

The project splits its files into your files and shell code:

```
app/
├── projects/            ┐
│   ├── demo/            │  one folder per app (a "project"):
│   │   ├── settings.json│    settings.json, layers.json, layers/,
│   │   ├── layers.json  ├─ USER SURFACE (yours to edit)
│   │   └── …            │    basemaps.json, theme.json, symbology.json,
│   └── city-parcels/    │    popups.tsx, info.md, public/
├── widgets/             ┘  shared by every project
│
├── templates/basic/     ─ the starter New project copies (never built)
├── editor/              ─ the editor (npm start)
├── schema/              ─ JSON Schema for hover help in the .json files
├── src/                 ─ SHELL (framework code; rarely touched)
│   ├── core/            │   state, layer loaders, popups, theme, registry
│   └── shell/           │   AppShell, TopBar, panels, MapView, …
├── scripts/             ─ npm commands (dev, build, new, …)
└── index.html, vite.config.ts, …
```

Everything you configure lives in a project folder, and custom widgets live in `app/widgets/`. One install can hold many projects. The editor will list them, and each command takes a project's name (`npm run dev mammoth-lakes`). The shell reads the chosen project's config and renders the app. You rarely edit the shell, so a new release can replace it without touching your files.

- `@/…` → `app/src/…` (the shell)
- `@user/…` → the chosen project's folder, `app/projects/<project>/` (your files)

So shell code reads your config as `@user/settings`, `@user/popups` and so on, and never knows which project it's running.

## The settings object

Your project's config is plain JSON, which the editor reads and writes for you. `settings.json` holds branding, the map's starting view, UI settings, map controls, the context menu, per-widget settings (search, measure, draw, bookmarks), where each widget is placed, and whether the app is commercial.

```json
{
  "$schema": "../../schema/settings.schema.json",
  "branding": { "title": "My App" },
  "ui": { "layout": { "showInfo": true } },
  "map": { "style": "https://tiles.openfreemap.org/styles/positron", "center": [-98.5, 39.5], "zoom": 4 },
  "topBarWidgets": [{ "widgetName": "measure" }],
  "sidePanelWidgets": [{ "widgetName": "layer-list" }, { "widgetName": "legend" }],
  "floatingWidgets": []
}
```

The [Configuration](../configuration/branding.md) section documents it field by field. A few parts live in their own files, to keep `settings.json` readable. The app reads them into the same settings:

| File | Becomes | See |
|---|---|---|
| `layers.json` | `settings.layers` | [Adding Layers](../configuration/adding-layers.md) |
| `basemaps.json` | `settings.basemaps` | [Map & Camera](../configuration/map-camera.md#basemaps) |
| `theme.json` | `settings.theme` | [Theme](../configuration/theme.md) |
| `symbology.json` | named styles for `{ "kind": "ref" }` | [Symbology](../configuration/symbology.md) |

So the docs write a setting's path as `settings.layers`, `settings.theme.preset` and so on, whichever file it's written in. Layer data files go in the `layers/` folder or are hosted elsewhere. Popup templates are React components, so they stay as code, in `popups.tsx`.

Every setting has a description, default and docs link built in. In the editor, click a setting's name to read them. Each JSON file's first line, `"$schema"`, points VS Code (and other editors that read JSON Schema) at that file's schema in `app/schema/`. Hover a key to read about it. Autocomplete lists the keys and values each spot takes.

### Checking your files

The editor checks your settings as you change them and shows a problem under the setting it's about. Save and Build wait until they're fixed. `npm run dev` and `npm run build` run the same checks on the files before the app starts. Unknown keys are errors, so a typo like `"zooom"` doesn't pass silently. Every problem will show its file and the exact spot:

```text
app/projects/demo: has 2 problems in its JSON:
  layers.json → layers[3]: Unrecognized key: "zooom"
  settings.json → ui.popups.height: Invalid input
```

In `npm run dev` the list shows in the terminal and over the page. Fix the files and save, and the page will reload. A build stops until they're fixed. A few checks that depend on more than one setting (a layout collision, a search provider that doesn't allow commercial use) still run when the app starts, as before.

One thing stops `npm run dev` and `npm run build` before these checks: a project made with an older release whose settings have since changed. It's checked once it's upgraded, by opening it in the editor or running `npm run upgrade <project>`.

## Widgets are auto-discovered

A widget is a self-contained folder under `app/widgets/`. At build time the shell finds every `app/widgets/*/widget.config.ts` and reads its `manifest`, so adding a folder is enough. There's no central registry to edit.

When you create a new one, you will have to reload th editor UI for it to appear. Sometimes you have to restart the terminal that it's running in entirely for it to show up.

Each manifest lists the surfaces the widget can be placed on:

- `top-bar`: an icon button in the top bar. Its UI opens in a panel beside the map, opposite the side rail
- `side-panel`: an icon in the side rail. Its UI slides out beside the map
- `floating`: a button floating over a corner of the map

Discovery skips folders whose name starts with `_`. That's how `_template` stays out of your app. You can create your own testing widgets this way if you would like, that way they don't get picked up. Note: only widgets that are turned on within your project from the editor UI or in the settings file get bundled into the app at build, so don't worry about extra bloat of unused widgets ending up in your front-facing application.

In the editor, you turn a widget on and choose where it goes under Widgets. In the files, you place it by adding its `id` in `settings.json`:

```json
"topBarWidgets": [{ "widgetName": "measure" }, { "widgetName": "draw" }],
"sidePanelWidgets": [{ "widgetName": "layer-list" }, { "widgetName": "legend" }],
"floatingWidgets": [{ "slot": "top-left", "widgets": [{ "widgetName": "search" }] }],
"mobileWidgets": ["layer-list", "legend", "measure", "draw"]
```

On phones the widgets in `mobileWidgets` become a carousel, and each opens in a bottom sheet. The carousel sits in the top bar, or in its own bar under the map with [`ui.layout.mobileWidgetBar`](../configuration/ui-layout.md#mobile-widget-bar) set to `"bottom"`.

A widget can be placed on more than one surface. See [Placing Widgets](../widgets/placing-widgets.md) and [Building a Custom Widget](../guides/custom-widget.md).

## The resolve / merge order

Almost every setting is optional and has a default, so removing a key falls back instead of erroring. When a setting can be set at more than one level, the most specific one wins:

> **kit default ← global setting ← per-item override**

A popup's trigger, for example, resolves as the kit default (`"click"`) ← `settings.ui.popups.trigger` ← the layer's own `popup.trigger`. Widget headers, layer-list actions and label styling work the same way. Wherever these docs say "defaults to X", X is the start of one of these chains.

So you can set something once globally and override it for one layer or one widget, without repeating yourself.

[Internals](../internals/architecture.md) goes deeper for contributors. Day to day, you'll use [Configuration](../configuration/branding.md) and [Widgets](../widgets/placing-widgets.md).
