---
icon: lucide/book-open
---

# Introduction

Conness GIS is an open-source framework for building GIS web apps on [MapLibre GL JS](https://maplibre.org/). It's an app built with GIS people in mind, but anyone can use it. 

I got the idea while working with a couple proprietary GIS app builders. I had the thought: what if I had reusable widgets, themes, and layout designs already built for MapLibre? I could ship open source GIS solutions quickly, re-using the same shapes and tools. This would be easy enough to do by creating an organized codebase skeleton that I could re-use, but I knew I could make something a little bigger that anyone could reach for.

I built this project for myself as a challenge. But more so that I could use it as a utility. I have a lot of ideas for GIS applications that I can now create demos for fairly quickly. If you have ever used some of the commercial "settings-to-GIS-app" products out there, you understand what I was aiming for. No need to name names.

Conness GIS allows you to build an app right in its editor, which runs on your own computer. When you change a project's settings, the app updates live in the editor window, so you can see how the changes you make affect your app. Users can alter an apps layout, change its colors/theme, add their own data, and much more. Everything the editor writes is a set of plain files, so you can also edit them by hand (if you are into that sort of thing). All apps are mobile first, mobile ready, whatever you want to call it. I included guides detailing my full setup and how to deploy and host your created apps. Check it out in the guides section.

## What's possible in a new project

Creating a new project from the editor UI creates an already completed mapping app:

- You can add your own data. Layers from GeoJSON, [PMTiles](https://protomaps.com/) (vector or raster), tile servers (TileJSON or `{z}/{x}/{y}`), [FlatGeobuf](https://flatgeobuf.org/), [GeoParquet](https://geoparquet.org/) and ArcGIS REST services, each configured as a plain object, all run natively. GeoParquet runs on [DuckDB](../configuration/adding-layers.md#duckdb) in the browser, so files in a projected coordinate system are reprojected automatically, and large files can be drawn as tiles cut on the fly.
- A layer list, legend, basemap switcher, search, measure, draw, bookmarks and live coordinates widget comes with each app that you can turn on and place. We hope to expand the options for these soon.
- Feature popups, turned on per layer and drawn by templates you control (with built in ones ready to use, or you can make your own within the popups.tsx file shipped with every app.)
- A phone display button, where the user can play around with how the app will appear on phone devices. Widgets can end up in the top bar or in a bottom bar.
- Pre-built color themes, but every color can be altered from the settings. Change the `primary` token and most of the app follows.
- A top bar, collapsible side panels, floating controls, a right-click menu and a loading overlay around the map.
- A lot of other fun little QOL stuff

## Organization

- The **editor** (`npm start`) edits your projects and builds them. The video on the home page/landing page shows that off.
- The **shell** (`app/src/`) is the framework code that draws an app. You rarely touch it, unless you want to change how something fundamentally looks or functions within Conness. I don't and won't take offense, I promise.
- The **user files** are what you edit to update the app's project. There is one folder per app in `app/projects/` (`settings.json`, `layers.json`, `basemaps.json`, `theme.json`, `symbology.json`, `popups.tsx`, `info.md`), with its data files in `layers/`, plus the shared `app/widgets/` folder. The editor writes these files, and so can you. But if you go back and forth, remember to refresh the editor UI.

Widgets are the buttons that open panels that allow your users to do GIS stuff (search, locate me, filter data, draw shapes, analysis, yada yada). Use the built-in ones, extend them, delete them, or write your own!

In every version there is a widgets.md file that you can feed into the AI of your choice, or read yourself if you plan to code like it's 2022. That file explains all of the shared components they/you can use to quickly create a custom widget, so everything should stay looking consistent. Or don't use it at all, it's up to you. See [Building a Custom Widget](../guides/custom-widget.md).

Your app lives entirely in the user files, and the shell reads them and renders. That split is what lets a new release of Conness GIS replace the shell without touching your projects. See [Concepts](concepts.md). If you mess with the shell yourself on one version, a new version will overwrite your changes, so be careful when upgrading, or just never upgrade again once you get a release and fix bugs yourself.

## Built with

**Core**

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)
- [React](https://github.com/facebook/react)
- [Zustand](https://github.com/pmndrs/zustand)
- [Vite](https://github.com/vitejs/vite)
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)
- [Zod](https://github.com/colinhacks/zod)

**Geospatial**

- [PMTiles](https://github.com/protomaps/PMTiles)
- [flatgeobuf](https://github.com/flatgeobuf/flatgeobuf)
- [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm)
- [esri-gl](https://github.com/muimsd/esri-gl)
- [@mapbox/mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw)
- [Turf.js](https://github.com/Turfjs/turf)
- [maplibre-contour](https://github.com/onthegomap/maplibre-contour)
- [hyparquet-writer](https://github.com/hyparam/hyparquet-writer)
- [OpenFreeMap](https://github.com/hyperknot/openfreemap)
- [VersaTiles](https://github.com/versatiles-org/versatiles)
- [Mapterhorn](https://github.com/mapterhorn/mapterhorn)

**UI & content**

- [react-markdown](https://github.com/remarkjs/react-markdown)
- [re-resizable](https://github.com/bokuweb/re-resizable)

**Docs**

- [Zensical](https://github.com/zensical/zensical)

## License

Conness GIS is licensed under the [Apache License 2.0](https://github.com/ericsamsoncarto/conness-gis/blob/main/LICENSE.md): you can use, modify and distribute it freely, commercially too, as long as you keep its copyright and license notices. The license also includes an explicit patent grant.

Enough talk, let's go to the [Quick Start](quick-start.md).
