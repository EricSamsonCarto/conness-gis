import { configError } from '../configError.ts'
import type { Settings, ShellSide } from '../types.ts'

export interface ResolvedLayout {
  sideRailSide: ShellSide
  topBarPanelSide: ShellSide
  // widget buttons only, branding sits opposite
  topBarWidgetsSide: ShellSide
  brandingSide: ShellSide
  showInfo: boolean
  showBranding: boolean
  // desktop only, mobile keeps its own top bar and carousel
  showTopBar: boolean
  showSideRail: boolean
}

const opposite = (side: ShellSide): ShellSide =>
  side === 'left' ? 'right' : 'left'

export function resolveLayout(settings: Settings): ResolvedLayout {
  const layout = settings.ui?.layout
  const topBarWidgetsSide = layout?.topBarWidgetsSide ?? 'right'
  const sideRailSide = layout?.sideRailSide ?? 'left'
  return {
    sideRailSide,
    // opposite the rail unless set, so moving the rail moves the panel with it
    topBarPanelSide: layout?.topBarPanelSide ?? opposite(sideRailSide),
    topBarWidgetsSide,
    brandingSide: opposite(topBarWidgetsSide),
    showInfo: layout?.showInfo ?? true,
    showBranding: layout?.showBranding ?? true,
    showTopBar: layout?.showTopBar ?? true,
    showSideRail: layout?.showSideRail ?? true,
  }
}

// the top bar widget open at start, if it's placed and the bar is shown
export function topBarOpenOnLoad(settings: Settings): string | null {
  const id = settings.ui?.layout?.topBarOpenOnLoad
  if (!id || !resolveLayout(settings).showTopBar) return null
  if (settings.topBarWidgets.some((p) => p.widgetName === id)) return id
  console.warn(`[conness-gis] ui.layout.topBarOpenOnLoad: "${id}" isn't placed in the top bar, so the panel starts closed.`)
  return null
}

// rail and top-bar panel on one side overlap when both show widgets
export function validateLayout(settings: Settings): void {
  const { sideRailSide, topBarPanelSide, showTopBar, showSideRail } = resolveLayout(settings)
  const hasTopBarWidgets = showTopBar && settings.topBarWidgets.length > 0
  const hasRailWidgets = showSideRail && settings.sidePanelWidgets.length > 0
  // placements on a hidden bar are skipped, said once so it's clear why
  if (!showTopBar && settings.topBarWidgets.length > 0) {
    console.info('[conness-gis] ui.layout.showTopBar is off, so the top-bar widgets are hidden on desktop.')
  }
  if (!showSideRail && settings.sidePanelWidgets.length > 0) {
    console.info('[conness-gis] ui.layout.showSideRail is off, so the side rail widgets are hidden on desktop.')
  }
  if (sideRailSide === topBarPanelSide && hasTopBarWidgets && hasRailWidgets) {
    throw configError({
      where: 'settings.ui.layout.sideRailSide and settings.ui.layout.topBarPanelSide',
      why: `are both '${sideRailSide}', so the side rail and the top-bar widgets' panel would overlap`,
      fix: 'remove topBarPanelSide (it then opens opposite the side rail), or put them on opposite sides',
    })
  }
}
