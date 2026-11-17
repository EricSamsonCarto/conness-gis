import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import { about } from './settings'

export const manifest: WidgetManifest = {
  ...about,
  icon,
  component: lazy(() => import('./Widget').then((m) => ({ default: m.DrawWidget }))),
  mobileComponent: lazy(() => import('./Widget.mobile').then((m) => ({ default: m.DrawMobileWidget }))),
}
