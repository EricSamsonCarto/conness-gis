---
icon: lucide/scale
---

# Commercial Use

!!! note "The kit itself is free for commercial use"
    Conness GIS is licensed under Apache 2.0, so you can build and sell commercial apps with it. `commercialUse` is only about the third-party services an app uses, like basemaps and geocoders, which have their own terms.

The `commercialUse` flag in your project's `settings.json` marks the app as commercial. When it's `true`, defaults that don't allow commercial use are left out of the build, and the app refuses to start if a restricted setting is still in place. It defaults to `false`.

!!! tip "In the editor"
    It's **Commercial use**, under **Branding**.

```json
"commercialUse": true
```

Restricted basemaps are dropped when the project's files are read, before the app is built, so they're removed from the production bundle, not just hidden at runtime. In `npm run dev` the page reloads when you save, like any other setting.

## What gets restricted

| Field | Effect when `commercialUse` is `true` |
|---|---|
| `"license": "restricted"` on a basemap | The basemap is removed from `settings.basemaps` and from the build. Only Satellite (ESRI) is marked this way; see the [default catalog](map-camera.md#default-catalog) |
| `widgets.search.geocoder.provider` set to `"nominatim"` | The app stops at boot with an error, because Nominatim's usage policy doesn't allow commercial use. Switch to `"maptiler"` with an `apiKey`, or remove `search.geocoder` |

A basemap in `basemaps.json` without `license` counts as commercial-safe, so a basemap you add is only removed if you mark it `"restricted"`.
