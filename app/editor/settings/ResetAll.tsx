import { useState } from 'react'
import TEMPLATE_BASEMAPS from '../../templates/basic/basemaps.json'
import TEMPLATE_SETTINGS from '../../templates/basic/settings.json'
import TEMPLATE_THEME from '../../templates/basic/theme.json'
import { setAt } from '../edits/draftPaths'
import { useEditor, valueAt } from '../edits/editorContext'
import { Modal } from '../Modal'
import { Chevron, PanelButton } from '../panel/parts'

type Json = Record<string, unknown>

// what survives a reset, the project's name, its view and its layer work
const KEPT = [
  'connessVersion',
  'branding.title',
  'branding.logo',
  'branding.appId',
  'map.center',
  'map.zoom',
  'map.bearing',
  'map.pitch',
  'layerGroups',
  'ui.layerDefaults',
  'ui.popups',
]

// swapped in place, edit() hands over the draft's own object
function replaceWith(json: Json, template: unknown) {
  const schema = json.$schema
  for (const key of Object.keys(json)) delete json[key]
  Object.assign(json, structuredClone(template))
  if (schema !== undefined) json.$schema = schema
}

// changes the draft only, never layers
export function ResetAll() {
  const { files, edit, closePanel, refreshSoon } = useEditor()
  const [confirming, setConfirming] = useState(false)

  const reset = () => {
    const kept = KEPT.flatMap((path) => {
      const value = valueAt(files, `settings:${path}`)
      return value === undefined ? [] : [[path, structuredClone(value)] as const]
    })
    edit('settings', (json) => {
      replaceWith(json, TEMPLATE_SETTINGS)
      for (const [path, value] of kept) setAt(json, path, value)
    })
    edit('theme', (json) => replaceWith(json, TEMPLATE_THEME))
    edit('basemaps', (json) => replaceWith(json, TEMPLATE_BASEMAPS))
    refreshSoon()
    closePanel()
    setConfirming(false)
  }

  return (
    <details className="group/danger col-span-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-problem hover:text-white">
        <Chevron className="size-3.5 group-open/danger:rotate-90" />
        Danger
      </summary>
      <PanelButton kind="danger" onClick={() => setConfirming(true)} className="mx-auto mt-2 block max-w-[220px]">
        Reset all settings to default
      </PanelButton>
      <Modal
        open={confirming}
        title="Reset all settings to default?"
        submitLabel="Reset everything"
        danger
        onSubmit={reset}
        onClose={() => setConfirming(false)}
      >
        <p>
          <span className="font-medium text-ink">Resets</span> to what a new project starts with: every setting in the
          sidebar (layout, top bar and side rail, map controls, widgets and where they're placed, the right-click menu,
          the loading screen and the rest), the description, favicon and starting basemap, the theme and its colors, and
          the basemap list (back to the starter five).
        </p>
        <p className="mt-3">
          <span className="font-medium text-ink">Keeps</span> the project's title, logo and storage ID, its starting
          view (center, zoom, bearing and pitch), and everything about its layers: the layers and their symbology, their
          groups, Label defaults and Popup defaults.
        </p>
        <p className="mt-3">
          This only changes the draft. Press Save to make it permanent. Until then, reloading the page undoes it.
        </p>
      </Modal>
    </details>
  )
}
