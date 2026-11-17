import { z } from 'zod'
import { exportFormatSchema } from '../../src/core/schema/ui.ts'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'draw',
  label: 'Draw',
  description: 'Draw points, lines, and polygons on the map.',
  // too large for floating, it lives in the top-bar panel
  surfaces: ['top-bar', 'side-panel'],
  defaults: { panelWidth: 320, hasUI: true },
}

export const drawDefaultStyleSchema = z
  .strictObject({
    width: z.number().optional().meta({ description: 'Line and border width.', default: 2.5, label: 'Line width' }),
    radius: z.number().optional().meta({ description: 'Point radius.', default: 6, label: 'Point radius' }),
    strokeColor: z
      .string()
      .optional()
      .meta({ description: 'Point ring and text halo color.', default: '#ffffff', label: 'Stroke color' }),
    strokeWidth: z
      .number()
      .optional()
      .meta({ description: 'Point ring and text halo width.', default: 2, label: 'Stroke width' }),
    fillOpacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .meta({ description: 'Polygon fill opacity, 0 to 1.', default: 0.2, label: 'Fill opacity' }),
    boundaryOpacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .meta({ description: 'Polygon border opacity, 0 to 1.', default: 1, label: 'Border opacity' }),
    shadow: z
      .boolean()
      .optional()
      .meta({ description: 'Drop shadow under lines and polygon borders.', default: false, label: 'Drop shadow' }),
    shadowIntensity: z.number().min(0).max(1).optional().meta({
      description: 'Drop shadow strength, 0 to 1.',
      default: 0.5,
      label: 'Shadow strength',
      dependsOn: { path: 'defaultStyle.shadow' },
    }),
    fontSize: z.number().optional().meta({ description: 'Text size in px.', default: 20, label: 'Text size' }),
  })
  .meta({ description: 'Style for new drawings. Color comes from a rotating palette.' })

// widgets.draw in settings.json
export const settings = z
  .strictObject({
    // mirrors DrawTool in ./Widget.tsx
    tools: z
      .enum(['point', 'line', 'polygon', 'text'])
      .array()
      .optional()
      .meta({ description: 'Tools offered, in this order. Empty means all.', defaultText: 'all four' }),
    exportFormats: exportFormatSchema
      .exclude(['csv'])
      .array()
      .optional()
      .meta({
        description:
          'Formats Download offers, in this order (no CSV: drawings have no table). One format skips the choice. Empty means all.',
        defaultText: 'all three',
      }),
    maxCount: z.number().optional().meta({
      description: 'Most drawing sets a user can save. At the limit, saving is refused until one is deleted. 0 = no limit.',
      default: 50,
      label: 'Saved set limit',
    }),
    // every style field is advanced, the editor flattens this object
    defaultStyle: drawDefaultStyleSchema
      .optional()
      .meta({ description: 'Style for new drawings. Users can restyle each one after.', advanced: true }),
  })
  .meta({ description: 'Draw widget.', see: 'https://conness-gis.com/widgets/draw/' })

export type DrawSettings = z.input<typeof settings>
