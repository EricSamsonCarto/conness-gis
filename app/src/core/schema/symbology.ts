import { z } from 'zod'

const SYMBOLOGY_DOCS = 'https://conness-gis.com/configuration/symbology/'

export const symbologySimpleSchema = z
  .strictObject({
    kind: z.literal('simple'),
    color: z.string().meta({ description: 'Dot, line or fill color.' }),
    width: z.number().optional().meta({ description: 'Line width.', default: 2 }),
    radius: z.number().optional().meta({ description: 'Dot radius.', default: 5 }),
    strokeColor: z.string().optional().meta({ description: 'Dot ring or polygon border color.', default: '#ffffff' }),
    strokeWidth: z
      .number()
      .optional()
      .meta({ description: 'Dot ring or polygon border width. 0 = none.', defaultText: '1 for points, 0 for polygons' }),
    opacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .meta({ description: 'Opacity of `color` (polygon fill, dot fill, the line itself), 0 to 1.', default: 1 }),
    strokeOpacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .meta({ description: 'Opacity of `strokeColor` (dot ring, polygon border), 0 to 1. Lines have no stroke.', default: 1 }),
  })
  .meta({
    description:
      'One color plus a few paint options. Meaning depends on geometry: point = dot and ring, line = line, polygon = fill and border.',
    see: `${SYMBOLOGY_DOCS}#simple`,
  })

export const legendOverrideSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('categories'),
        entries: z.array(
          z.strictObject({
            label: z.string(),
            color: z.string(),
            radius: z.number().optional(),
            strokeColor: z.string().optional(),
            strokeWidth: z.number().optional(),
          }),
        ),
      })
      .meta({ description: 'Discrete swatches.' }),
    z
      .strictObject({
        kind: z.literal('gradient'),
        stops: z
          .array(z.strictObject({ value: z.union([z.number(), z.string()]), label: z.string().optional(), color: z.string() }))
          .meta({ description: 'Low to high. The first and last labels mark the ends.' }),
      })
      .meta({ description: 'A continuous bar.' }),
    z.strictObject({ kind: z.literal('hidden') }).meta({ description: 'Leave this layer out of the legend.' }),
  ])
  .meta({
    id: 'legend',
    description: "Explicit legend, for paint the legend can't read on its own.",
    see: `${SYMBOLOGY_DOCS}#legend-overrides-raw-symbology-only`,
  })

export const symbologyRawSchema = z
  .strictObject({
    kind: z.literal('raw'),
    paint: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({ description: 'MapLibre paint properties, e.g. `"circle-color"`. Expressions allowed.' }),
    layout: z.record(z.string(), z.unknown()).optional().meta({ description: 'Extra MapLibre layout properties.' }),
    legend: legendOverrideSchema.optional().meta({ description: 'Explicit legend. Omit to read it from `paint`.' }),
    description: z
      .string()
      .optional()
      .meta({ description: 'Muted note under the layer name in the legend, e.g. `"Annual passengers"`.' }),
  })
  .meta({ description: 'A raw MapLibre paint object, for categorized or graduated styling.', see: `${SYMBOLOGY_DOCS}#raw` })

export const symbologyRefSchema = z
  .strictObject({
    kind: z.literal('ref'),
    name: z.string().meta({ description: "Entry name in the project's `symbology.json`." }),
  })
  .meta({ description: "Use a named entry from the project's `symbology.json`.", see: `${SYMBOLOGY_DOCS}#ref` })

export const symbologySchema = z
  .discriminatedUnion('kind', [symbologySimpleSchema, symbologyRawSchema, symbologyRefSchema])
  .meta({ id: 'symbology', description: 'How to draw it.', see: SYMBOLOGY_DOCS })

export const symbologyRegistrySchema = z
  .record(z.string(), z.discriminatedUnion('kind', [symbologySimpleSchema, symbologyRawSchema]))
  .meta({
    description: 'Named symbologies (`symbology.json`), used from a layer with `{ "kind": "ref", "name": "…" }`.',
    see: SYMBOLOGY_DOCS,
  })
