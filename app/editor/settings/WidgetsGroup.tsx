import { useId } from 'react'
import { useEditor } from '../edits/editorContext'
import { Select, Switch } from '../panel/controls'
import { move, sectionTarget } from '../edits/listEdits'
import { ControlRow, HEADING, PanelLink, PanelNote, PanelSection, ProblemText, SettingRow } from '../panel/parts'
import { SortableList } from '../panel/SortableList'
import { moveTo, setOnMobile, turnOff, turnOn, whereOf, wheresFor } from '../edits/placementEdits'
import { placementLists, useWidgetList, type WidgetInfo } from '../edits/placements'
import { humanizeOption } from './schemaInfo'
import { SETTINGS_MAP, isPanel, type PanelEntry, type Section, type SettingEntry } from './settingsMap'
import { WIDGET_SECTIONS } from './widgetSchemas'

type Settings = Parameters<typeof placementLists>[0]

const widgetsGroupSections = () => SETTINGS_MAP.find((g) => g.name === 'Widgets')!.sections

// a widget can't be dragged out of Mobile, its block's switch removes it
const PLACES = [
  { key: 'topBarWidgets', title: 'Top bar', surface: 'top-bar' },
  { key: 'sidePanelWidgets', title: 'Side rail', surface: 'side-panel' },
  { key: 'mobileWidgets', title: 'Mobile', surface: null },
] as const

export function PlacementLists() {
  const { files, edit } = useEditor()
  const widgets = useWidgetList()
  const labels = Object.fromEntries(widgets.map((w) => [w.id, w.label]))
  const settings = files.settings as Settings
  const ids = (key: (typeof PLACES)[number]['key']) =>
    key === 'mobileWidgets' ? (settings.mobileWidgets ?? []) : (settings[key] ?? []).map((p) => p.widgetName)
  const rows = PLACES.flatMap((place) => [
    { key: `header:${place.key}`, title: place.title, header: true as const },
    ...ids(place.key).map((id, i) => ({ key: `${place.key}:${i}:${id}`, title: labels[id] ?? id })),
  ])
  const headers = rows.map((r) => 'header' in r)
  const onMove = (from: number, to: number) => {
    const source = sectionTarget(headers, from, from)
    const target = sectionTarget(headers, from, to)
    if (!source || !target) return
    const fromPlace = PLACES[source.section]
    const toPlace = PLACES[target.section]
    const id = ids(fromPlace.key)[source.index]
    edit('settings', (json) => {
      const s = json as Settings
      if (fromPlace.key === toPlace.key) {
        const list = (fromPlace.key === 'mobileWidgets' ? s.mobileWidgets : s[fromPlace.key]) as unknown[]
        return move(list, source.index, target.index)
      }
      if (fromPlace.key === 'mobileWidgets') return
      if (toPlace.key === 'mobileWidgets') {
        const mobile = s.mobileWidgets ?? []
        if (!mobile.includes(id)) s.mobileWidgets = [...mobile.slice(0, target.index), id, ...mobile.slice(target.index)]
        return
      }
      if (!widgets.find((w) => w.id === id)?.surfaces.includes(toPlace.surface)) return
      moveTo(s, id, toPlace.surface)
      const list = s[toPlace.key] ?? []
      move(list, list.length - 1, target.index)
    })
  }
  return (
    <>
      <PanelNote>
        Drag to reorder, or between the top bar and side rail to move a widget there (if it can go there). Drag one into
        Mobile to add it to the mobile carousel too. Floating widgets share the map&apos;s corners with the map controls,
        so they&apos;re arranged in Map Controls → Arrange corners.
      </PanelNote>
      <SortableList rows={rows} onMove={onMove} />
    </>
  )
}

// one block per widget, placed or not
const WHERE_LABELS: Record<string, string> = { 'top-bar': 'Top bar', 'side-panel': 'Side panel' }
const whereLabel = (where: string) =>
  WHERE_LABELS[where] ?? `${humanizeOption(where.replace('floating:', ''))} corner`

