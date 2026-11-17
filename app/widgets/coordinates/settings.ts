import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'coordinates',
  label: 'Coordinates',
  description: 'Live cursor / view coordinates with copy-to-clipboard.',
  surfaces: ['floating'],
  defaults: { panelWidth: 220, hasUI: true },
}
