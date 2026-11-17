import { z } from 'zod'
import { contoursSchema, hillshadeSchema } from '../../src/core/schema/settings.ts'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'basemap',
  label: 'Basemaps',
  description: 'Switch the active basemap.',
  surfaces: ['top-bar', 'side-panel'],
  defaults: { panelWidth: 320 },
}

// widgets.basemap in settings.json, the list itself is basemaps.json
export const settings = z
  .strictObject({
    showNone: z.boolean().optional().meta({
      description: 'Show a "No Basemap" switch with Hillshade and Contours. Turning it off brings back the basemap that was on before. With no basemap, `map.backgroundColor` shows.',
      default: true,
      label: 'Offer "No basemap"',
    }),
    hillshade: hillshadeSchema.optional().meta({ popout: true, label: 'Hillshade' }),
    contours: contoursSchema.optional().meta({ popout: true, label: 'Contours' }),
  })
  .meta({ description: 'Basemap widget.', see: 'https://conness-gis.com/widgets/basemap/' })

export type BasemapSettings = z.input<typeof settings>
