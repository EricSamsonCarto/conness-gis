import { settings } from '@user/settings'
import { useStore } from '../store'
import { resolveWidget } from './registry'

// the open widget follows the layout across the breakpoint
// it remounts, so it keeps only what it keeps on close
export function carryOpenWidget(toMobile: boolean): void {
  const s = useStore.getState()
  const floating = settings.floatingWidgets.flatMap((slot) => slot.widgets)
  const placed = (list: { widgetName: string }[], id: string) => list.some((p) => p.widgetName === id)

  if (!toMobile) {
    const id = s.mobileSheetWidgetId
    if (!id) return
    useStore.setState({ mobileSheetWidgetId: null })
    if (placed(settings.topBarWidgets, id)) s.setOpenWidget(id)
    else if (placed(settings.sidePanelWidgets, id)) s.setSideRailWidget(id)
    else if (placed(floating, id)) s.setActiveFloatingWidget(id)
    return
  }

  // a stayOnMobile pop-out stays a pop-out
  const pop = floating.find((p) => p.widgetName === s.activeFloatingWidgetId)
  const popId = pop && !resolveWidget(pop, 'floating').stayOnMobile ? pop.widgetName : null
  // undefined, so the side panel still shows its sideRailOpenOnLoad widget
  const sideId = s.sideRailWidgetId === undefined ? (settings.ui?.layout?.sideRailOpenOnLoad ?? null) : s.sideRailWidgetId
  const id = s.openWidgetId ?? popId ?? sideId
  // only a widget the phone layout offers
  if (!id || !((settings.mobileWidgets ?? []).includes(id) || placed(floating, id))) return
  useStore.setState({ mobileSheetWidgetId: id })
  if (id === s.openWidgetId) s.setOpenWidget(null)
  else if (id === popId) s.setActiveFloatingWidget(null)
  else s.setSideRailWidget(null)
}
