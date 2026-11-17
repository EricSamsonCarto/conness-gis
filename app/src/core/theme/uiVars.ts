import type { Settings } from '../types'

export const DEFAULT_FLOATING_ICON_SIZE_PX = 25
export const DEFAULT_TOP_BAR_ICON_SIZE_PX = 20
export const DEFAULT_SIDE_RAIL_ICON_SIZE_PX = 20
export const DEFAULT_TOP_BAR_HEIGHT_PX = 56
export const DEFAULT_LOGO_SIZE_PX = 32
export const DEFAULT_MOBILE_LOGO_SIZE_PX = 28
export const DEFAULT_TOP_BAR_MOBILE_VISIBLE_COUNT = 3
// 45 is as thin as the top bar goes before it looks cramped (Eric)
export const DEFAULT_MOBILE_TOP_BAR_HEIGHT_PX = 45
export const DEFAULT_MOBILE_WIDGET_BAR_HEIGHT_PX = 35

// the phone top bar's height, thinner once widget buttons get their own bar
export function mobileTopBarHeight(ui: Settings['ui']): number {
  const bottom = ui?.layout?.mobileWidgetBar === 'bottom'
  return ui?.topBar?.mobileHeight ?? (bottom ? DEFAULT_MOBILE_TOP_BAR_HEIGHT_PX : ui?.topBar?.height ?? DEFAULT_TOP_BAR_HEIGHT_PX)
}
export const DEFAULT_BUTTON_CURSOR: 'pointer' | 'default' = 'pointer'
export const DEFAULT_TOP_BAR_SHADOW_STRENGTH = 0.4
// px, index.css's @theme --text-* hold the same values for first paint
export const DEFAULT_TEXT_SIZES = { small: 11, medium: 12, large: 14, title: 14, button: 14, dialogButton: 12 }
export const DEFAULT_POPUP_TEXT_SIZES = { popupHeader: 14, popupTitle: 16, popupBody: 14 }
export const DEFAULT_TOP_BAR_TITLE_SIZE_PX = 18
export const DEFAULT_MOBILE_TOP_BAR_TITLE_SIZE_PX = 16

// px at a 16px root, as rem so sizes follow the browser font size
export const rem = (px: number) => `${px / 16}rem`

export function applyUiVars(ui: Settings['ui'], isMobile = false) {
  const root = document.documentElement
  // icons are 75% of the button, native glyphs too (index.css)
  const floatingBase = ui?.floatingControls?.iconSize ?? DEFAULT_FLOATING_ICON_SIZE_PX
  const floatingIcon =
    isMobile && ui?.floatingControls?.mobileIconSize !== undefined
      ? ui.floatingControls.mobileIconSize
      : floatingBase
  root.style.setProperty('--floating-control-size', rem(floatingIcon / 0.75))

  // top-bar button is twice the icon
  const topBarBase = ui?.topBar?.iconSize ?? DEFAULT_TOP_BAR_ICON_SIZE_PX
  const topBarIcon =
    isMobile && ui?.topBar?.mobileIconSize !== undefined
      ? ui.topBar.mobileIconSize
      : topBarBase
  root.style.setProperty('--top-bar-icon-size', rem(topBarIcon))
  root.style.setProperty('--top-bar-button-size', rem(topBarIcon * 2))

  // side-rail button = icon + fixed padding (SidePanel.tsx)
  const sideRailIcon = ui?.layout?.sideRailIconSize ?? DEFAULT_SIDE_RAIL_ICON_SIZE_PX
  root.style.setProperty('--side-rail-icon-size', rem(sideRailIcon))

  // Tailwind's text-small, medium, large, title and button classes read these
  const text = { ...DEFAULT_TEXT_SIZES, ...ui?.textSizes }
  for (const [name, px] of Object.entries(text)) root.style.setProperty(`--text-${name}`, rem(px))
  // text-popupHeader, popupTitle and popupBody, for popups.tsx too
  const popups = ui?.popups
  const popupText = {
    popupHeader: popups?.headerSize ?? DEFAULT_POPUP_TEXT_SIZES.popupHeader,
    popupTitle: popups?.titleSize ?? DEFAULT_POPUP_TEXT_SIZES.popupTitle,
    popupBody: popups?.bodySize ?? DEFAULT_POPUP_TEXT_SIZES.popupBody,
  }
  for (const [name, px] of Object.entries(popupText)) root.style.setProperty(`--text-${name}`, rem(px))

  const cursor = ui?.buttonCursor ?? DEFAULT_BUTTON_CURSOR
  root.style.setProperty('--widget-button-cursor', cursor)

  // each shadow is a gradient strip in <main>
  const shadowVars = (size: string, opacity: string, shadow: { enabled?: boolean; strength?: number } | undefined) => {
    const strength = clamp01(shadow?.strength ?? DEFAULT_TOP_BAR_SHADOW_STRENGTH)
    const enabled = Boolean(shadow?.enabled)
    root.style.setProperty(size, enabled ? rem(6 + strength * 14) : '0px')
    root.style.setProperty(opacity, enabled ? `${strength * 0.6}` : '0')
  }
  shadowVars('--top-bar-shadow-height', '--top-bar-shadow-opacity', ui?.topBar?.shadow)
  shadowVars('--side-rail-shadow-width', '--side-rail-shadow-opacity', ui?.layout?.sideRailShadow)
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
