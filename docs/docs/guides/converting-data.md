---
icon: lucide/arrow-right-left
---

# Converting Your Data

Most data needs a little work before it goes on a map: reprojecting, dropping columns, cleaning up shapes, and picking a format that loads fast. This page has the Python helpers for that, built on [GeoPandas](https://geopandas.org/), and the [tippecanoe](https://github.com/felt/tippecanoe) commands for turning large data into PMTiles. Save the results into your project's `layers/` folder, or upload them with **Add layer** in the editor.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install geopandas pyarrow
```

Read the file, put it in WGS 84 (EPSG:4326), and keep the columns you want:

```python
import geopandas as gpd

gdf = gpd.read_file("parks.shp").to_crs(4326)
gdf.columns = gdf.columns.str.lower()
gdf = gdf[["name", "acres", "geometry"]]
```

## Cleaning helpers

Copy the ones you need into your script. Each takes a GeoDataFrame and returns a new one.

### Fix invalid shapes

Repairs self-crossing polygons and similar problems with `make_valid`, then drops anything left empty.

```python
def make_gdf_valid(gdf):
    fixed = gdf.copy()
    fixed["geometry"] = fixed.geometry.make_valid()
    return fixed[fixed.geometry.notna() & ~fixed.geometry.is_empty]
```

### Simplify

Removes vertices closer together than `tolerance_meters`. It works in the data's local UTM zone, so a meter is a real meter at any latitude (Web Mercator doubles distances by 60°).

```python
def simplify_geometries(gdf, tolerance_meters=5):
    if gdf.empty:
        return gdf.copy()
    projected = gdf.to_crs(gdf.estimate_utm_crs())
    projected["geometry"] = projected.geometry.simplify(tolerance_meters)
    return projected.to_crs(gdf.crs)
```

### Remove small holes

Fills holes in polygons smaller than `min_hole_area_sqm`. Areas are measured in an equal-area projection (EPSG:6933), so they're true square meters anywhere.

```python
from shapely.geometry import MultiPolygon, Polygon

def _without_small_holes(geom, min_area):
    def clean(poly):
        holes = [h for h in poly.interiors if Polygon(h).area >= min_area]
        return Polygon(poly.exterior, holes)
    if geom is None:
        return geom
    if geom.geom_type == "Polygon":
        return clean(geom)
    if geom.geom_type == "MultiPolygon":
        return MultiPolygon([clean(p) for p in geom.geoms])
    return geom

def remove_small_holes(gdf, min_hole_area_sqm=2000):
    if gdf.empty:
        return gdf.copy()
    projected = gdf.to_crs("EPSG:6933")
    projected["geometry"] = projected.geometry.apply(_without_small_holes, min_area=min_hole_area_sqm)
    return projected.to_crs(gdf.crs)
```

### Drop duplicate shapes

Keeps one row for each identical geometry.

```python
def drop_duplicate_geometries(gdf):
    return gdf[~gdf.geometry.to_wkb().duplicated()]
```

## Export

`export_layer` writes GeoJSON, PMTiles or GeoParquet into a folder you name. The folder must already exist.

```python
import os

def export_layer(gdf, output_loc, out_layer_name, out_file_type="geojson", min_zoom=0, max_zoom=5):
    extensions = {"geojson": "geojson", "pmtiles": "pmtiles", "geoparquet": "parquet"}
    if out_file_type not in extensions:
        raise ValueError(f"out_file_type must be geojson, pmtiles or geoparquet, got {out_file_type!r}")
    if not os.path.isdir(output_loc):
        raise ValueError(f"output_loc is not a folder: {output_loc!r}")
    path = os.path.join(output_loc, f"{out_layer_name}.{extensions[out_file_type]}")

    if out_file_type == "geojson":
        gdf.to_file(path, driver="GeoJSON")
    elif out_file_type == "pmtiles":
        gdf.to_crs(4326).to_file(path, driver="PMTiles", layer=out_layer_name,
                                 dataset_options={"MINZOOM": min_zoom, "MAXZOOM": max_zoom})
    else:
        # sorted by place, with each row's bbox, so readers can skip what they don't need
        gdf.iloc[gdf.hilbert_distance().argsort()].to_parquet(path, write_covering_bbox=True)
    print(f"Exported {path}")
```

```python
export_layer(gdf, "../app/projects/my-map/layers", "parks", "pmtiles", max_zoom=12)
```

| Argument | What it does |
|---|---|
| `output_loc` | The folder to write into, usually your project's `layers/`. Required |
| `out_layer_name` | The file name without its extension. For PMTiles it's also the source layer's name inside the archive |
| `out_file_type` | `"geojson"`, `"pmtiles"` or `"geoparquet"` |
| `min_zoom`, `max_zoom` | PMTiles only: the zoom range tiles are built for. GDAL's own default stops at 5, which is fine for world-scale points but blurry for city data. Past `max_zoom` the map stretches the last level |

GeoParquet needs GeoPandas 1.0 or later. FlatGeobuf is one line: `gdf.to_file("parks.fgb")`.

## tippecanoe → PMTiles

Use tippecanoe when a GeoJSON file is too big to load whole, or when you want more control over the tiles than GDAL gives. Tippecanoe only works on a macbook. PMTiles only loads the tiles in view.

```bash
brew install tippecanoe gdal   # other OSes: see the tippecanoe README
```

GeoJSON to PMTiles:

```bash
tippecanoe -o ../app/projects/<project>/layers/parks.pmtiles -l parks -Z 4 -z 12 parks.geojson
```

| Flag | Meaning |
|---|---|
| `-o` | Output file (a `.pmtiles` name writes PMTiles) |
| `-l` | Layer name inside the archive. The editor reads it as the source layer's name |
| `-Z` / `-z` | Lowest and highest zoom to build tiles for. Past `-z`, the map stretches the last level |

For large or dense data, let tippecanoe pick the highest zoom and thin out crowded tiles:

```bash
tippecanoe -o ../app/projects/<project>/layers/buildings.pmtiles -l buildings -zg --drop-densest-as-needed buildings.geojson
```

tippecanoe can't read GeoParquet, so convert it to FlatGeobuf first:

```bash
ogr2ogr roads.fgb roads.parquet
tippecanoe -o ../app/projects/<project>/layers/roads.pmtiles -l roads -Z 6 -z 14 roads.fgb
```

Then add it with **Add layer** in the editor, which picks the `pmtiles` kind from the extension and writes in the archive's source layers for you. By hand, it's a [`pmtiles` layer](../configuration/adding-layers.md#pmtiles) with `sourceLayers: [{ sourceLayer: '<the -l name>' }]`.
