import { useEffect, useState } from 'react'
import { schemaInfo } from '../settings/schemaInfo'

// where widgets are placed, read from settings.json's four placement lists
export type WidgetInfo = {
  id: string
  label: string
  surfaces: string[]
  hasInfo: boolean
  // its manifest's placement defaults (settings.ts `about.defaults`)
  defaults?: { panelWidth?: number; opens?: string; stayOnMobile?: boolean; alwaysOnMap?: boolean; chromeless?: boolean }
}
type Placement = { widgetName: string } & Record<string, unknown>
type Settings = {
  topBarWidgets?: Placement[]
  sidePanelWidgets?: Placement[]
  floatingWidgets?: { slot: string; widgets: Placement[] }[]
  mobileWidgets?: string[]
  mapControls?: Record<string, { position?: string; order?: number } | undefined>
}

// one list per surface in use, `param` is '<list>|<slot index>|<index>'
export type PlacementList = { title: string; items: { id: string; param: string }[] }

// `floating: false` leaves floating widgets for Arrange corners
export function placementLists(settings: Settings, { floating = true } = {}): PlacementList[] {
  return [
    { title: 'Top bar', items: (settings.topBarWidgets ?? []).map((p, i) => ({ id: p.widgetName, param: `topBarWidgets||${i}` })) },
    { title: 'Side panel', items: (settings.sidePanelWidgets ?? []).map((p, i) => ({ id: p.widgetName, param: `sidePanelWidgets||${i}` })) },
    ...(floating ? floatingLists(settings) : []),
    { title: 'Mobile', items: (settings.mobileWidgets ?? []).map((id, i) => ({ id, param: `mobileWidgets||${i}` })) },
  ]
}

function floatingLists(settings: Settings): PlacementList[] {
  return (settings.floatingWidgets ?? []).map((slot, s) => ({
    title: `Floating · ${slot.slot}`,
    items: slot.widgets.map((p, i) => ({ id: p.widgetName, param: `floatingWidgets|${s}|${i}` })),
  }))
}

// the order mapControls.ts adds native controls in, kept per corner
const CONTROL_ORDER = ['attribution', 'navigation', 'geolocate', 'fullscreen', 'globe', 'spin', 'scale', 'zoomLevel', 'terrain']
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export type CornerItem = { kind: 'control'; key: string } | { kind: 'widget'; id: string; param: string }

// controls and floating widgets share one `order` scale, and ties keep
// controls first, since floating widgets are added after the map
export function cornerLists(settings: Settings): { corner: string; items: CornerItem[] }[] {
  return CORNERS.map((corner) => {
    const controls = CONTROL_ORDER.flatMap((key) => {
      // the credits button is always on, the others while their key is set
      const control = settings.mapControls?.[key] ?? (key === 'attribution' ? {} : undefined)
      if (!control) return []
      const at = control.position ?? schemaInfo(`settings:mapControls.${key}.position`).default
      const order = control.order ?? (schemaInfo(`settings:mapControls.${key}.order`).default as number)
      return at === corner ? [{ order, item: { kind: 'control', key } as CornerItem }] : []
    })
    const s = (settings.floatingWidgets ?? []).findIndex((slot) => slot.slot === corner)
    const widgets = (settings.floatingWidgets?.[s]?.widgets ?? []).map((p, i) => ({
      order: typeof p.order === 'number' ? p.order : 0,
      item: { kind: 'widget', id: p.widgetName, param: `floatingWidgets|${s}|${i}` } as CornerItem,
    }))
    // Array.sort is stable, so equal orders keep controls-then-widgets
    const items = [...controls, ...widgets].sort((a, b) => a.order - b.order).map((x) => x.item)
    return { corner, items }
  })
}

export function useWidgetList(): WidgetInfo[] {
  const [widgets, setWidgets] = useState<WidgetInfo[]>([])
  useEffect(() => {
    fetch('/api/widgets')
      .then((res) => res.json())
      .then(setWidgets, () => setWidgets([]))
  }, [])
  return widgets
}
