import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { describe, getView, useColumns, useEditor, useLayerColumns, usePreviewAnswer, valueAt, type Files } from '../edits/editorContext'
import { InfoLabel } from '../settings/InfoTip'
import { controlFor, humanizeOption, schemaInfo, type Control } from '../settings/schemaInfo'
import {
  BoundsField,
  ColorPicker,
  LngLatField,
  MapColorField,
  MultiSelect,
  NumberField,
  NumberOrWord,
  ResetButton,
  ContentSelect,
  Select,
  Slider,
  Switch,
  TextField,
  TextListField,
} from './controls'
import { useWidgetList } from '../edits/placements'
import { FilePicker, type ExtraFile } from './FilePicker'
import { isPanel, labelFor, showsInfo, type Entry, type PanelEntry, type Section, type SettingEntry } from '../settings/settingsMap'
import { resolveThemeColors } from '@/core/theme/theme'
import type { ThemeSettings } from '@/core/types'

// the pieces every settings screen is built from


// a window with a panel sliding out to the right
function PanelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M10 2.5v11M4 8h3.5M6 6l2 2-2 2" />
    </svg>
  )
}

export function Chevron({ open = false, className = '' }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  )
}

// a theme color's default is the chosen preset's, not the schema's
function presetColor(files: Files, path: string): string | undefined {
  const preset = (files.theme as { preset?: ThemeSettings['preset'] } | undefined)?.preset
  return (resolveThemeColors({ preset }) as Record<string, string | undefined>)[path.slice('theme:colors.'.length)]
}

// a recorded default list, else "all …" means every option
function multiDefault(path: string, options: string[], files: Files): string[] {
  const { default: def, defaultText } = schemaInfo(path, files)
  if (Array.isArray(def)) return def as string[]
  return /^all\b/i.test(defaultText ?? '') ? options : []
}

type PickerProps = { value: unknown; onChange: (v: unknown) => void; labelledBy: string }

// writes the basemap's style, a style matching none shows as Custom style
function BasemapSelect({ value, onChange, labelledBy }: PickerProps) {
  const { files } = useEditor()
  const basemaps = (files.basemaps?.basemaps ?? []) as { id: string; name: string; style: unknown }[]
  const current = basemaps.find((b) => JSON.stringify(b.style) === JSON.stringify(value))
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={current?.id ?? (value === undefined ? undefined : '__custom')}
      options={basemaps.map((b) => ({ value: b.id, label: b.name }))}
      missingLabel={() => 'Custom style'}
      onChange={(id) => {
        const basemap = basemaps.find((b) => b.id === id)
        if (basemap) onChange(basemap.style)
      }}
    />
  )
}

// a bar's placed widgets, plus Closed (unset)
function PlacedWidgetSelect({ value, onChange, labelledBy, bar }: PickerProps & { bar: 'side' | 'top' }) {
  const { files } = useEditor()
  const labels = Object.fromEntries(useWidgetList().map((w) => [w.id, w.label]))
  const list = bar === 'side' ? files.settings.sidePanelWidgets : files.settings.topBarWidgets
  const placed = ((list ?? []) as { widgetName: string }[]).map((p) => p.widgetName)
  const CLOSED = '__closed'
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={typeof value === 'string' ? value : undefined}
      options={[{ value: CLOSED, label: 'Closed' }, ...placed.map((id) => ({ value: id, label: labels[id] ?? id }))]}
      fallback={CLOSED}
      missingLabel={(id) => `${labels[id] ?? id} (not in the ${bar === 'side' ? 'side panel' : 'top bar'})`}
      onChange={(id) => onChange(id === CLOSED ? undefined : id)}
    />
  )
}

// the project's GeoJSON layers by name (layer search only reads GeoJSON)
function LayerSelect({ value, onChange, labelledBy }: PickerProps) {
  const { files } = useEditor()
  const layers = ((files.layers?.layers ?? []) as { id: string; name?: string; type: string }[]).filter(
    (l) => l.type === 'geojson',
  )
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={typeof value === 'string' ? value : undefined}
      options={layers.map((l) => ({ value: l.id, label: l.name ?? l.id }))}
      missingLabel={(id) => `${id} (not a GeoJSON layer)`}
      onChange={onChange}
    />
  )
}

