import { z } from 'zod'
import type { StyleSpecification } from 'maplibre-gl'

// loose on purpose: MapLibre validates the style itself
export const mapStyleSchema = z
  .union([
    z.string(),
    z.custom<StyleSpecification>((v) => typeof v === 'object' && v !== null && !Array.isArray(v)),
  ])
  .meta({ description: 'A style URL or an inline MapLibre style object.' })

export const basemapEntrySchema = z
  .strictObject({
    id: z.string().meta({ description: 'Unique id, `<name>-<source>`. Also the thumbnail filename.' }),
    name: z.string().meta({ description: 'Display name, `Name (Source)`.' }),
    style: mapStyleSchema,
    thumbnail: z
      .string()
      .optional()
      .meta({
        description:
          "An image's name in your project's `basemap-images/` folder (or the catalog's, `widgets/basemap/assets/basemap-images/`), or an image URL. Omit to use the image named after the basemap's id.",
      }),
    license: z
      .enum(['commercial-safe', 'restricted'])
      .optional()
      .meta({ description: '`"restricted"` entries are left out of the build when `commercialUse` is true.', default: 'commercial-safe' }),
  })
  .meta({ description: 'One entry in the basemap switcher.', see: 'https://conness-gis.com/configuration/map-camera/#basemaps' })

export const basemapsSchema = z
  .array(basemapEntrySchema)
  .meta({ description: "The basemap switcher's entries (`basemaps.json`), in order." })
