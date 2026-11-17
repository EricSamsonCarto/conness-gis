import { projectFiles, type WidgetSchemas } from '@/core/schema/settings'
import type { WidgetAbout } from '@/core/widget-types'
import { widgetSections } from './widgetSections'

// every widget's settings.ts, read as widget-settings.ts reads them
const modules = import.meta.glob<{ about: WidgetAbout; settings?: WidgetSchemas[string] }>('../../widgets/[!_]*/settings.ts', {
  eager: true,
})
const widgets = Object.values(modules)

export const WIDGET_SCHEMAS: WidgetSchemas = Object.fromEntries(
  widgets.flatMap((m) => (m.settings ? [[m.about.id, m.settings]] : [])),
)

// the project schemas with widgets.* filled in
export const PROJECT_SCHEMAS = projectFiles(WIDGET_SCHEMAS)

// each widget's block of settings, built from its schema (widgetSections.ts)
export const WIDGET_SECTIONS = widgetSections(
  widgets.flatMap((m) => (m.settings ? [{ id: m.about.id, label: m.about.label, schema: m.settings }] : [])),
)