// written as a one-item list, a longer hand-written one stays read-only
function ColumnSelect({ path, value, onChange, labelledBy }: PickerProps & { path: string }) {
  const { files } = useEditor()
  const entry = path.replace(/\.(fields|labelField)$/, '')
  const layerId = valueAt(files, `${entry}.layerId`) as string | undefined
  const { loading, columns, error } = useColumns(layerId)
  const isList = path.endsWith('.fields')
  if (isList && Array.isArray(value) && value.length > 1) {
    return <span className="truncate text-fg-muted">{value.join(', ')} (edit in settings.json)</span>
  }
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={(isList ? (value as string[] | undefined)?.[0] : value) as string | undefined}
      options={columns.map((c) => ({ value: c, label: c }))}
      loading={loading}
      loadingText="Reading columns…"
      error={error}
      onChange={(c) => onChange(isList ? [c] : c)}
    />
  )
}

const CUSTOM_LABEL = '__custom-label'

// one of a layer's columns, typed when the preview can't read them
function LayerColumnSelect({ path, value, onChange, labelledBy }: PickerProps & { path: string }) {
  const { files } = useEditor()
  const [, i, j] = /^layers:layers\.(\d+)(?:\.sourceLayers\.(\d+))?\./.exec(path) ?? []
  const layer = ((files.layers?.layers ?? []) as { id: string; sourceLayers?: { sourceLayer: string }[] }[])[Number(i)]
  const { setValue, resetValue } = useEditor()
  const { loading, columns, error } = useLayerColumns(layer?.id, j === undefined ? undefined : layer?.sourceLayers?.[Number(j)]?.sourceLayer)
  // Custom Label (`text`) sits beside its column, one of the two is used
  const textPath = path.replace(/\.field$/, '.text')
  const isLabel = path.endsWith('.label.field')
  const custom = isLabel && valueAt(files, textPath) !== undefined
  const pick = (choice: string) => {
    if (choice === CUSTOM_LABEL) {
      setValue(textPath, typeof value === 'string' ? `{${value}}` : '')
      resetValue(path)
    } else {
      resetValue(textPath)
      onChange(choice)
    }
  }
  if (error && !custom) {
    return (
      <span title={`Couldn’t read the columns: ${error}`} className="w-full">
        <TextField labelledBy={labelledBy} value={typeof value === 'string' ? value : undefined} onChange={onChange} />
      </span>
    )
  }
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={custom ? CUSTOM_LABEL : typeof value === 'string' ? value : undefined}
      options={[...(isLabel ? [{ value: CUSTOM_LABEL, label: 'Custom Label' }] : []), ...columns.map((c) => ({ value: c, label: c }))]}
      loading={loading}
      loadingText="Reading columns…"
      onChange={pick}
    />
  )
}

// popups.tsx's templates, as the preview reports them
function PopupTemplateSelect({ value, onChange, labelledBy, fallback }: PickerProps & { fallback: unknown }) {
  const { loading, value: templates, error } = usePreviewAnswer<{ name: string; label: string }[]>('popup-templates', {})
  return (
    <ContentSelect
      labelledBy={labelledBy}
      value={typeof value === 'string' ? value : undefined}
      options={(templates ?? []).map((t) => ({ value: t.name, label: t.label }))}
      fallback={typeof fallback === 'string' ? fallback : undefined}
      missingLabel={(n) => `${n} (not in popups.tsx)`}
      loading={loading}
      loadingText="Reading templates…"
      error={error}
      onChange={onChange}
    />
  )
}

