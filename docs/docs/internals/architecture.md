---
icon: lucide/network
---

# Architecture

This section is for contributors working on the shell (`app/src/`), the framework code behind the user files. If you're building an app, you want [Configuration](../configuration/branding.md) and [Widgets](../widgets/placing-widgets.md) instead.

## Directory map

```
app/src/
├── main.tsx                  # entry: applies theme + UI vars, mounts AppShell
├── user-modules.d.ts         # types for the @user/… imports, so the shell typechecks with no project
├── index.css                 # Tailwind + @theme token vars + global rules
├── core/                     # framework logic (no JSX chrome)
│   ├── schema/               # Zod schemas for every setting: descriptions, defaults, docs links (the source of the config types)
│   ├── types.ts              # the config types (z.input of the schemas, same names as ever) + runtime types
│   ├── store.ts              # the Zustand store
│   ├── hooks.ts              # useMap / useMapReady
│   ├── widget-types.ts       # WidgetManifest / WidgetAbout / WidgetPlacement
│   ├── widgetSettings.ts     # widgetSettings<T>(id): a widget's own settings (widgets.<id>)
│   ├── storageKey.ts         # appId-namespaced localStorage keys + loadStored / saveStored
│   ├── configError.ts        # shared boot-time error shape (see Config validation)
│   ├── infoDismiss.ts / useMediaQuery.ts  # info-modal "don't show again", mobile signal
│   ├── widgets/              # registry.ts (widget discovery via virtual:widget-configs + resolveWidget), placedWidgets.ts (the ids a project places), layout.ts (resolveLayout / validateLayout)
│   ├── theme/                # theme.ts (applyTheme, DEFAULT_COLORS), themes.ts (the built-in presets), palette.ts (shared colors for Draw and PMTiles), uiVars.ts (applyUiVars: settings.ui sizes, cursor, shadows → CSS vars)
│   ├── map/                  # map helpers, below
│   │   ├── mapState.ts       # captureMapState / applyMapState: the bookmark snapshot (camera, basemap, globe, terrain, layers, filters)
│   │   ├── basemapSwitch.ts  # switchBasemap, selectBasemap, withoutBasemapProjection (boot style)
│   │   ├── basemapLayers.ts  # the switch itself: swaps only the basemap's layers and sources
│   │   ├── globe.ts / globeAtmosphere.ts / terrain.ts  # globe projection + stars/comets/halo, raster-DEM terrain source
│   │   ├── mapboxDraw.ts / persistentOverlay.ts  # shared by Draw + Measure, incl. drawEvents (any widget can use them)
│   │   └── useDataLoading.ts # the loading overlay's signal
│   ├── export/               # download.ts (downloadFile / downloadGeoJSON, EXPORT_FORMATS) + writeKML.ts / writeGeoParquet.ts / writeCSV.ts (GeoParquet loads hyparquet-writer on demand)
│   ├── preview/              # dev-only, the editor's Preview Pane: previewCamera.ts (questions, camera and state kept across reloads), liveSettings.ts (live changes)
│   ├── duckdb/               # engine.ts (shared DuckDB-WASM), readGeo.ts, tileTable.ts + tileProtocol.ts (mvt tiles)
│   ├── layers/               # the layer pipeline (see Layers & Loaders)
│   ├── filters/              # layer-list filter compile / apply / validate (+ compile.test.ts, npm run test)
│   ├── popups/               # popup resolve + handlers + the selected-feature highlight (see Popups)
│   ├── legend/               # symbology introspection (see Legend)
│   ├── search/               # geocoder providers + in-layer feature search
│   └── contextMenu/          # right-click menu actions
├── ui/                       # the UI kit widgets and chrome share (imported as @/ui/…)
│   ├── icons.tsx             # in-widget glyphs (trash, close, chevron, eye, …)
│   ├── ConfirmDialog / ToggleSwitch / InfoSection
│   ├── IconButton / ActionButton / EmptyState / ToolButtonGrid / ItemRow / RenameInput
│   ├── ChoiceDialog / DialogFrame / Spinner / RangeSlider
│   ├── showBusy.ts           # the Spinner look on a plain-DOM button (globe, terrain)
│   └── useCopyToClipboard.ts / useSavedItems.ts
└── shell/                    # the React chrome
    ├── AppShell.tsx          # the root: one tree for desktop + mobile, so the map never remounts
    ├── MapView.tsx           # creates the MapLibre map (setWorkerUrl for MapLibre 6's worker); registers layers/popups
    ├── mapControls.ts        # native MapLibre controls from settings.mapControls
    ├── scaleBar.ts           # the scale bar control, four styles, replaces MapLibre's
    ├── TopBar / MobileTopBar / SidePanel / RightPanel / FloatingSlots / MobileSheet …
    ├── PopupHost / PopupContent / ContextMenu / InfoModal / LoadingOverlay
    ├── ErrorBoundary.tsx / BootError.tsx  # boot-time error display (see Config validation)
    ├── WidgetBoundary.tsx    # keeps one widget's render error inside its own pane
    └── WidgetIcon.tsx        # widget launcher icons, tinted by the theme (CSS mask)
```

