import { z } from 'zod'
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'bookmarks',
  label: 'Bookmarks',
  description: 'Save and restore map views (camera, layers, basemap).',
  surfaces: ['side-panel', 'top-bar'],
  defaults: { panelWidth: 300 },
}

// widgets.bookmarks in settings.json
export const settings = z
  .strictObject({
    maxCount: z.number().optional().meta({
      description: 'Most bookmarks a user can keep. At the limit, saving is refused until one is deleted. 0 = no limit.',
      default: 35,
      label: 'Bookmark limit',
    }),
  })
  .meta({ description: 'Bookmarks widget.', see: 'https://conness-gis.com/widgets/bookmarks/' })

export type BookmarksSettings = z.input<typeof settings>
