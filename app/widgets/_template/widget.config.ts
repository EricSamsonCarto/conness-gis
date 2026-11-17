import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import { about } from './settings'

// copy to a folder without the underscore (those are skipped) and give
// `id` in settings.ts a unique slug. ../WIDGETS.md has the rest
export const manifest: WidgetManifest = {
  ...about,
  icon,
  // loaded on first open, so it stays out of the startup download
  component: lazy(() => import('./Widget').then((m) => ({ default: m.TemplateWidget }))),
  // optional phone view, loaded only on phones
  mobileComponent: lazy(() => import('./Widget.mobile').then((m) => ({ default: m.TemplateMobileWidget }))),
}
