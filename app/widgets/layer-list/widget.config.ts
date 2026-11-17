import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import iconMobile from './assets/icon-mobile.svg'
import { about } from './settings'

export const manifest: WidgetManifest = {
  ...about,
  icon,
  // simpler shape for the small mobile-carousel button
  icons: {
    mobile: iconMobile,
  },
  component: lazy(() => import('./Widget').then((m) => ({ default: m.LayerListWidget }))),
}