// the catalog's thumbnails, offered beside the project's own
const CATALOG_THUMBNAILS: ExtraFile[] = Object.entries(
  import.meta.glob<string>('../../widgets/basemap/assets/basemap-images/*.{jpg,jpeg,png,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
).map(([path, url]) => {
  const name = path.split('/').pop()!
  return { name, label: `${name} (catalog)`, url }
})

// empty names the image the app uses, named after the basemap's id
function ThumbnailPicker({ path, value, onChange, labelledBy }: PickerProps & { path: string }) {
  const { files } = useEditor()
  const id = valueAt(files, path.replace(/\.thumbnail$/, '.id')) as string | undefined
  const stem = (f: string) => f.replace(/\.[^.]+$/, '')
  return (
    <FilePicker
      labelledBy={labelledBy}
      folder="basemap-images"
      value={value}
      extra={CATALOG_THUMBNAILS}
      defaultFile={(own) => own.find((f) => stem(f) === id) ?? CATALOG_THUMBNAILS.find((t) => stem(t.name) === id)?.name}
      emptyLabel={(own) => {
        const used = own.find((f) => stem(f) === id) ?? CATALOG_THUMBNAILS.find((t) => stem(t.name) === id)?.name
        return used ? `${used} (default)` : 'None'
      }}
      onChange={onChange}
    />
  )
}

// fills center and zoom (or the bounds) from what the preview is showing
function UseCurrentView({ path, kind }: { path: string; kind: 'lnglat' | 'bounds' }) {
  const { setValue, resetValue } = useEditor()
  return (
    <button
      type="button"
      onClick={async () => {
        const view = await getView()
        if (!view) return
        if (kind === 'bounds') return setValue(path, view.bounds)
        setValue(path, view.center)
        setValue('settings:map.zoom', view.zoom)
        // 0 is the default, so it stays out of the file
        for (const key of ['bearing', 'pitch'] as const) {
          if (view[key]) setValue(`settings:map.${key}`, view[key])
          else resetValue(`settings:map.${key}`)
        }
      }}
      className={`mx-auto mt-1 block ${TEXT_LINK}`}
    >
      Use current view{kind === 'lnglat' ? ' (center, zoom, bearing, pitch)' : ''}
    </button>
  )
}

// settings without a control yet show their value as text
export function SettingRow({ entry }: { entry: SettingEntry }) {
  const { files, setValue, resetValue, problemsAt } = useEditor()
  const labelId = useId()
  const label = labelFor(entry)
  const control: Control = entry.presence ? { kind: 'switch' } : entry.list ? { kind: 'readonly' } : controlFor(entry.path, files)
  const value = valueAt(files, entry.path)
  const fallback =
    entry.fallbackValue !== undefined
      ? entry.fallbackValue
      : entry.path.startsWith('theme:colors.')
        ? presetColor(files, entry.path)
        : entry.fallbackFrom
        ? (valueAt(files, entry.fallbackFrom) ?? schemaInfo(entry.fallbackFrom, files).default)
        : schemaInfo(entry.path, files).default
  // a presence switch (Spin) turns a whole block on ({}) or removes it
  const turnsOn = (v: unknown) => v === true || (typeof v === 'object' && v !== null && (v as { mvt?: unknown }).mvt === true)
  const set = (v: unknown) => {
    entry.clears?.forEach(resetValue)
    if (entry.fills && turnsOn(v) && valueAt(files, entry.fills.path) === undefined) setValue(entry.fills.path, entry.fills.value)
    return entry.presence
      ? v
        ? setValue(entry.path, {})
        : resetValue(entry.path)
      : v === undefined
        ? resetValue(entry.path)
        : setValue(entry.path, v)
  }
  const problems = problemsAt(entry.path)
  const name = <InfoLabel id={labelId} path={entry.path} label={label} show={showsInfo(entry)} />
  const reset = value !== undefined && control.kind !== 'readonly' && (
    <ResetButton label={label} onClick={() => resetValue(entry.path)} />
  )
  const issues = problems.length > 0 && (
    <ul className="mt-1 space-y-0.5 text-[11px] text-problem">
      {problems.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  )

  if (control.kind === 'readonly') {
    const { text, isDefault } = describe(entry, files)
    return (
      <div data-reveal={entry.path}>
        <div className="flex items-center gap-1.5 text-[13px]">
          {name}
          <span
            title={text}
            className={`ml-auto max-w-[50%] shrink-0 truncate ${isDefault ? 'text-fg-subtle' : 'text-fg-muted'}`}
          >
            {text}
          </span>
        </div>
        {issues}
      </div>
    )
  }

  const by = { labelledBy: labelId }
  const labelOf = (o: string) => entry.optionLabels?.[o] ?? humanizeOption(o)
  // switches, numbers and sliders keep their width, the rest take up to 55%
  const fixed =
    control.kind === 'switch' ? (
      <Switch
        {...by}
        value={entry.presence ? value !== undefined : (value as boolean | undefined)}
        fallback={fallback as boolean | undefined}
        onChange={set}
      />
    ) : control.kind === 'number' ? (
      <NumberField
        {...by}
        value={value as number | undefined}
        fallback={fallback}
        onChange={set}
        min={control.min}
        max={control.max}
        step={control.step}
      />
    ) : control.kind === 'number-or-word' ? (
      <NumberOrWord {...by} value={value as number | string | undefined} fallback={fallback} words={control.words} onChange={set} />
    ) : control.kind === 'slider' ? (
      <Slider {...by} value={value as number | undefined} fallback={fallback} onChange={set} />
    ) : null
  const wide =
    control.kind === 'select' ? (
      <Select
        {...by}
        value={value as string | undefined}
        options={control.options}
        labelOf={labelOf}
        fallback={fallback}
        onChange={set}
      />
    ) : control.kind === 'text' ? (
      <TextField {...by} value={value as string | undefined} fallback={fallback as string | undefined} onChange={set} />
    ) : control.kind === 'multi' ? (
      <MultiSelect
        {...by}
        value={value as string[] | undefined}
        options={control.options}
        labelOf={labelOf}
        fallback={multiDefault(entry.path, control.options, files)}
        fallbackText={schemaInfo(entry.path, files).defaultText}
        onChange={set}
      />
    ) : control.kind === 'color' ? (
      <ColorPicker {...by} value={value as string | undefined} fallback={fallback} onChange={set} />
    ) : control.kind === 'lnglat' ? (
      <LngLatField {...by} value={value as [number, number] | undefined} onChange={set} />
    ) : control.kind === 'bounds' ? (
      <BoundsField {...by} value={value as [[number, number], [number, number]] | undefined} onChange={set} />
    ) : control.kind === 'basemap' ? (
      <BasemapSelect {...by} value={value} onChange={set} />
    ) : control.kind === 'side-widget' || control.kind === 'top-widget' ? (
      <PlacedWidgetSelect {...by} bar={control.kind === 'side-widget' ? 'side' : 'top'} value={value} onChange={set} />
    ) : control.kind === 'popup-template' ? (
      <PopupTemplateSelect {...by} value={value} fallback={fallback} onChange={set} />
    ) : control.kind === 'layer' ? (
      <LayerSelect {...by} value={value} onChange={set} />
    ) : control.kind === 'column' ? (
      <ColumnSelect {...by} path={entry.path} value={value} onChange={set} />
    ) : control.kind === 'text-list' ? (
      <TextListField
        {...by}
        value={value as string[] | undefined}
        fallback={fallback as string[] | undefined}
        onChange={set}
      />
    ) : control.kind === 'map-color' ? (
      <MapColorField {...by} value={value as string | undefined} fallback={fallback} onChange={set} />
    ) : control.kind === 'layer-column' ? (
      <LayerColumnSelect {...by} path={entry.path} value={value} onChange={set} />
    ) : control.kind === 'number-list' ? (
      <TextListField
        {...by}
        value={(value as number[] | undefined)?.map(String)}
        onChange={(v) => set(v?.map(Number).filter((n) => Number.isInteger(n)))}
      />
    ) : control.kind === 'duckdb' ? (
      <Select
        {...by}
        // off is the default, unset or false
        value={value === undefined || value === false ? undefined : typeof value === 'object' && (value as { mvt?: boolean }).mvt ? 'mvt' : 'on'}
        options={['off', 'on', 'mvt']}
        labelOf={(o) => ({ off: 'Off', on: 'On', mvt: 'On, as vector tiles' })[o] ?? o}
        fallback="off"
        onChange={(o) =>
          set(
            o === 'off'
              ? undefined
              : o === 'on'
                ? true
                : { ...(typeof value === 'object' && value ? value : {}), mvt: true },
          )
        }
      />
    ) : control.kind === 'thumbnail' ? (
      <ThumbnailPicker {...by} path={entry.path} value={value} onChange={set} />
    ) : control.kind === 'file' ? (
      <FilePicker {...by} folder={control.folder} asUrl value={value} onChange={set} />
    ) : control.kind === 'style' ? (
      typeof value === 'object' && value !== null ? (
        <span className="text-fg-muted">Inline style</span>
      ) : (
        <TextField {...by} value={value as string | undefined} onChange={set} />
      )
    ) : null

  return (
    <div data-reveal={entry.path} className="group/row">
      <ControlRow
        label={
          <>
            {name}
            {/* only a switch defaulting from elsewhere gets Reset, to follow it */}
            {(control.kind !== 'switch' || entry.fallbackFrom || entry.fallbackValue !== undefined) && reset}
          </>
        }
        wide={Boolean(wide)}
      >
        {wide ?? fixed}
      </ControlRow>
      {control.kind === 'bounds' && <UseCurrentView path={entry.path} kind="bounds" />}
      {/* under the last of the four camera rows it fills */}
      {entry.path === 'settings:map.pitch' && <UseCurrentView path="settings:map.center" kind="lnglat" />}
      {issues}
    </div>
  )
}

// in the sidebar it starts a new stack, in the pop-out it adds a sub-view
export function PanelLink({ entry, nested = false }: { entry: PanelEntry; nested?: boolean }) {
  const { panel, openPanel, pushPanel } = useEditor()
  const active = !nested && panel[0]?.panel === entry.panel
  return (
    <button
      type="button"
      data-panel-link
      data-reveal={`panel:${entry.panel}`}
      aria-expanded={nested ? undefined : active}
      onClick={() => (nested ? pushPanel(entry) : openPanel(entry))}
      className={`group/link -mx-2 flex w-[calc(100%+1rem)] items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-glacier-light ${
        active ? 'bg-larch/15 text-larch' : 'text-white hover:bg-field'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      <span className="text-[11px] font-normal opacity-0 transition-opacity group-hover/link:opacity-70">Open</span>
      <PanelIcon className={active ? 'text-larch' : 'text-fg-subtle'} />
    </button>
  )
}

export function EntryRow({ entry, nested }: { entry: Entry; nested?: boolean }) {
  return isPanel(entry) ? <PanelLink entry={entry} nested={nested} /> : <SettingRow entry={entry} />
}

// a plain label and value, `fallback` replaces Not set with the default
export function PlainRow({
  label,
  value,
  path,
  fallback,
}: {
  label: string
  value: unknown
  path?: string
  fallback?: string
}) {
  const text =
    value === undefined ? (fallback ?? 'Not set') : typeof value === 'object' && value !== null ? 'Custom' : String(value)
  return (
    <div className="flex items-center gap-2 text-[13px]">
      {path ? <InfoLabel path={path} label={label} /> : <span className="min-w-0 truncate">{label}</span>}
      <span title={text} className={`ml-auto max-w-[55%] truncate ${value === undefined ? 'text-fg-subtle' : 'text-fg-muted'}`}>
        {text}
      </span>
    </div>
  )
}

// a short explanation inside a section, or atop a pop-out (PanelNote)
export function Note({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`rounded bg-field px-2 py-1.5 text-[11px] leading-snug text-fg-subtle ${className}`}>{children}</p>
}

// no divider under it, the note belongs to the section below
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-b-0! px-4 pt-3 [&+*]:pt-3!">
      <Note>{children}</Note>
    </div>
  )
}

export const HEADING = 'text-[15px] font-semibold text-heading'

export function Subtitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className={HEADING}>
      {children}
    </h3>
  )
}

// a pop-out section's padding, the pop-out draws the dividers
export function Block({ children, gap, className = '' }: { children: ReactNode; gap?: 1 | 2; className?: string }) {
  const space = gap === 1 ? 'space-y-1' : gap === 2 ? 'space-y-2' : ''
  return <section className={`px-4 py-3 ${space} ${className}`}>{children}</section>
}

// a label and its control on one line, the control right-aligned
export function ControlRow({
  label,
  labelId,
  wide,
  children,
}: {
  label: ReactNode
  labelId?: string
  wide?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      {typeof label === 'string' ? (
        <span id={labelId} className="min-w-0 truncate">
          {label}
        </span>
      ) : (
        label
      )}
      {children && <span className={wide ? 'ml-auto flex w-[55%] shrink-0 justify-end' : 'ml-auto shrink-0'}>{children}</span>}
    </div>
  )
}

const PANEL_BUTTON = {
  secondary: 'border-line text-fg-muted hover:border-fg-subtle hover:text-fg',
  danger: 'border-line text-problem hover:border-problem',
  add: 'border-dashed border-line text-fg-muted hover:border-fg-subtle hover:text-fg',
}

// a full-width action button in a pop-out or the sidebar
export function PanelButton({
  kind,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind: keyof typeof PANEL_BUTTON }) {
  return (
    <button
      type="button"
      {...props}
      className={`w-full rounded-md border px-2 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-glacier-light disabled:cursor-not-allowed disabled:opacity-45 ${PANEL_BUTTON[kind]} ${className}`}
    />
  )
}

export function ProblemText({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] leading-snug text-problem">{children}</p>
}

// a screen whose item was removed while it was open
export function Gone({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 text-[13px] text-fg-subtle">{children}</p>
}

export const TEXT_LINK =
  'text-[11px] text-glacier-light underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-glacier-light'

function Advanced({ entries, nested, label = 'Advanced', note }: { entries: Entry[]; nested?: boolean; label?: string; note?: string }) {
  return (
    <details className="group/adv mt-2.5">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-fg-subtle hover:text-fg">
        <Chevron className="size-3.5 group-open/adv:rotate-90" />
        {label} ({entries.length})
      </summary>
      <div className="mt-2 space-y-2 border-l border-line pl-2.5">
        {note && <Note>{note}</Note>}
        {entries.map((e) => (
          <EntryRow key={'panel' in e ? e.panel : e.path} entry={e} nested={nested} />
        ))}
      </div>
    </details>
  )
}

// every size in `paths` 1 px bigger or smaller, from its value or its default
function ScaleButtons({ what, paths, className }: { what: string; paths: string[]; className: string }) {
  const { files, setValue, resetValue } = useEditor()
  const step = (by: number) => {
    for (const path of paths) {
      const now = (valueAt(files, path) ?? schemaInfo(path, files).default) as number | undefined
      if (typeof now === 'number') setValue(path, Math.max(1, now + by))
    }
  }
  const style =
    'flex-1 rounded-md border border-line px-2 py-1.5 text-[11px] text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-glacier-light'
  return (
    <div className={`flex gap-2 ${className}`}>
      <button type="button" className={style} onClick={() => step(-1)}>
        Make {what} smaller
      </button>
      <button type="button" className={style} onClick={() => step(1)}>
        Make {what} bigger
      </button>
      <button
        type="button"
        className={`${style} disabled:pointer-events-none disabled:opacity-40`}
        disabled={!paths.some((p) => valueAt(files, p) !== undefined)}
        onClick={() => paths.forEach(resetValue)}
      >
        Reset sizes
      </button>
    </div>
  )
}

// a setting whose parent is off is hidden, an unset parent uses its default
function isShown(entry: Entry | Section, files: Files): boolean {
  const dep = entry.dependsOn
  if (!dep) return true
  const fallback = dep.fallbackFrom ?? dep.path
  const value = valueAt(files, dep.path) ?? valueAt(files, fallback) ?? schemaInfo(fallback, files).default
  if (dep.empty) return !Array.isArray(value) || value.length === 0
  if (dep.not !== undefined) return value !== dep.not
  return dep.equals === undefined ? Boolean(value) : value === dep.equals
}

// `className` replaces the padding, to sit close under a custom row
export function PanelSection({ section, nested, className = 'py-3' }: { section: Section; nested?: boolean; className?: string }) {
  const { files, setValue } = useEditor()
  const titleId = useId()
  if (!isShown(section, files)) return null
  if (section.toggle) return <ToggleBlock section={section} nested={nested} />
  const head = section.switch
  const on = !head || Boolean(valueAt(files, head) ?? schemaInfo(head, files).default)
  const shown = on ? section.settings.filter((e) => isShown(e, files) && (isPanel(e) || e.path !== head)) : []
  const common = shown.filter((e) => !e.advanced)
  const advanced = shown.filter((e) => e.advanced)
  return (
    <section data-reveal={section.name && `section:${section.name}`} className={`px-4 ${className}`}>
      {section.name &&
        (head ? (
          <div className="flex items-center justify-between">
            <Subtitle id={titleId}>{section.name}</Subtitle>
            <Switch labelledBy={titleId} value={on} onChange={(v) => setValue(head, v)} />
          </div>
        ) : (
          <Subtitle>{section.name}</Subtitle>
        ))}
      {section.scale && <ScaleButtons {...section.scale} className={shown.length ? 'mb-3' : ''} />}
      {section.note && (
        <Note className="mt-2">{section.note}</Note>
      )}
      {/* rows under a header sit one step in, so they read as its own */}
      {on && (
        <div className={section.name ? 'pl-2' : ''}>
          <div className={`space-y-2 ${section.name || section.note ? 'mt-2' : ''}`}>
            {common.map((e) => (
              <EntryRow key={'panel' in e ? e.panel : e.path} entry={e} nested={nested} />
            ))}
          </div>
          {advanced.length > 0 && (
            <Advanced entries={advanced} nested={nested} label={section.advancedLabel} note={section.advancedNote} />
          )}
        </div>
      )}
      {section.blocks && (
        <div className="mt-2 space-y-4">
          {section.blocks.map((block) => (
            <ToggleBlock key={block.toggle} section={block} nested={nested} inner />
          ))}
        </div>
      )}
    </section>
  )
}

// on while its key exists. on writes {} so its defaults apply, off
// removes it with its options
export function ToggleBlock({ section, nested, inner }: { section: Section; nested?: boolean; inner?: boolean }) {
  const { files, setValue, resetValue } = useEditor()
  const titleId = useId()
  const toggle = section.toggle!
  const on = valueAt(files, toggle) !== undefined
  const shown = section.settings.filter((e) => isShown(e, files))
  return (
    <section data-reveal={`section:${section.name}`} className={inner ? '' : 'px-4 py-3'}>
      <div className="flex items-center justify-between">
        {inner ? (
          <h4 id={titleId} className={HEADING}>
            {section.name}
          </h4>
        ) : (
          <h3 id={titleId} className={HEADING}>
            {section.name}
          </h3>
        )}
        <Switch labelledBy={titleId} value={on} onChange={(v) => (v ? setValue(toggle, {}) : resetValue(toggle))} />
      </div>
      {on && (
        <div className="pl-2">
          <div className="mt-2 space-y-2">
            {shown
              .filter((e) => !e.advanced)
              .map((e) => (
                <EntryRow key={'panel' in e ? e.panel : e.path} entry={e} nested={nested} />
              ))}
          </div>
          {shown.some((e) => e.advanced) && <Advanced entries={shown.filter((e) => e.advanced)} nested={nested} />}
        </div>
      )}
    </section>
  )
}

// a reorderable list row. Remove lives on the item's own screen
export function ListItem({
  title,
  detail,
  onClick,
  handle,
  lifted = false,
  icon,
  strong = false,
}: {
  title: string
  detail?: string
  onClick?: () => void
  handle?: ButtonHTMLAttributes<HTMLButtonElement>
  lifted?: boolean
  icon?: ReactNode
  strong?: boolean
}) {
  const text = (
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-[13px] text-fg ${strong ? 'font-semibold' : 'font-medium'}`}>{title}</span>
      {detail && <span className="block truncate text-[11px] text-fg-subtle">{detail}</span>}
    </span>
  )
  return (
    <div
      className={`flex items-center hover:bg-field ${lifted ? 'relative z-10 bg-surface-raised shadow-[0_6px_18px_-6px_rgb(0_0_0/0.6)]' : ''}`}
    >
      {handle ? (
        <button
          type="button"
          {...handle}
          className="cursor-grab touch-none self-stretch pl-3 text-[13px] text-fg-faint select-none hover:text-fg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-glacier-light active:cursor-grabbing"
        >
          ⋮⋮
        </button>
      ) : (
        <span className="pl-3" />
      )}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-4 pl-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-glacier-light"
        >
          {icon}
          {text}
          <Chevron className="text-fg-subtle" />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-4 pl-2">
          {icon}
          {text}
        </div>
      )}
    </div>
  )
}
