import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WidgetSchemas } from '../src/core/schema/settings.ts'
import type { WidgetAbout } from '../src/core/widget-types.ts'

export const WIDGETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../widgets')

// what a widget's settings.ts exports, its facts and maybe a schema
export type WidgetModule = { about: WidgetAbout; settings?: WidgetSchemas[string] }

// require() keeps loadProject synchronous. a schema edited while a dev
// server runs needs a restart, require caches it
const require = createRequire(import.meta.url)

// every widget's settings.ts, skipping _ folders as discovery does
export function loadWidgetModules(widgetsDir = WIDGETS_DIR): WidgetModule[] {
  return fs
    .readdirSync(widgetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(widgetsDir, d.name, 'settings.ts')))
    .map((d) => require(path.join(widgetsDir, d.name, 'settings.ts')) as WidgetModule)
}

// the widgets' settings schemas by id, to check widgets.<id>
export function widgetSchemas(widgetsDir = WIDGETS_DIR): WidgetSchemas {
  return Object.fromEntries(
    loadWidgetModules(widgetsDir).flatMap((m) => (m.settings ? [[m.about.id, m.settings]] : [])),
  )
}
