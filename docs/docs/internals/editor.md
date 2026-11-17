---
icon: lucide/pencil-ruler
---

# The Editor

The editor is a separate Vite app in `app/editor/`, started by `npm start` with its own config, `vite.editor.config.ts`. It only runs in development and is never built. It never imports a project's files itself. A small API on its dev server reads and writes them, and the app's own dev servers, run by the editor, draw the project in The Preview Pane.

```
app/editor/              the editor's React app (EditorShell, Home, SettingsPanel, panel/)
app/scripts/
├── projects-api-plugin.ts   /api/projects and /api/widgets, on the editor's dev server
├── app-servers.ts           the app's own Vite servers: preview and saved
└── project-config-plugin.ts loadProject and setDraft (the draft served in place of the files)
app/src/core/
├── previewCamera.ts     the pane's side: questions, live changes, kept camera and state
└── liveSettings.ts      applyLiveSettings: a live change applied to the running app
```

## The projects API

`projects-api-plugin.ts` adds two endpoints to the editor's server. `/api/widgets` lists every widget's `about` (from `scripts/widget-settings.ts`). `/api/projects` does everything to projects:

| Request | What it does |
|---|---|
| `GET /` · `POST /` | List the projects; create one from the starter (`{ name }`) |
| `GET /<id>` · `DELETE /<id>` | One project's summary; move it to `app/projects/_trash/` |
| `POST /<id>/duplicate` · `/title` · `/rename` | Copy it, change its title, rename its folder |
| `GET /<id>/files` | Upgrades the project first, then returns the five JSON files as text, a `version` (a hash of them) and `upgraded` (`{ from, to, changes }`, or null) |
| `POST /<id>/save` | Write the changed files. A different `version` on disk means a hand edit since the editor read them, so it refuses unless `force`. `trash` moves removed layers' data files to `_trash/` |
| `POST /<id>/preview` · `/saved` | Start the preview or saved app server (below) and return its URL |
| `GET /<id>/folder/<folder>` | The files in `public/`, `layers/` or `basemap-images/`, with the extensions an upload may have |
| `POST /<id>/folder/<folder>?name=…` | Upload a file there; the body is the file itself |
| `POST /import?name=…` | Import a project zip. Refuses a build (an `index.html` and no `settings.json`) and a project from a newer release before writing anything, upgrades after writing, and returns `upgraded` |
| `POST /<id>/build` | Run `run.mjs build <id>` and stream its output, ending with a result line |

Only folders `listProjects` knows are projects, so `../` and the editor's own `_` folders can't be reached through an id.

Both endpoints refuse, with a 403, any request another site's page sent (`fromOtherSite`). That's an `Origin` header that isn't the editor's own host, or a `Sec-Fetch-Site` of `cross-site` or `same-site`. A plain-text POST needs no CORS preflight, so without the check any open web page could save, rename or import into `localhost:5173`.

## Upgrades { #upgrades }

`scripts/upgrades.ts` brings a project made with an older release up to this one.

- `UPGRADES` lists `{ to, changes, run(files) }`, one entry per release that changes the config shape, oldest first. `run` changes the five parsed JSON files in place, so an upgrade can move a setting from one file to another. `changes` says what it rewrote, in words a user reads.
- An entry is due when its `to` is newer than the project's `connessVersion` (a missing stamp counts as `0.0.0`) and no newer than this install. A release with no entries leaves projects alone, stamp included.
- `upgradeProject(dir)` is the one path, shared by opening, importing and `npm run upgrade`. It reads `settings.json` first and the other files only when something is due, writes only the files that changed, and stamps the current release.
- A project stamped newer than this install is refused everywhere (`checkNotNewer`).
- Adding an entry also means rewriting the demo and `app/templates/basic/` by hand in the same change. The template has no stamp and is never upgraded.

## The app servers

`app-servers.ts` runs the app's own Vite server, `vite.config.ts` with `CONNESS_PROJECT` set, in two slots. `preview` serves the editor's unsaved edits to The Preview Pane, and `saved` serves only the files on disk for **View Saved App**. Each slot holds one project, and starting another project closes the old server. Starts are queued, since `vite.config.ts` reads the environment variable while the server is created.

