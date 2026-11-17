---
icon: lucide/graduation-cap
---

# Your First Widget

A five-minute walkthrough. You'll build a small widget that shows the current zoom level in the top bar, and along the way see every step a widget goes through: folder, manifest, placement.

## 1. Copy the template

Every widget is a folder under `app/widgets/`. The starter is `app/widgets/_template/`; the leading underscore keeps the shell from loading it. Copy it to a new name without the underscore:

```
app/widgets/_template/   →   app/widgets/zoom/
```

You now have `app/widgets/zoom/` with the standard widget layout: `settings.ts`, `widget.config.ts` and `Widget.tsx` at the top, the launcher icon in `assets/icon.svg`, and empty `components/` and `lib/` folders for later. Delete `Widget.mobile.tsx`. It's the template's phone view, and this widget looks the same on phones ([Phone version](custom-widget.md#phone-version) covers it).

## 2. Write the component

Replace `app/widgets/zoom/Widget.tsx` with a component that reads the map's zoom. The kit has hooks that give you the map:

```tsx
import { useEffect, useState } from 'react'
import { useMap, useMapReady } from '@/core/hooks'

export function ZoomWidget() {
  const map = useMap()
  const ready = useMapReady()
  const [zoom, setZoom] = useState(0)

  useEffect(() => {
    if (!map || !ready) return
    const update = () => setZoom(map.getZoom())
    update()
    map.on('move', update)
    return () => map.off('move', update)
  }, [map, ready])

  return (
    <div className="p-4">
      <h2 className="mb-1 text-title font-semibold text-strongText">Current zoom</h2>
      <p className="text-large font-bold text-primary">{zoom.toFixed(2)}</p>
    </div>
  )
}
```

`useMap()` and `useMapReady()` from `@/core/hooks` give you the MapLibre map once it exists; always wait for `ready` before using it. `text-strongText` and `text-primary` are theme colors, so the widget follows the app's theme; `text-title` and `text-large` are the kit's text sizes, which follow the project's text-size settings.

## 3. Describe it: `settings.ts` and the manifest

Every widget has a `settings.ts` with its plain facts, `about`, which the shell, the build and the Conness editor read. Open `app/widgets/zoom/settings.ts` and give it a unique id, a label and the surface you want. This widget has no settings for users, so delete the template's `settings` export:

```ts
import type { WidgetAbout } from '../../src/core/widget-types.ts'

export const about: WidgetAbout = {
  id: 'zoom',
  label: 'Zoom',
  description: 'Shows the current map zoom level.',
  surfaces: ['top-bar'],
}
```

Then `app/widgets/zoom/widget.config.ts` adds the icon and points at your component:

```ts
import { lazy } from 'react'
import type { WidgetManifest } from '@/core/widget-types'
import icon from './assets/icon.svg'
import { about } from './settings'

export const manifest: WidgetManifest = {
  ...about,
  icon,
  component: lazy(() => import('./Widget').then((m) => ({ default: m.ZoomWidget }))),
}
```

`lazy` means the widget's code loads the first time someone opens it, with a spinner meanwhile, so it stays out of the app's startup download.

The `id` must match the folder name (`zoom` here); the shell checks this and stops with an error if they differ, which also keeps ids unique. The shell finds the folder on its own; there's no list of widgets to edit. Keep `settings.ts` free of React and assets: it's read outside the app too.

## 4. Place it

The editor reads each widget's `settings.ts` when it starts, so stop `npm start` if it's running and start it again. Open your project, go to **Widgets**, turn on **Zoom** and set **Where** to the top bar. The Preview Pane shows the new icon right away; click **Save** to keep it.

Without the editor, add the widget to the top bar in your project's `settings.json`, next to any widgets already there:

```json
"topBarWidgets": [
  { "widgetName": "zoom" }
]
```

## 5. Run it

In the editor, the widget runs in The Preview Pane as soon as you place it. A new icon appears in the app's top bar there. Click it to open a panel showing the zoom, then zoom the map in the pane and watch it update. The device buttons in the editor's top bar switch the pane to a phone, where the widget opens in the bottom sheet once you turn on **On mobile** in its block. Change `Widget.tsx` and the pane reloads with your edit, so you can keep testing there.

Without the editor, run the project with your project's folder name:

```bash
npm run dev my-project
```

The same icon appears in the top bar of the app it opens.

## What just happened

- Because the folder name has no underscore, the shell loaded it. In `npm run dev` every widget folder loads; `npm run build` bundles only the widgets a project places, so an unplaced widget costs the built app nothing.
- `about` in `settings.ts` told the shell, the build and the editor the widget's id, label and surface; the `manifest` added its icon and component.
- `surfaces: ['top-bar']` in the manifest made the top bar the editor's only **Where** for it, and allowed it in `topBarWidgets`.
- `useMap()` gave your component the live map.

[Building a Custom Widget](custom-widget.md) covers the rest: settings users can change (and how they show in the Conness editor), multiple surfaces, floating placement, icons, the shared `@/ui` components, and the full manifest reference. In the repo, `app/widgets/WIDGETS.md` sums all of it up on one page.
