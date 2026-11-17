import { z } from 'zod'
import { layerListActionsSchema } from '../../src/core/schema/layers.ts'
import { exportFormatSchema } from '../../src/core/schema/ui.ts'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'layer-list',
  label: 'Layers',
  description: 'Toggle layer visibility and opacity.',
  surfaces: ['side-panel', 'top-bar'],
}

// a layer's own `actions` win over these
export const settings = z
  .strictObject({
    toggleStyle: z.enum(['eye', 'checkbox']).optional().meta({ description: 'Layer toggle look.', default: 'eye' }),
    actions: layerListActionsSchema.optional().meta({ description: 'Which row-menu items show. Layers can override.' }),
    rowClickToggle: z.boolean().optional().meta({
      description: 'Clicking anywhere on a layer row toggles it. Group rows still need their toggle.',
      default: true,
    }),
    groupsCollapsedByDefault: z.boolean().optional().meta({
      description: 'Start every group collapsed. Override per group in `layerGroups`.',
      default: true,
      advanced: true,
    }),
    exportFormats: exportFormatSchema.array().optional().meta({
      description: 'Formats Export Data offers, in this order. One format skips the choice. Empty means all.',
      defaultText: 'all four',
      advanced: true,
      dependsOn: { path: 'actions.export' },
    }),
  })
  .meta({ description: 'Layer List widget.', see: 'https://conness-gis.com/widgets/layer-list/' })

export type LayerListSettings = z.input<typeof settings>