`setDraft(server, files, live)` hands the draft to that server's `project-config-plugin.ts`. While a draft is set, `loadProject` reads it in place of the files on disk (`overrides`), so the pane runs exactly what the sidebar shows, checked against the same schemas. Save writes the files and clears the draft, and the file watcher reloads the pane.

## The sidebar

`editor/settings/settingsMap.ts` places every setting in a group, section and pop-out. `scripts/settings-map.test.ts` fails when a schema setting has no place or two. Each row's control, description and default come from the Zod schemas (`schemaInfo.ts`, through `schemaNodes.ts`, which follows unions to the variant an item actually uses). Six shared schemas (`popup`, `label`, `symbology`, `legend`, `filters` and `layerListActions`) have an `id` in their `.meta()`, so the generated JSON Schemas write each one once under `definitions` and point to it with `$ref`, which took `layers.schema.json` from 321 KB to 86 KB. `inlineRefs` in `schemaNodes.ts` puts them back in place before the settings panel and the widget blocks (`widgetSections.ts`) read the schema, including the one-item `allOf` that draft-7 wraps around a `$ref` with its own description. A widget's block is built from its `settings.ts` schema; see [Widget settings in the editor](architecture.md#widget-settings-in-the-editor). The draft is checked as it changes (`validate.ts`), and a problem blocks Save, Build and the preview.

## Live changes

Every edit is compared with what the pane shows (`changedPaths` in `editor/preview/liveAreas.ts`, tested). `livePath` says whether each changed path can apply without a reload. When every change can, the editor sends them 250 ms after the last edit:

1. The editor posts the draft to `POST /<id>/preview` with `live: true`.
2. The preview server loads the draft and sends the checked `settings` and `symbologies` to the open page as the Vite event `conness:live`. A draft that doesn't load sends a full reload.
3. In the pane, `applyLiveSettings` (`core/preview/liveSettings.ts`) refills `settings` and `symbologies` in place, re-applies the theme, UI variables, title and layout, applies layer changes (`core/layers/liveLayers.ts`: each layer added, removed, restyled or moved), and bumps `settingsVersion` in the store, so memos over settings run again.
4. The pane posts `conness:applied`, and the editor marks it up to date.

A change that can't apply live waits for **Refresh Settings**, which posts the draft without `live` and reloads the pane. When both kinds are pending, `liveChanges` sends the live part on its own. If applying a live change throws, the pane reloads.

## The pane's side

`connectPreview` in `core/preview/previewCamera.ts` runs only in the editor's pane (dev, with `?conness-preview=<id>` in the URL). It posts `conness:ready` when it's listening, and handles:

- **`conness:map-zoom`**: the editor's Map Zoom pill. The wheel zooms only while it's on and the project's `scrollZoom` is on too.
- **`conness:ask`**: a question, answered with `conness:answer` and its id (`askPreview` / `usePreviewAnswer` in `editor/edits/editorContext.ts`). The questions are `view` (Use current view), `columns` and `layer-columns` (column pickers), `source-layers` (a vector tile layer's source layers, asked with its `layerType` and `url` so it answers for a layer added since the last Refresh) and `popup-templates` (the templates `popups.tsx` exports). Their code loads only when asked, so a built app doesn't carry it. A question's details are spread into the message, so none can be called `type` or `id`: they'd overwrite the message's own.

Before a reload, the pane saves its camera and its state in `sessionStorage` under the pane's id, the editor page's id plus the project's (`keepPreviewState` / `restorePreviewState`): layers' visibility, transparency and labels, filters, the basemap, globe, terrain and the open widgets, in the bookmark format from `core/map/mapState.ts`. A Refresh Settings reload restores them. The state is only saved from two frames after the map's `load` (the projection lags one frame). A reload before that, like Vite's reload after it optimizes dependencies on a cold start, would otherwise save a half-booted state, such as a flat map for a globe project, and the next boot would replay it. Reloading the editor gives it a new id and starts at the configured camera, and so does opening another project, so one project's view never carries into the next.
