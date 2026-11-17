import { z } from 'zod'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

// read by the engine, the build and the editor, so keep React and assets
// out (relative .ts imports only), Node reads it too
export const about: WidgetAbout = {
  id: 'template',
  label: 'Template',
  description: 'Starter widget. Copy this folder to build a new one.',
  surfaces: ['top-bar'],
  defaults: { panelWidth: 320 },
}

// optional settings under widgets.<id>, the editor builds a block from them
// .meta() takes `label`, `advanced` and `dependsOn`, see ../WIDGETS.md
export const settings = z.strictObject({
  greeting: z.string().optional().meta({ description: 'Text shown at the top of the panel.', default: 'Hello!' }),
})

export type TemplateSettings = z.input<typeof settings>
