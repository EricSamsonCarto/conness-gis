import { z } from 'zod'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'measure',
  label: 'Measure',
  description: 'Measure distances and areas on the map.',
  // no 'floating': too large for a map-corner pop-out
  surfaces: ['top-bar', 'side-panel'],
  defaults: { panelWidth: 320, hasUI: true },
}

// lib/units.ts keeps the conversions for these
export const linearUnitSchema = z.enum(['miles', 'kilometers', 'meters', 'feet', 'yards'])
export const areaUnitSchema = z.enum(['acres', 'square-miles', 'square-kilometers', 'square-meters', 'square-feet', 'hectares'])

// widgets.measure in settings.json
export const settings = z
  .strictObject({
    defaultLinearUnit: linearUnitSchema.optional().meta({ default: 'kilometers' }),
    defaultAreaUnit: areaUnitSchema.optional().meta({ default: 'square-kilometers' }),
    showTotal: z
      .boolean()
      .optional()
      .meta({ description: 'Total length or area label.', default: true, advanced: true }),
    persistOnClose: z.boolean().optional().meta({
      description: 'Keep measurements on the map after the widget closes.',
      default: false,
      advanced: true,
    }),
    showEdgeLabels: z
      .boolean()
      .optional()
      .meta({ description: 'Length label on each segment.', default: false, advanced: true }),
    precision: z.number().optional().meta({ description: 'Decimal places.', default: 2, advanced: true }),
    linearUnits: linearUnitSchema
      .array()
      .optional()
      .meta({ description: 'Distance units offered, in this order.', defaultText: 'all', advanced: true }),
    areaUnits: areaUnitSchema
      .array()
      .optional()
      .meta({ description: 'Area units offered, in this order.', defaultText: 'all', advanced: true }),
  })
  .meta({
    description: "Measure widget. Each field sets a control's starting value. Users can change it, and it sticks until reload.",
    see: 'https://conness-gis.com/widgets/measure/',
  })

export type MeasureSettings = z.input<typeof settings>
