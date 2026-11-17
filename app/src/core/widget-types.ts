import type { ComponentType, LazyExoticComponent } from 'react'
import type { z } from 'zod'
import type { themeColorTokenSchema } from './schema/theme.ts'
import type { widgetHeaderSchema } from './schema/ui.ts'
import type { floatingOpensSchema, widgetPlacementSchema } from './schema/widgets.ts'

/** Where a widget can be placed. The top bar, the side rail, or a map corner. */
export type WidgetSurface = 'top-bar' | 'side-panel' | 'floating'

// 'mobile' (the top-bar carousel) is an icon-override key, not a surface
export type IconSurface = WidgetSurface | 'mobile'

export type ThemeColorToken = z.input<typeof themeColorTokenSchema>

export type WidgetHeaderConfig = z.input<typeof widgetHeaderSchema>

export interface ResolvedWidgetHeaderConfig {
  showTitle: boolean
  showDivider: boolean
  titleColor: ThemeColorToken
}

/**
 * A widget's default placement options. Placements can override each one.
 * @see https://conness-gis.com/guides/custom-widget/#defaults
 */
export interface WidgetDefaults {
  /** Panel width in px, top bar and floating. The side rail uses ui.layout.sideRailPanelWidth. @default 320 */
  panelWidth?: number
  /** `false` for action-only floating buttons with no panel. @default true */
  hasUI?: boolean
  /** Floating only. No title bar, the widget fills its pop-out. Search uses this. @default false */
  chromeless?: boolean
  /** Floating only. Stay over the map on mobile instead of opening in the bottom sheet. @default false */
  stayOnMobile?: boolean
  /** Floating only. Always over the map on mobile, a placement's `stayOnMobile` can't change it. @default false */
  alwaysOnMap?: boolean
  /** Floating only. Open toward the middle of the map (`sideways`) or below or above the button (`vertically`). @default by the corner's direction */
  opens?: FloatingOpens
}

/**
 * A widget's plain facts, exported as `about` from its `settings.ts`, read without React.
 * `widget.config.ts` spreads it into the manifest.
 * @see https://conness-gis.com/guides/custom-widget/#the-manifest
 */
export type WidgetAbout = Pick<WidgetManifest, 'id' | 'label' | 'description' | 'surfaces' | 'defaults'>

/**
 * A widget's `widget.config.ts` export.
 * @see https://conness-gis.com/guides/custom-widget/#the-manifest
 */
export interface WidgetManifest {
  /** Unique id, used in placements. */
  id: string
  /** Name in the panel header, tooltip and mobile carousel. */
  label: string
  /** Tooltip text. @default label */
  description?: string
  /** Imported SVG. Any color, the theme tints it. */
  icon: string
  /** A different icon shape for a surface. Shape only, never color. */
  icons?: Partial<Record<IconSurface, string>>
  /** Surfaces this widget can be placed on. */
  surfaces: WidgetSurface[]
  /** Default placement options. */
  defaults?: WidgetDefaults
  /** The widget's React component, usually `lazy(() => import('./Widget'))` so it loads on first open. */
  component: ComponentType | LazyExoticComponent<ComponentType>
  /** A phone view, shown in place of `component` in the mobile layout. Usually `lazy(() => import('./Widget.mobile'))`. @default component */
  mobileComponent?: ComponentType | LazyExoticComponent<ComponentType>
}

export type WidgetPlacement = z.input<typeof widgetPlacementSchema>

export type FloatingOpens = z.input<typeof floatingOpensSchema>

export interface ResolvedWidgetConfig {
  manifest: WidgetManifest
  panelWidth: number
  hasUI: boolean
  chromeless: boolean
  // CSS `order` within the floating corner
  order: number
  // keep the pop-out over the map on mobile, not in the sheet
  stayOnMobile: boolean
  // unset, the floating corner's direction decides
  opens?: FloatingOpens
  header: ResolvedWidgetHeaderConfig
}

export const DEFAULT_PANEL_WIDTH = 320

export const DEFAULT_WIDGET_HEADER: ResolvedWidgetHeaderConfig = {
  showTitle: true,
  showDivider: true,
  titleColor: 'text',
}