The widgets themselves live outside `src/`, in `app/widgets/`, one folder each; `app/widgets/WIDGETS.md` describes their layout.

## Projects and commands

The user files are per project, in `app/projects/<project>/`; the starter `npm run new` copies is `app/templates/basic/`. The npm commands that work on a project go through `app/scripts/`:

| File | Role |
|---|---|
| `run.mjs` | `npm run dev / build / preview [project]`: picks the project (the first plain word; flags like `--host` pass through), sets `CONNESS_PROJECT`, runs the step. `build` runs `tsc -b`, `vite build`, then `build-report.mjs`, `check-keys.mjs` and `archive.mjs` (the dated zips) |
| `project.mjs` | `resolveProject`: the named project, else the only one; several or none stop with how to fix it. A project is a folder with a `settings.json`; folders starting with `_` are never projects |
| `new-project.mjs` | `npm run new "Name"`: copies the template, sets `branding.title` / `appId` in `settings.json`, `-2` on a clash |
| `project-config-plugin.ts` | `loadProject`: reads the project's five JSON files (or `overrides` in their place, the editor's unsaved edits), validates them against `core/schema/`, and assembles `settings`; `api.setDraft` serves a draft instead of the files until it's cleared; serves it and `symbologies` as the virtual modules behind `@user/settings` and `@user/symbology`; refreshes `app/schema/*.schema.json` at dev and build start (see [Config validation](#config-validation)); also serves `@user/layer-files` (only the local data files `layers.json` points at) and `@user/basemap-thumbnails` (each basemap's thumbnail, the project's `basemap-images/` before the catalog's), so a build carries only what the project uses |
| `formatJson.ts` | the JSON style project files are written in: a container on one line when it fits, else one entry per line. `npm run new` uses it |
| `upgrades.ts` | `npm run upgrade [project]`, and the upgrade that opening and importing a project run: brings a project made with an older release up to this one (see [Upgrades](editor.md#upgrades)) |
| `widget-settings.ts` | `loadWidgetModules` / `widgetSchemas`: every `widgets/*/settings.ts` (not `_` folders), read synchronously with Node's `require()` of ES modules, so `loadProject` stays synchronous. Its `about` feeds `/api/widgets`; its `settings` schemas feed validation and the JSON schemas through `projectFiles` / `withWidgets` (`core/schema/settings.ts`), which put each widget's schema under `settings.json`'s `widgets.<id>` |
| `widget-configs-plugin.ts` | the `virtual:widget-configs` module behind the widget registry (see [Widget Registry](registry.md)) |
| `projects-api-plugin.ts` | the editor's `/api/projects` and `/api/widgets` endpoints behind `npm start`; see [The Editor](editor.md) |
| `app-servers.ts` | the editor runs the app's own Vite servers: `preview` serves the unsaved edits, `saved` only the files on disk |

The tests (`*.test.ts` beside the code in `src/` and in `scripts/`) run with `npm run test`, on Node's built-in runner. They're in the GitHub repo only. The release zip leaves them out through `.gitattributes`.

`vite.editor.config.ts` is the editor's own config (`npm start`, dev-only, never built). [The Editor](editor.md) covers how it reads and writes projects and drives The Preview Pane.

`vite.config.ts` resolves the same project: it points `publicDir` (logo, favicon) and `build.outDir` (`dist/<project>/`) at it, and sets the `@user` aliases in order: `@user/settings` and `@user/symbology` go to `project-config-plugin.ts`'s virtual modules, and everything else under `@user/` (`popups.tsx`, `info.md?raw`, `layers/`) to the project's folder. Local layer files resolve through `import.meta.glob('@user/layers/**')` in `layers/resolveLayerUrl.ts`, whose `/projects/<id>/layers/…` keys are matched against the `./layers/…` paths in `layers.json`. The shell never names a project; `src/user-modules.d.ts` types what it imports (`@user/settings`, `@user/popups`, `@user/symbology`).

The config types come from the Zod schemas in `core/schema/`: `types.ts` exports them as `z.input<…>` under the names they always had, so engine code imports `LayerConfig`, `Settings` and the rest as before. The imports are type-only, so Zod never reaches a built app. The schemas record each setting's default for hover and the editor, but validation passes the JSON through as written; the engine applies its defaults itself (the [merge convention](#the-merge-convention)). A new setting goes in the schema first: `.optional()`, with `.meta({ description, default, see })` (`defaultText` for a default in words), and the engine reads it with its own fallback.

## The boot lifecycle

1. **`main.tsx`** applies the theme and UI CSS variables before the first render, so the first paint already has the right colors. It then imports `<AppShell>` dynamically and mounts it; [Config validation](#config-validation) explains why the import is dynamic.
2. **`<AppShell>`** validates the layout, search, layer filter and theme settings. A same-side layout collision, `widgets.search.geocoder.provider` set to `"nominatim"` with `commercialUse` on, an unknown `theme.preset`, or a CSS color (hex, `rgb()`…) in `theme.colors` throws here. It then reads `settings.ui.info` to decide whether to open the info modal, and renders the layout for `isMobile`. Both layouts share one tree: a top bar above a row of left slot, map and right slot. On desktop the side rail and top-bar panel fill the slots by side, and the map area holds `PopupHost` and `ContextMenu`. On mobile the top bar is `MobileTopBar`, the slots are empty, and the map area holds `MobileSheet`. The map area and its `MapView` stay in the same place either way, so crossing the breakpoint swaps the chrome without rebuilding the map.
3. **`<MapView>`** creates the MapLibre map without a style, then applies `settings.map.style` with `setStyle(style, withoutBasemapProjection)` (see the warning below). It adds the native controls and, on the `'load'` event, records the boot basemap's layers and sources (`recordBootBasemap`) and sets `isMapReady`. A second effect then registers layers and popup handlers, once.
4. A **basemap switch** (`selectBasemap`: highlights the new basemap at once, and gives the highlight back to the one on the map if the style fails) swaps only the basemap's own layers and sources (see the warning below). Data layers, popup handlers, globe, terrain and widget layers stay as they are, and `style.load` doesn't fire, so nothing registers again.

!!! warning "Switch basemaps with `switchBasemap()`, not `map.setStyle()`"
    `setStyle()` would remove every data layer, because the new basemap's style doesn't list them. `switchBasemap()` (`core/map/basemapSwitch.ts`) calls `swapBasemap` (`core/map/basemapLayers.ts`), which keeps the style that's loaded and changes only the basemap part of it:

    1. Fetch the new style JSON. If that fails, the current basemap stays and the console says why.
    2. Remove the previous basemap's layers and sources (the ones recorded at boot, or added by the last switch).
    3. Add the new ones with a `basemap:` prefix on every id, so they can't collide with yours, below the lowest data layer.
    4. Swap fonts and icons with `setGlyphs` and `setSprite`. A style without `glyphs` (a raster basemap such as Esri satellite) keeps the previous fonts, so your labels still draw.

    The style's own `projection`, `sky`, `terrain` and `light` are left out: only `settings.map.globe`, the globe control and the terrain control set those. The boot style gets the same treatment from `withoutBasemapProjection`, a `transformStyle` that removes `projection` and `sky` (VersaTiles declares a globe projection, which would otherwise turn the globe on by itself). `switchBasemap()` resolves once the map is idle with the new basemap drawn, or at once if the switch failed or a later click replaced it. The Basemap widget and bookmark restore call it through `selectBasemap(map, id, style)`, which also records the basemap in the store (`currentBasemapId`) and hands the highlight back if the switch fails. Any new caller should use `selectBasemap` too. `switchBasemap(map, null)` removes the basemap group and adds nothing, keeping glyphs and sprite; the store and bookmarks record that as `NO_BASEMAP_ID` (`'none'`).

## Config validation

Config problems are caught at two points.

**When the project's files are read.** `loadProject` (`scripts/project-config-plugin.ts`) first refuses a project that has an upgrade due or was made with a newer release (`upgradeProblem` in `scripts/upgrades.ts`), naming `npm run upgrade <project>` or the editor as the fix. The editor's draft skips this, since it's upgraded already. Then it parses the five JSON files and checks each against its schema before any code that uses them runs: at `npm run dev` start, on every save in dev, and before a build. The objects are strict, so an unknown key is an error, apart from the free-form spots (raw paint and layout, inline basemap styles, popup `fields`, `layerGroups` names). Every issue in every file is collected into one `configError`, one line per issue as `<file>.json → <path>: <message>`. In dev it's logged at startup and thrown from the virtual module's `load`, so Vite's overlay shows it and a fixed save recovers; in a build it stops the build. Invalid JSON names the file and the parser's position.

**At boot,** for what a schema can't see: checks across settings, or against what the app has (widget manifests, theme presets, popup templates). Most of these throw instead of rendering something broken or quietly wrong. Every throw goes through one helper, `configError({ where, why, fix })` in `core/configError.ts`, so messages have the same shape: where the problem is (a `settings` path or a widget file), why it's invalid, and how to fix it. Each check lives next to the feature it guards; there's no central validator.

| Where | Throws when |
|---|---|
| `widgets/layout.ts`: `validateLayout` | the top-bar panel opens on the side rail's side while both have widgets |
| `widgets/registry.ts`: `assertSurfaceSupported` | a widget is placed on a surface its manifest doesn't list |
| `widgets/registry.ts`: `getWidgetManifest` | a widget name doesn't exist |
| `widgets/registry.ts`: `resolveMobileWidgets` | a `mobileWidgets` entry has no surfaces |
| `widgets/registry.ts`: widget registration | a widget file has no `manifest` export, or its `id` doesn't match its folder name |
| `widget-configs-plugin.ts` (build only) | a placed widget name has no widget folder; the build stops |
| `search/providers.ts`: `validateSearchConfig` | `widgets.search.geocoder.provider` is `'nominatim'` while `commercialUse` is `true` |
| `filters/validate.ts`: `validateLayerFilters` | a layer has `filters` on an unsupported type, or lists a column twice |
| `theme/theme.ts`: `validateThemeConfig` | a `theme.colors` value is a CSS color (hex, `rgb()`…), or `theme.preset` names a preset that doesn't exist (the schema already catches that when the files are read; this guards the list in `themes.ts`) |

These checks run at two different times. `validateLayout`, `validateSearchConfig`, `validateLayerFilters`, `validateThemeConfig` and the widget registration checks run when their modules load, before React renders anything. A throw during a static import would happen before any code in `main.tsx` runs, including its own `try/catch`, so `main.tsx` imports `<AppShell>` dynamically inside a `try/catch`. `assertSurfaceSupported`, `getWidgetManifest` and `resolveMobileWidgets` run during React's render (inside `resolveWidget`), so `<AppShell>` is also wrapped in an `ErrorBoundary`. Both paths show the same `BootError` screen, with the full message in dev and a generic one otherwise. A widget's own render errors don't get that far: each place a widget mounts wraps it in `WidgetBoundary`, which shows "This widget couldn't load" in that pane only (an `ErrorBoundary` with a `fallback`).

Layer and popup config errors are the exception: they're thrown while `MapView` registers layers and popups, inside its own `try/catch`, so they only reach the browser console. A duplicate layer id, a top-level `opacity` or an unknown symbology `ref` logs `Failed to register layers` and no layers load. A mistake inside one layer (a PMTiles source layer listed twice, a tile template without `sourceLayers`, raw paint without a geometry) logs `Skipping layer "<id>"` and only that layer is missing. An unknown popup `displayType` logs `Failed to register popups` and every popup stays off.

Every message the kit writes to the browser console starts with `[conness-gis]`, so they're easy to filter.

!!! note "Boot checks report only the first problem"
    Unlike the schema check, which lists everything, each boot check throws right away, so a second problem only shows up after the first is fixed and the page reloads.

## The store

State lives in one Zustand store (`core/store.ts`), read with `useStore`. The main slices:

| Slice | Purpose |
|---|---|
| `map` / `isMapReady` | The MapLibre instance, and whether it's ready |
| `isMobile` | Whether the mobile or desktop layout renders: below 500 px wide (`MOBILE_BREAKPOINT_PX` in `useMediaQuery.ts`). The only place this is decided |
| `layerMetadata` | Per-layer runtime state (visibility, opacity multiplier, labels). The layer list and legend read it. PMTiles parent rows and their children are linked through `isParent` / `childIds` / `parentId` |
| `layerBoundsGetters` | Per-layer Zoom to Extent functions, set by `registerLayers` |
| `layerFeatureGetters` | Per-layer Export Data feature getters, set by `registerLayers` (`geojson` and `geoparquet` only) |
| `pendingLayerData` / `loadingStatus` | Layers whose data is still arriving (DuckDB, deferred loads, FlatGeobuf, PMTiles metadata; drives the layer list's spinner), and DuckDB's current startup step; both feed the [loading overlay](layers.md#loading-overlay) |
| `layerFilters` / `layerFilterHandlers` | Per-layer filter state (cleared on reload) and each loader's filter mechanism |
| `openWidgetId` / `activeFloatingWidgetId` / `mobileSheetWidgetId` | Which widget is open on each surface |
| `currentBasemapId` | The current basemap |
| `collapsedGroups` / `seenGroups` | Layer list group state, kept here so it survives the widget closing |
| `expandedParents` | Which PMTiles parent rows are open in the layer list (they start collapsed unless the layer sets `collapsed: false`) |
| `popupLayerOverrides` | Popup targets a loader decided at load time, keyed by settings layer id (PMTiles: one per drawn source layer); see [Popups](popups.md) |
| `selectedFeatures` / `selectedFeatureIndex` / `selectedFeatureTrigger` | Popup state |
| `popupPosition` / `popupSize` | Where the user dragged the desktop popup, and the size they resized it to (`null` = configured position or size) |
| `mapClickOwners` | Widgets currently using map clicks (`useMapClickLock`); popups stay off while the list isn't empty |

Runtime state belongs to the store; the project's JSON only decides the starting state.

## The merge convention

Settings resolve as **kit default ← global setting ← per-item override** everywhere: popups, widget headers, layer list actions, labels and so on. Almost every field is optional, and a missing key falls back instead of erroring. New settings must follow this: give them a default and merge them, never make them required.

The subsystem pages go further:

- [Layers & Loaders](layers.md): the loader dispatch and the shared sublayer model
- [Popups](popups.md): the single click and hover handler, and how popup settings resolve
- [Legend](legend.md): reading symbology into swatches
- [Theme & Storage](theme-storage.md): tokens and UI sizes to CSS variables, and per-app storage keys
- [Widget Registry](registry.md): discovery, build-time widget selection and `resolveWidget`
- [Draw & Measure](draw-measure.md): the controllers behind the two drawing widgets

## Widget settings in the editor

The editor reads the same `widgets/*/settings.ts` files through a Vite glob (`editor/settings/widgetSchemas.ts`): `PROJECT_SCHEMAS` checks the draft (`edits/validate.ts`) and describes each setting (`settings/schemaInfo.ts`), and `WIDGET_SECTIONS` holds each widget's block, built by `editor/settings/widgetSections.ts` from its schema (its `.meta()` `label`, `advanced`, `dependsOn` and `editor`). `widgetSections.ts` has no Vite-only code, so `scripts/widget-sections.test.ts` runs it under Node with the schemas from `scripts/widget-settings.ts`. `editor/settings/settingsMap.ts` keeps only what isn't a widget setting (Basemap's `basemaps.json` list).

