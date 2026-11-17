---
icon: lucide/search
---

# Search

A search box floating over the map. It can search for places (with a geocoder), for features in your layers, or both.

- id: `search`
- Surfaces: `floating`
- Notes: it has no title bar; the search bar is the whole pop-out, and clicking the icon again closes it. On phones it stays over the map beside its button and never opens in the bottom sheet, whatever the placement's `stayOnMobile` says. The bar always opens sideways, toward the middle of the map, even in a [horizontal corner](../guides/custom-widget.md#floating-placement); a placement can change that with `"opens": "vertically"`.

## Place it

In the editor, turn on **Search** under **Widgets** and pick its **Where**. By hand:

```json
"floatingWidgets": [
  {
    "slot": "top-left",
    "widgets": [{ "widgetName": "search", "order": -1 }]
  }
]
```

`"order": -1` puts it above the zoom control in the same corner.

## Picking a result

Clicking a result writes its label into the box and moves the map there. A layer result also opens that feature's popup with the map highlight, the same as clicking the feature on the map, as long as the layer has a popup and is visible. Set `openPopup` to `false` to only move the map. On phones the result list closes after a click and the keyboard goes away. Typing again brings the list back. On desktop the list stays open, so you can click through several results.

## Configuration: `widgets.search`

```json
"widgets": {
  "search": {
    "geocoder": { "provider": "nominatim", "limit": 3 },
    "layers": [
      { "layerId": "airports", "fields": ["name"], "labelField": "name", "limit": 3, "pointZoom": 12 },
      { "layerId": "power-plants", "fields": ["plant_name"], "labelField": "plant_name" }
    ],
    "placeholder": "Search places, airports, or power plants…",
    "pointZoom": 14,
    "sectionOrder": "features-first"
  }
}
```

### Top-level fields

| Field | Type | Default | Description |
|---|---|---|---|
| `geocoder` | `GeocoderConfig` | none | Place search (below). Leave it out to search layers only |
| `layers` | `SearchableLayerConfig[]` | none | Layers to search (below). Leave it out to search places only |
| `placeholder` | `string` | `"Search…"` | Text in the empty search box |
| `pointZoom` | `number` | `14` | Zoom when flying to a point result. Other results fit their bounds |
| `sectionOrder` | `"features-first" \| "places-first"` | `"features-first"` | Whether layer results or "Places" come first |
| `openPopup` | `boolean` | `true` | Open a layer result's popup when it's clicked |
| `loadingText` | `string` | `"Searching…"` | Change it for other languages |
| `noResultsText` | `string` | `"No results."` | Change it for other languages |

### Geocoder: `widgets.search.geocoder` { #geocoder-searchgeocoder }

| Field | Type | Default | Description |
|---|---|---|---|
| `provider` | `"nominatim" \| "maptiler"` | required | `nominatim` needs no key (OpenStreetMap; light use only, attribution required). `maptiler` needs an `apiKey` |
| `apiKey` | `string` | none | Required for `maptiler`. Anyone using your app can see it, so restrict it to your domain; see [API Keys & Security](../guides/api-keys.md) |
| `endpoint` | `string` | provider default | A different request URL, e.g. a self-hosted Nominatim |
| `limit` | `number` | `5` | Max place results |

### Searchable layers: `widgets.search.layers[]` { #searchable-layers-searchlayers }

Usually each entry searches one column: in the Conness editor, Search → Searchable layers → Add lists a layer's columns and makes one entry per column you check. Entries on the same layer show as one section of results, and a feature that matches on two columns is listed once.

Only GeoJSON layers can be searched, because the search needs all of a layer's features. PMTiles and other tiled layers are skipped, with a console warning. If a layer is [filtered](layer-list.md#filtering), only features that pass the filter show up. A layer whose file fails to load (moved, missing, offline) is left out with a console warning; the other layers and the place results still show.

| Field | Type | Default | Description |
|---|---|---|---|
| `layerId` | `string` | required | A layer id from `settings.layers` |
| `fields` | `string[]` | required | Properties to search; matches any part of the value, ignoring case |
| `labelField` | `string` | first of `fields` | Property shown as the result label |
| `limit` | `number` | `8` | Max results for this layer |
| `pointZoom` | `number` | `widgets.search.pointZoom` | Zoom for point results from this layer |
