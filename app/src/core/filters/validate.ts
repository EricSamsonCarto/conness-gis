import type { Settings } from '../types'
import { configError } from '../configError'

// types reject this already, but `npm run dev` doesn't typecheck
export function validateLayerFilters(settings: Settings): void {
  for (const layer of settings.layers) {
    const filters = (layer as { filters?: { column: string }[] }).filters
    if (!filters) continue
    const where = `settings.layers["${layer.id}"].filters`

    const supported =
      layer.type === 'geojson' ||
      layer.type === 'geoparquet' ||
      (layer.type === 'esri' && layer.service === 'feature')
    if (!supported) {
      const kind = layer.type === 'esri' ? `esri '${layer.service}'` : `'${layer.type}'`
      throw configError({
        where,
        why: `filters aren't supported on ${kind} layers`,
        fix: `remove \`filters\` from this layer. Filtering works on 'geojson', 'geoparquet', and esri 'feature' layers only.`,
      })
    }

    const seen = new Set<string>()
    for (const f of filters) {
      if (seen.has(f.column)) {
        throw configError({
          where,
          why: `column "${f.column}" is declared more than once`,
          fix: 'declare each column once.',
        })
      }
      seen.add(f.column)
    }
  }
}
