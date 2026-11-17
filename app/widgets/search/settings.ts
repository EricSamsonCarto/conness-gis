import { z } from 'zod'
import { geocoderConfigSchema, searchableLayerSchema } from '../../src/core/schema/widgets.ts'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'search',
  label: 'Search',
  description: 'Place search (geocoder) + in-layer feature search. Configure in widgets.search.',
  surfaces: ['floating'],
  defaults: {
    panelWidth: 300,
    hasUI: true,
    // no header, the bar is the pop-out. re-click the icon to close
    chromeless: true,
    // a search bar reads left to right, even in a horizontal corner
    opens: 'sideways',
    // a bar beside its button, never the bottom sheet
    alwaysOnMap: true,
  },
}

export const searchSectionOrderSchema = z
  .enum(['features-first', 'places-first'])
  .meta({ description: 'Whether layer results or "Places" come first.' })

// the geocoder and searchable layers are the engine's, labeled there
export const settings = z
  .strictObject({
    placeholder: z.string().optional().meta({ description: 'Search box placeholder.', default: 'Search…' }),
    geocoder: geocoderConfigSchema.optional(),
    layers: searchableLayerSchema
      .array()
      .optional()
      .meta({ description: 'Layers to search.', label: 'Searchable layers', editor: 'search-layers' }),
    openPopup: z.boolean().optional().meta({
      description: "Open a layer result's popup when it's clicked.",
      default: true,
    }),
    pointZoom: z.number().optional().meta({
      description: 'Zoom for point results. Other results fit their bounds.',
      default: 14,
      advanced: true,
    }),
    sectionOrder: searchSectionOrderSchema.optional().meta({ default: 'features-first', advanced: true }),
    loadingText: z.string().optional().meta({ default: 'Searching…', advanced: true }),
    noResultsText: z.string().optional().meta({ default: 'No results.', advanced: true }),
  })
  .meta({
    description: 'Search widget. Omit `geocoder` for layer search only, or `layers` for place search only.',
    see: 'https://conness-gis.com/widgets/search/',
  })

export type SearchSettings = z.input<typeof settings>
