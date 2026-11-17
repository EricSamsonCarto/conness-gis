import type { BaseColors, Settings, ThemeColors, ThemeSettings } from '../types'
import { THEMES, type ThemeMode } from './themes'
import { configError } from '../configError'

// mirrors index.css @theme
export const DEFAULT_COLORS: BaseColors = {
  primary: 'blue-900',
  strongText: 'slate-900',
  text: 'slate-600',
  surface: 'slate-100',
  layerGroupBg: 'surface',
  danger: 'rose-600',
  dangerHover: 'rose-700',
  success: 'emerald-600',
  successHover: 'emerald-700',
  disabledBg: 'gray-200',
  disabledText: 'gray-400',
  hover: 'amber-500',
  featureHighlight: 'cyan-400',
  slider: 'primary',
  actionActive: 'primary',
  actionActiveHover: 'primaryDarker',
  actionNotActive: 'white',
  actionNotActiveHover: 'slate-50',
  save: 'primary',
  saveHover: 'primaryDarker',
  popupHeaderBg: 'surface',
  popupArrow: 'text',
  dropdownHover: 'primary',
  panelBg: 'white',
  panelBorder: 'slate-200',
  panelWidget: 'black',
  topBarBg: 'primary',
  titleText: 'white',
  topBarWidget: 'white',
}

// black % mixed into primary for 'primaryDarker'
const PRIMARY_DARKER_MIX = 15

// called from AppShell, applyTheme runs before its try/catch exists
export function validateThemeConfig(settings: Settings): void {
  const theme = settings.theme?.preset
  if (theme !== undefined && theme !== 'conness' && !(theme in THEMES)) {
    throw configError({
      where: 'settings.theme.preset',
      why: `is '${theme}', which isn't a known theme`,
      fix: `use one of: conness, ${Object.keys(THEMES).join(', ')}`,
    })
  }
  // values become var(--color-<value>), a CSS color would blank silently
  for (const [token, value] of Object.entries(settings.theme?.colors ?? {})) {
    if (typeof value === 'string' && /^(#|rgb|hsl|oklch)/i.test(value.trim())) {
      throw configError({
        where: `settings.theme.colors.${token}`,
        why: `is '${value}', a CSS color, but theme colors take Tailwind color names`,
        fix: "use a Tailwind name like 'blue-700' or 'slate-900' (or another token's name, e.g. 'primary'). See \"Why Tailwind names instead of hex?\" on the Theme docs page.",
      })
    }
  }
}

// 'conness' is DEFAULT_COLORS itself, nothing to look up
function presetFor(theme: ThemeSettings) {
  return theme.preset && theme.preset !== 'conness' ? THEMES[theme.preset] : undefined
}

export function resolveThemeColors(theme: ThemeSettings): BaseColors {
  const preset = presetFor(theme)?.colors
  return { ...DEFAULT_COLORS, ...preset, ...stripUndefined(theme.colors ?? {}) }
}

function themeMode(theme: ThemeSettings): ThemeMode {
  return presetFor(theme)?.mode ?? 'light'
}

// a token-name value (primary etc.) cross-references that token
export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement
  const mode = themeMode(theme)
  root.dataset.theme = mode
  root.style.colorScheme = mode
  const resolved = resolveThemeColors(theme)
  for (const [token, value] of Object.entries(resolved)) {
    const ref =
      value === 'primaryDarker'
        ? `color-mix(in srgb, var(--color-primary) ${100 - PRIMARY_DARKER_MIX}%, black)`
        : `var(--color-${value})`
    root.style.setProperty(`--color-${token}`, ref)
  }
  // a live theme change can leave it from the theme before
  if (!('mapControlBg' in resolved)) root.style.removeProperty('--color-mapControlBg')
  // map control icons as set, else whichever reads on the button color
  const icons = theme.mapControlIcons ?? (isDark(resolvedThemeColor('mapControlBg' in resolved ? 'mapControlBg' : 'panelBg')) ? 'white' : 'black')
  root.dataset.mapControls = icons === 'white' ? 'dark' : 'light'
}

// an rgb() color's relative luminance below the middle grey
function isDark(rgb: string): boolean {
  const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

// MapLibre paint can't read CSS variables, so a canvas turns oklch into rgb
export function resolvedThemeColor(token: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(--color-${token})`
  document.body.appendChild(probe)
  const css = getComputedStyle(probe).color
  probe.remove()
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return css
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

// explicit undefined would clobber DEFAULT_COLORS
function stripUndefined(o: ThemeColors): ThemeColors {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v
  return out as ThemeColors
}
