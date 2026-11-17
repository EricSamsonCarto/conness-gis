import { settings } from '@user/settings'

// widgets.<id> in settings.json, typed by its settings.ts, as in
// widgetSettings<MeasureSettings>('measure')
export function widgetSettings<T>(id: string): T | undefined {
  return settings.widgets?.[id] as T | undefined
}
