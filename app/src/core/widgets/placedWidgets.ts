import type { Settings } from '../types.ts'

// every widget id the settings place, once each, in placement order
export function placedWidgetIds(settings: Settings): string[] {
  const ids = [
    ...settings.topBarWidgets.map((p) => p.widgetName),
    ...settings.sidePanelWidgets.map((p) => p.widgetName),
    ...settings.floatingWidgets.flatMap((slot) => slot.widgets.map((p) => p.widgetName)),
    ...(settings.mobileWidgets ?? []),
  ]
  return [...new Set(ids)]
}
