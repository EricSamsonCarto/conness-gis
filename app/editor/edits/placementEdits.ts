// turning widgets on and off and moving them, in place
type Placement = { widgetName: string } & Record<string, unknown>
type Slot = { slot: string; widgets: Placement[] }
type Settings = {
  topBarWidgets?: Placement[]
  sidePanelWidgets?: Placement[]
  floatingWidgets?: Slot[]
  mobileWidgets?: string[]
}

// 'top-bar', 'side-panel', or a floating corner like 'floating:top-left'
export type Where = string

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

// the places a widget can go, from its manifest's surfaces
export function wheresFor(surfaces: string[]): Where[] {
  return surfaces.flatMap((s) => (s === 'floating' ? CORNERS.map((c) => `floating:${c}`) : [s]))
}

export function whereOf(settings: Settings, id: string): Where | null {
  if (settings.topBarWidgets?.some((p) => p.widgetName === id)) return 'top-bar'
  if (settings.sidePanelWidgets?.some((p) => p.widgetName === id)) return 'side-panel'
  const slot = settings.floatingWidgets?.find((s) => s.widgets.some((p) => p.widgetName === id))
  return slot ? `floating:${slot.slot}` : null
}

// out of the desktop surfaces, not mobile, returning its options
function detach(settings: Settings, id: string): Placement | undefined {
  let found: Placement | undefined
  const take = (list: Placement[] | undefined) => {
    const i = list?.findIndex((p) => p.widgetName === id) ?? -1
    if (list && i >= 0) found = list.splice(i, 1)[0]
  }
  take(settings.topBarWidgets)
  take(settings.sidePanelWidgets)
  for (const slot of settings.floatingWidgets ?? []) take(slot.widgets)
  if (settings.floatingWidgets) settings.floatingWidgets = settings.floatingWidgets.filter((s) => s.widgets.length > 0)
  return found
}

function attach(settings: Settings, placement: Placement, where: Where) {
  if (where === 'top-bar') (settings.topBarWidgets ??= []).push(placement)
  else if (where === 'side-panel') (settings.sidePanelWidgets ??= []).push(placement)
  else {
    const corner = where.replace('floating:', '')
    const slots = (settings.floatingWidgets ??= [])
    let slot = slots.find((s) => s.slot === corner)
    if (!slot) slots.push((slot = { slot: corner, widgets: [] }))
    slot.widgets.push(placement)
  }
}

// the first place its manifest allows, floating-only starts top-left
export function turnOn(settings: Settings, id: string, surfaces: string[]): void {
  if (whereOf(settings, id)) return
  const where = wheresFor(surfaces)[0]
  if (where) attach(settings, { widgetName: id }, where)
}

// gone from every list, mobile included
export function turnOff(settings: Settings, id: string): void {
  detach(settings, id)
  if (settings.mobileWidgets) settings.mobileWidgets = settings.mobileWidgets.filter((w) => w !== id)
}

// moves the placement, options and all, to the end of the new place
export function moveTo(settings: Settings, id: string, where: Where): void {
  const placement = detach(settings, id) ?? { widgetName: id }
  attach(settings, placement, where)
}

export function setOnMobile(settings: Settings, id: string, on: boolean): void {
  const list = settings.mobileWidgets ?? []
  settings.mobileWidgets = on ? (list.includes(id) ? list : [...list, id]) : list.filter((w) => w !== id)
}
