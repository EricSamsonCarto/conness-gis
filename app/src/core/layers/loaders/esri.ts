import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import type { FeatureService } from 'esri-gl'
import type {
  EsriLayer,
  EsriFeatureLayer,
  EsriDynamicLayer,
  EsriTiledLayer,
  LayerFilterHandler,
} from '../../types'
import { addSublayers } from './sublayers'
import { addLabelLayer } from '../labels'
import { withLayerOpacity } from '../opacity'
import type { RegisteredLayer } from './geojson'
import { andWhere, toWhere } from '../../filters/compile'
import { cachedValues, sortDistinct } from '../../filters/values'
import { useStore } from '../../store'
import { startOpacity } from '../recordLayer'
import { scaleToZoom } from '../scaleZoom'

// esri-gl types its own MapLibre Map, the same object at runtime
// lazy, so apps without esri never download it
type EsriMap = ConstructorParameters<typeof FeatureService>[1]
const asEsriMap = (m: MapLibreMap): EsriMap => m as unknown as EsriMap

// Web Mercator extents are converted, other projected CRSs are left
// for isValidLngLatBounds to reject
function boundsFromEsriExtent(value: unknown): LngLatBoundsLike | undefined {
  if (!value || typeof value !== 'object') return undefined
  const e = value as Record<string, unknown>
  if (
    typeof e.xmin === 'number' &&
    typeof e.ymin === 'number' &&
    typeof e.xmax === 'number' &&
    typeof e.ymax === 'number'
  ) {
    const sr = e.spatialReference as { wkid?: number; latestWkid?: number } | undefined
    if (!WEB_MERCATOR_WKIDS.has(sr?.latestWkid ?? sr?.wkid ?? 0)) {
      return [e.xmin, e.ymin, e.xmax, e.ymax]
    }
    const [west, south] = mercatorToLngLat(e.xmin, e.ymin)
    const [east, north] = mercatorToLngLat(e.xmax, e.ymax)
    return [west, south, east, north]
  }
  return undefined
}

const WEB_MERCATOR_WKIDS = new Set([3857, 102100, 102113, 900913, 3785])
const EARTH_RADIUS_M = 6378137

// clamped, world extents land a hair past ±180
function mercatorToLngLat(x: number, y: number): [number, number] {
  const lng = Math.max(-180, Math.min(180, (x / EARTH_RADIUS_M) * (180 / Math.PI)))
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) * (180 / Math.PI)
  return [lng, lat]
}

function addEsriFeatureLayer(
  map: MapLibreMap,
  layer: EsriFeatureLayer,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`

  const sublayerIds: string[] = []
  // set on teardown, a late result can land after the next registration
  let stale = false

  // the service's scale range unless the layer sets zooms, as ArcGIS does
  // a big layer's minScale stops tile-by-tile queries zoomed out
  let minZoom = layer.minZoom
  let maxZoom = layer.maxZoom
  const range = fetch(`${layer.url}?f=json`)
    .then((res) => res.json() as Promise<{ minScale?: unknown; maxScale?: unknown }>)
    .then(
      (info) => {
        minZoom ??= scaleToZoom(info.minScale)
        maxZoom ??= scaleToZoom(info.maxScale)
      },
      () => undefined,
    )

  let service: FeatureService | undefined
  const created = Promise.all([import('esri-gl'), range]).then(([{ FeatureService }]) => {
    if (stale) return undefined
    service = new FeatureService(sourceId, asEsriMap(map), {
      url: layer.url,
      ...(layer.where ? { where: layer.where } : {}),
      ...(minZoom !== undefined ? { minZoom } : {}),
    })
    return service
  }, esriLoadFailed(layer.id))

  void created.then(async (service) => {
    if (!service) return
    await service.sourceReady
    if (stale || !map.getSource(sourceId)) return
    // read now, the user may have toggled it meanwhile
    const visible = useStore.getState().layerMetadata[layer.id]?.visible ?? layer.visible ?? true
    const visibility: 'visible' | 'none' = visible ? 'visible' : 'none'
    const opacity = startOpacity(layer)
    if (layer.symbology) {
      sublayerIds.push(
        ...addSublayers(map, {
          layerId: layer.id,
          sourceId,
          symbology: layer.symbology,
          geometryType: layer.geometryType,
          visibility,
          opacity,
          minZoom,
          maxZoom,
          label: layer.label,
        }),
      )
    } else {
      // no symbology means the service's ArcGIS renderer
      const style = await service.getStyle()
      if (stale) return
      const id = `${layer.id}-${suffixForEsriType(style.type)}`
      const type = style.type as 'circle' | 'line' | 'fill'
      map.addLayer({
        id,
        type,
        source: sourceId,
        paint: withLayerOpacity(id, type, (style.paint ?? {}) as Record<string, unknown>, opacity),
        layout: { ...(style.layout ?? {}), visibility },
        ...(minZoom !== undefined ? { minzoom: minZoom } : {}),
        ...(maxZoom !== undefined ? { maxzoom: maxZoom } : {}),
      } as Parameters<MapLibreMap['addLayer']>[0])
      sublayerIds.push(id)
      if (layer.label) {
        const labelId = addLabelLayer(map, {
          layerId: layer.id,
          sourceId,
          label: layer.label,
          visibility,
          opacity,
          minZoom,
          maxZoom,
        })
        if (labelId) sublayerIds.push(labelId)
      }
    }
  })

  const currentWhere = (): string =>
    andWhere(layer.where, toWhere(useStore.getState().layerFilters[layer.id])) ?? '1=1'

  // the server reprojects (outSR), serviceMetadata.extent is often native
  // same where as the tiles, so it fits the filtered features
  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      const params = new URLSearchParams({
        where: currentWhere(),
        outSR: '4326',
        returnExtentOnly: 'true',
        f: 'json',
      })
      const res = await fetch(`${layer.url}/query?${params}`)
      const json = (await res.json()) as Record<string, unknown>
      return boundsFromEsriExtent(json.extent)
    } catch {
      return undefined
    }
  }

  // server-side through esri-gl's where, so default-styled layers filter
  // values query the layer's own `where`, not the user filter
  const filter: LayerFilterHandler | undefined = layer.filters?.length
    ? {
        apply: (state) => {
          const where = andWhere(layer.where, toWhere(state))
          void created.then(async (service) => {
            if (!service) return
            await service.sourceReady
            if (where) service.setWhere(where)
            else service.clearWhere()
          })
        },
        getValues: (column) =>
          cachedValues(layer.id, column, async () => {
            const params = new URLSearchParams({
              where: layer.where ?? '1=1',
              outFields: column,
              returnDistinctValues: 'true',
              returnGeometry: 'false',
              orderByFields: column,
              f: 'json',
            })
            const res = await fetch(`${layer.url}/query?${params}`)
            const json = (await res.json()) as {
              features?: { attributes?: Record<string, unknown> }[]
              error?: { message?: string }
            }
            if (json.error) {
              throw new Error(json.error.message ?? 'ArcGIS query failed')
            }
            return sortDistinct((json.features ?? []).map((f) => f.attributes?.[column]))
          }),
      }
    : undefined

  return {
    id: layer.id,
    sourceId,
    sublayerIds,
    teardown: () => {
      stale = true
      removeLayers(map, sublayerIds)
      service?.remove()
    },
    getBounds,
    filter,
  }
}

function esriLoadFailed(layerId: string) {
  return (err: unknown): undefined => {
    console.warn(
      `[conness-gis] Layer "${layerId}": couldn't load esri-gl: ${err instanceof Error ? err.message : String(err)}`,
    )
    return undefined
  }
}

