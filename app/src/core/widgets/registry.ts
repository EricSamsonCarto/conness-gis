import { settings } from '@user/settings'
import manifestModules from 'virtual:widget-configs'
import { configError } from '../configError'
import type {
  IconSurface,
  ResolvedWidgetConfig,
  ResolvedWidgetHeaderConfig,
  WidgetManifest,
  WidgetPlacement,
  WidgetSurface,
} from '../widget-types'
import {
  DEFAULT_PANEL_WIDTH,
  DEFAULT_WIDGET_HEADER,
} from '../widget-types'

export const widgetRegistry: Record<string, WidgetManifest> = (() => {
  const out: Record<string, WidgetManifest> = {}
  for (const [path, mod] of Object.entries(manifestModules)) {
    const manifest = mod.manifest
    if (!manifest) {
      throw configError({
        where: `Widget file at ${path}`,
        why: `is missing its 'manifest' export`,
        fix: 'add `export const manifest` (see app/widgets/_template/widget.config.ts)',
      })
    }
    // a build finds placed widgets by folder name
    const folder = path.split('/').at(-2)
    if (manifest.id !== folder) {
      throw configError({
        where: `Widget id "${manifest.id}"`,
        why: `doesn't match its folder name "${folder}"`,
        fix: 'rename the folder or the id so they match',
      })
    }
    out[manifest.id] = manifest
  }
  return out
})()

export function getWidgetManifest(id: string): WidgetManifest {
  const manifest = widgetRegistry[id]
  if (!manifest) {
    const known = Object.keys(widgetRegistry).sort().join(', ') || '(none)'
    throw configError({
      where: `Widget "${id}"`,
      why: 'is not a known widget',
      fix: `known widgets: ${known}. Check the widget folder exists under app/widgets/ and exports a valid manifest.`,
    })
  }
  return manifest
}

export function iconForSurface(
  manifest: WidgetManifest,
  surface: IconSurface,
): string {
  return manifest.icons?.[surface] ?? manifest.icon
}

// carousel sits on the top bar, so its icon beats the base as fallback
export function mobileIconFor(manifest: WidgetManifest): string {
  return (
    manifest.icons?.mobile ?? manifest.icons?.['top-bar'] ?? manifest.icon
  )
}

export function assertSurfaceSupported(
  manifest: WidgetManifest,
  surface: WidgetSurface,
): void {
  if (!manifest.surfaces.includes(surface)) {
    throw configError({
      where: `Widget "${manifest.id}"`,
      why: `cannot be placed on surface "${surface}"`,
      fix: `its manifest only declares surfaces: [${manifest.surfaces.join(', ')}]. Place it on one of those, or add "${surface}" to the widget's manifest`,
    })
  }
}

// there's no 'mobile' surface, so resolve against each widget's first one
export function resolveMobileWidgets(names: string[]): ResolvedWidgetConfig[] {
  return names.map((name) => {
    const manifest = getWidgetManifest(name)
    const surface = manifest.surfaces[0]
    if (!surface) {
      throw configError({
        where: `Widget "${name}" in settings.mobileWidgets`,
        why: 'declares no surfaces in its manifest',
        fix: 'it has no UI to show in the mobile sheet. Give the widget a surface, or remove it from mobileWidgets',
      })
    }
    return resolveWidget({ widgetName: name }, surface)
  })
}

export function resolveWidget(
  placement: WidgetPlacement,
  surface: WidgetSurface,
): ResolvedWidgetConfig {
  const manifest = getWidgetManifest(placement.widgetName)
  assertSurfaceSupported(manifest, surface)

  const defaults = manifest.defaults ?? {}
  const panelWidth: number =
    placement.panelWidth ?? defaults.panelWidth ?? DEFAULT_PANEL_WIDTH
  const hasUI: boolean = defaults.hasUI ?? true
  const chromeless: boolean = defaults.chromeless ?? false
  const order: number = placement.order ?? 0
  const stayOnMobile: boolean =
    defaults.alwaysOnMap === true || (placement.stayOnMobile ?? defaults.stayOnMobile ?? false)

  const globalHeader = settings.ui?.widgetHeader ?? {}
  const instanceHeader = placement.header ?? {}
  const header: ResolvedWidgetHeaderConfig = {
    showTitle:
      instanceHeader.showTitle ??
      globalHeader.showTitle ??
      DEFAULT_WIDGET_HEADER.showTitle,
    showDivider:
      instanceHeader.showDivider ??
      globalHeader.showDivider ??
      DEFAULT_WIDGET_HEADER.showDivider,
    titleColor:
      instanceHeader.titleColor ??
      settings.theme?.widgetTitleColor ??
      DEFAULT_WIDGET_HEADER.titleColor,
  }

  const opens = placement.opens ?? defaults.opens

  return { manifest, panelWidth, hasUI, chromeless, order, stayOnMobile, opens, header }
}
