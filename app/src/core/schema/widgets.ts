import { z } from 'zod'
import { widgetHeaderSchema } from './ui.ts'

export const floatingOpensSchema = z.enum(['sideways', 'vertically']).meta({
  description:
    'Where a floating pop-out opens: toward the middle of the map, or below (top corners) / above (bottom corners) the button.',
})

export const widgetPlacementSchema = z
  .strictObject({
    widgetName: z.string().meta({ description: "The widget's `id` (its folder name in `app/widgets/`)." }),
    panelWidth: z.number().optional().meta({
      description: 'Panel width in px (top bar, floating). The side rail uses `ui.layout.sideRailPanelWidth`.',
    }),
    header: widgetHeaderSchema.optional().meta({ description: 'Title bar for this placement.', defaultText: 'ui.widgetHeader' }),
    order: z.number().optional().meta({
      description: 'Floating only: order in its corner. Negative lifts it above the native controls.',
      default: 0,
    }),
    stayOnMobile: z.boolean().optional().meta({
      description:
        "Floating only: on phones, keep the widget's button over the map and open it there, instead of in the bottom sheet.",
    }),
    opens: floatingOpensSchema.optional().meta({
      description:
        'Floating only: which way the pop-out opens from its button: toward the middle of the map, or straight down (top corners) / up (bottom corners).',
      defaultText: 'manifest default, else "sideways" in a vertical corner and "vertically" in a horizontal one',
    }),
  })
  .meta({
    description: 'Places a widget. Overrides its manifest defaults.',
    see: 'https://conness-gis.com/guides/custom-widget/#placement-options',
  })

export const floatingSlotSchema = z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])

export const floatingSlotConfigSchema = z
  .strictObject({
    slot: floatingSlotSchema,
    widgets: widgetPlacementSchema.array(),
    direction: z.enum(['vertical', 'horizontal']).optional().meta({
      description:
        '`"horizontal"` lays the widgets out in one row. Pop-outs then open below (top corners) or above (bottom corners).',
      default: 'vertical',
    }),
  })
  .meta({ description: 'Widgets floating in one map corner.', see: 'https://conness-gis.com/guides/custom-widget/#floating-placement' })

export const geocoderProviderSchema = z.enum(['nominatim', 'maptiler']).meta({
  description:
    '`"nominatim"`: free OpenStreetMap geocoder, light use only, not for commercial apps. `"maptiler"`: needs an `apiKey`.',
})

export const geocoderConfigSchema = z
  .strictObject({
    // label / advanced / dependsOn: how the editor shows these in Search's block (widgets/search/settings.ts)
    provider: geocoderProviderSchema.meta({ ...geocoderProviderSchema.meta(), label: 'Geocoder' }),
    apiKey: z.string().optional().meta({
      description:
        'Required for `"maptiler"`. Visible to every visitor, so restrict it to your domain. Write `"$env:VITE_MAPTILER_KEY"` to read it from `app/.env` and keep it out of git.',
      see: 'https://conness-gis.com/guides/api-keys/',
      label: 'Geocoder API key',
      advanced: true,
      dependsOn: { path: 'geocoder.provider', equals: 'maptiler' },
    }),
    endpoint: z
      .string()
      .optional()
      .meta({ description: 'Custom request URL, e.g. a self-hosted Nominatim.', label: 'Geocoder endpoint', advanced: true }),
    limit: z.number().optional().meta({ description: 'Max place results.', default: 5, label: 'Geocoder result limit', advanced: true }),
  })
  .meta({ description: 'Place search.', see: 'https://conness-gis.com/widgets/search/#geocoder-searchgeocoder' })

export const searchableLayerSchema = z
  .strictObject({
    layerId: z.string().meta({ description: "Layer id from the project's `layers.json`." }),
    fields: z.string().array().meta({ description: 'Properties to match (case-insensitive).' }),
    labelField: z
      .string()
      .optional()
      .meta({ description: 'Property shown as the result label.', defaultText: 'the first of `fields`' }),
    limit: z.number().optional().meta({ description: 'Max results for this layer.', default: 8 }),
    pointZoom: z
      .number()
      .optional()
      .meta({ description: 'Zoom for point results from this layer.', defaultText: 'widgets.search.pointZoom' }),
  })
  .meta({
    description: 'A layer searchable by its properties. GeoJSON layers only.',
    see: 'https://conness-gis.com/widgets/search/#searchable-layers-searchlayers',
  })