// its own settings show only while it's on
function WidgetBlock({ widget, own }: { widget: WidgetInfo; own?: Section }) {
  const { files, edit } = useEditor()
  const id = useId()
  const settings = files.settings as Settings
  const where = whereOf(settings, widget.id)
  const mobile = (settings.mobileWidgets ?? []).includes(widget.id)
  const hidden = ((files.settings.ui as { hideWidgetInfo?: string[] } | undefined)?.hideWidgetInfo ?? []).includes(
    widget.id,
  )
  const setInfoShown = (show: boolean) =>
    edit('settings', (json) => {
      const ui = (json.ui ??= {}) as { hideWidgetInfo?: string[] }
      const next = (ui.hideWidgetInfo ?? []).filter((w) => w !== widget.id)
      if (!show) next.push(widget.id)
      if (next.length) ui.hideWidgetInfo = next
      else delete ui.hideWidgetInfo
      if (Object.keys(ui).length === 0) delete json.ui
    })
  const on = where !== null || mobile
  // its desktop placement, where its options are written
  const param = placementLists(settings)
    .filter((l) => l.title !== 'Mobile')
    .flatMap((l) => l.items)
    .find((i) => i.id === widget.id)?.param
  const floating = where?.startsWith('floating:') ?? false
  // title and divider follow Widget Headers until set here
  const placementPath = param
    ? param.startsWith('floatingWidgets')
      ? `floatingWidgets.${param.split('|')[1]}.widgets.${param.split('|')[2]}`
      : `${param.split('|')[0]}.${param.split('|')[2]}`
    : null
  // a chromeless widget draws no header, so it has no title to set
  const headerEntries: SettingEntry[] = placementPath && !widget.defaults?.chromeless
    ? (['showTitle', 'showDivider'] as const).map((key) => ({
        path: `settings:${placementPath}.header.${key}`,
        label: key === 'showTitle' ? 'Show title' : 'Show divider',
        advanced: true,
        fallbackFrom: `settings:ui.widgetHeader.${key}`,
      }))
    : []
  // only the options that apply where it is, defaulting to its manifest
  const slot = floating ? settings.floatingWidgets?.find((s) => `floating:${s.slot}` === where) : undefined
  const cornerOpens = (slot as { direction?: string } | undefined)?.direction === 'horizontal' ? 'vertically' : 'sideways'
  const placementEntries: SettingEntry[] = placementPath
    ? [
        ...(where === 'side-panel'
          ? []
          : [{ path: `settings:${placementPath}.panelWidth`, label: 'Panel width', fallbackValue: widget.defaults?.panelWidth ?? 320 }]),
        ...(floating
          ? [
              { path: `settings:${placementPath}.opens`, label: 'Opens', fallbackValue: widget.defaults?.opens ?? cornerOpens },
              ...(widget.defaults?.alwaysOnMap
                ? []
                : [
                    {
                      path: `settings:${placementPath}.stayOnMobile`,
                      label: 'Stay on mobile',
                      fallbackValue: widget.defaults?.stayOnMobile ?? false,
                    },
                  ]),
            ]
          : []),
      ]
    : []
  const ownWithHeader: Section = { ...own, name: undefined, settings: [...(own?.settings ?? []), ...headerEntries] }
  // a widget on a bar that's turned off doesn't show on desktop
  const layout = (files.settings.ui as { layout?: { showTopBar?: boolean; showSideRail?: boolean } } | undefined)?.layout
  const hiddenBar =
    where === 'top-bar' && layout?.showTopBar === false
      ? 'top bar'
      : where === 'side-panel' && layout?.showSideRail === false
        ? 'side rail'
        : null
  const change = (fn: (s: Settings) => void) => edit('settings', (json) => fn(json as Settings))

  return (
    <section data-reveal={own ? `section:${own.name}` : undefined} className="px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 id={`${id}-on`} className={HEADING}>
          {widget.label}
        </h3>
        <Switch
          labelledBy={`${id}-on`}
          value={on}
          onChange={(v) => change((s) => (v ? turnOn(s, widget.id, widget.surfaces) : turnOff(s, widget.id)))}
        />
      </div>
      {/* its settings sit one step in, under the widget's name */}
      {on && (
        <div className="pl-2">
          <div className="mt-2 space-y-2 text-[13px]">
            <ControlRow label="Where" labelId={`${id}-where`} wide>
              <Select
                labelledBy={`${id}-where`}
                value={where ?? undefined}
                options={wheresFor(widget.surfaces)}
                labelOf={whereLabel}
                onChange={(next) => change((s) => moveTo(s, widget.id, next))}
              />
            </ControlRow>
            {hiddenBar && (
              <ProblemText>
                Hidden on desktop: the {hiddenBar} is turned off (Layout → {hiddenBar === 'top bar' ? 'Top Bar' : 'Side Rail'}). Move it, or turn the {hiddenBar}{' '}
                back on.
              </ProblemText>
            )}
            <ControlRow label="On mobile" labelId={`${id}-mobile`}>
              <Switch labelledBy={`${id}-mobile`} value={mobile} onChange={(v) => change((s) => setOnMobile(s, widget.id, v))} />
            </ControlRow>
            {widget.hasInfo && (
              <ControlRow label="Show info section" labelId={`${id}-info`}>
                <Switch labelledBy={`${id}-info`} value={!hidden} onChange={setInfoShown} />
              </ControlRow>
            )}
            {placementEntries.map((entry) => (
              <SettingRow key={entry.path} entry={entry} />
            ))}
          </div>
          {ownWithHeader.settings.length > 0 && (
            // cancels the nested section's own padding inside this block
            <div className="-mx-4 -mt-1 -mb-3">
              <PanelSection section={ownWithHeader} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function WidgetsGroup() {
  const widgets = useWidgetList()
  const sections = widgetsGroupSections()
  // built from its settings.ts, plus anything the map adds for it
  const ownFor = (id: string): Section | undefined => {
    const generated = WIDGET_SECTIONS.find((s) => s.widget === id)
    const extra = sections.find((s) => s.widget === id)
    if (!generated && !extra) return undefined
    return { name: generated?.name, widget: id, settings: [...(generated?.settings ?? []), ...(extra?.settings ?? [])] }
  }
  const order = sections.flatMap((s) => s.settings).find((e): e is PanelEntry => isPanel(e) && e.panel === 'placement-order')!
  const headers = sections.find((s) => s.name === 'Widget Headers')!

  return (
    <>
      <section className="px-4 py-3">
        <PanelLink entry={order} />
      </section>
      {widgets.map((widget) => (
        <WidgetBlock key={widget.id} widget={widget} own={ownFor(widget.id)} />
      ))}
      <PanelSection section={headers} />
    </>
  )
}
