---
icon: lucide/package
---

# Requirements

- **Node 24 or newer, Node 26 recommended.** `app/package.json` declares `engines.node: ">=24"`, so npm warns on an older Node. The kit is built and tested on Node 26, and the release's `.nvmrc` says `26`, so `nvm use` picks it. The real floor comes from Vite 8 and from `npm run upgrade`, which runs a TypeScript file directly with Node's built-in type stripping.
- **Install with `npm ci`.** It installs the exact versions in `package-lock.json`, the tested set. Run from within the app folder. Use `npm install` only after you decide to change `package.json` yourself.

## Dependencies

**Runtime** (shipped in the built app, some only loaded when a project uses them):

| Package | Used for |
|---|---|
| `maplibre-gl` | The map |
| `react`, `react-dom` | The interface |
| `zustand` | App state (the store) |
| `pmtiles` | PMTiles layers |
| `flatgeobuf` | FlatGeobuf layers |
| `@duckdb/duckdb-wasm` | GeoParquet, `duckdb` and `mvt` layers. Loaded only when a project has one |
| `esri-gl` | Esri map and feature services. Loaded only when a project has one |
| `@mapbox/mapbox-gl-draw` | The Draw and Measure widgets |
| `@turf/turf` | Measurements and layer bounds |
| `hyparquet-writer` | GeoParquet export |
| `react-markdown` | The info modal |
| `re-resizable` | Resizable popups |

**Development only:** `vite` and `@vitejs/plugin-react` (dev server and build), `tailwindcss`, `@tailwindcss/vite` and `@tailwindcss/typography` (styles; typography styles the info modal), `typescript`, `zod` (the settings schemas, the files' checks and the editor), `fflate` (the editor's zips), `react-colorful` (the editor's color picker), `eslint` with `typescript-eslint` and the React hooks and refresh plugins, and the `@types/*` packages.