// must run before service.remove(): MapLibre won't drop a source in use
function removeLayers(map: MapLibreMap, ids: string[]): void {
  for (const id of ids) if (map.getLayer(id)) map.removeLayer(id)
}

function suffixForEsriType(t: string): 'fill' | 'line' | 'point' {
  if (t === 'fill') return 'fill'
  if (t === 'line') return 'line'
  return 'point'
}

function addEsriRasterLayer(
  map: MapLibreMap,
  layer: EsriDynamicLayer | EsriTiledLayer,
): RegisteredLayer {
  const sourceId = `src-${layer.id}`
  const rasterId = `${layer.id}-raster`
  // holds the stack slot (rasters register first) until esri-gl loads
  const slotId = `${layer.id}-slot`
  map.addLayer({ id: slotId, type: 'background', layout: { visibility: 'none' } })

  const zoomRange: { minzoom?: number; maxzoom?: number } = {}
  if (layer.minZoom !== undefined) zoomRange.minzoom = layer.minZoom
  if (layer.maxZoom !== undefined) zoomRange.maxzoom = layer.maxZoom

  let stale = false
  let service: { remove: () => void; getMetadata: () => Promise<unknown> } | undefined
  const created = import('esri-gl').then(({ DynamicMapService, TiledMapService }) => {
    if (stale) return undefined
    service =
      layer.service === 'dynamic'
        ? new DynamicMapService(sourceId, asEsriMap(map), {
            url: layer.url,
            ...(layer.layers ? { layers: layer.layers } : {}),
          })
        : new TiledMapService(sourceId, asEsriMap(map), { url: layer.url })
    // read now, the user may have toggled it meanwhile
    const visible = useStore.getState().layerMetadata[layer.id]?.visible ?? layer.visible ?? true
    map.addLayer(
      {
        id: rasterId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': startOpacity(layer) },
        layout: { visibility: visible ? 'visible' : 'none' },
        ...zoomRange,
      },
      slotId,
    )
    return service
  }, esriLoadFailed(layer.id))

  // map-service JSON uses `fullExtent`, sometimes `extent`
  const getBounds = async (): Promise<LngLatBoundsLike | undefined> => {
    try {
      const service = await created
      if (!service) return undefined
      const metadata = (await service.getMetadata()) as Record<string, unknown>
      return boundsFromEsriExtent(metadata.fullExtent ?? metadata.extent)
    } catch {
      return undefined
    }
  }

  return {
    id: layer.id,
    sourceId,
    sublayerIds: [rasterId],
    teardown: () => {
      stale = true
      removeLayers(map, [rasterId, slotId])
      service?.remove()
    },
    getBounds,
  }
}

export function addEsriLayer(map: MapLibreMap, layer: EsriLayer): RegisteredLayer {
  switch (layer.service) {
    case 'feature':
      return addEsriFeatureLayer(map, layer)
    case 'dynamic':
    case 'tiled':
      return addEsriRasterLayer(map, layer)
    default: {
      const exhaustive: never = layer
      throw new Error(`Unknown esri service: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function isEsriRaster(layer: EsriLayer): boolean {
  return layer.service === 'dynamic' || layer.service === 'tiled'
}
