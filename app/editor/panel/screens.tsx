import { useEffect, useRef, useState } from 'react'
import { DEFAULT_DEM_SOURCE } from '@/core/map/terrain'
import { api, cleanFileName } from '../project/api'
import { checkSource } from '../project/checkSource'
import { removeAt } from '../edits/draftPaths'
import { useColumns, useEditor, useLayerColumns, usePreviewAnswer, valueAt } from '../edits/editorContext'
import {
  flatRows,
  freeSlug,
  guessKind,
  LAYER_KINDS,
  landing,
  layerItems,
  move,
  moveRow,
  newLayer,
  placeEmptyGroups,
  renameGroup,
  sectionTarget,
  setCornerOrder,
  simpleFields,
  ungroup,
  unusedColor,
  type GroupMap,
} from '../edits/listEdits'
import { Modal, modalInput } from '../Modal'
import { Checklist, ChooseDialog } from '../project/Checklist'
import CATALOG from '../../widgets/basemap/catalog.json'
import { fieldsAt, schemaInfo } from '../settings/schemaInfo'
import { cornerLists, useWidgetList, type CornerItem } from '../edits/placements'
import { moveTo } from '../edits/placementEdits'
import { SETTINGS_MAP, type PanelEntry } from '../settings/settingsMap'
import { PlacementLists } from '../settings/WidgetsGroup'
import { InlineButton, MapColorField, Select, Switch, TextField } from './controls'
import { FilePicker } from './FilePicker'
import { InfoLabel } from '../settings/InfoTip'
import { Block, ControlRow, Gone, PanelButton, PanelLink, PanelNote, PanelSection, PlainRow, ProblemText, TEXT_LINK } from './parts'
import type { Entry } from '../settings/settingsMap'
import { SortableList } from './SortableList'
import { button } from '../ui'

// screens that show lists from the project rather than mapped settings

type Layer = Record<string, unknown> & { id: string; name?: string; type: string; group?: string }

function useLayers(): Layer[] {
  return (useEditor().files.layers?.layers ?? []) as Layer[]
}

const layerEntry = (layer: Layer): PanelEntry => ({
  panel: `layer:${layer.id}`,
  label: layer.name ?? layer.id,
  screen: 'layer',
  param: layer.id,
  sections: [],
})
const groupEntry = (name: string): PanelEntry => ({ panel: `layer-group:${name}`, label: name, screen: 'layer-group', param: name, sections: [] })

function useGroups(): GroupMap {
  return (useEditor().files.settings?.layerGroups ?? {}) as GroupMap
}

// layers and layerGroups together, on copies, so the draft's updaters
// only assign. empty groups keep their place
function useLayerEdit() {
  const { files, edit } = useEditor()
  return (change: (layers: Layer[], groups: GroupMap) => void, mode: 'keep' | 'drop' | 'placed' = 'keep') => {
    const layers = structuredClone((files.layers?.layers ?? []) as Layer[])
    const was = (files.settings?.layerGroups ?? {}) as GroupMap
    const groups = structuredClone(was)
    const before = layerItems(layers, groups)
    change(layers, groups)
    if (mode !== 'placed') placeEmptyGroups(before, layers, groups, mode === 'keep')
    edit('layers', (json) => void (json.layers = layers))
    if (JSON.stringify(groups) === JSON.stringify(was)) return
    edit('settings', (json) => {
      if (Object.keys(groups).length > 0) json.layerGroups = groups
      else delete json.layerGroups
    })
  }
}

// settings.json's per-group settings (layerGroups), created when missing
function groupsIn(json: Json): Record<string, Json> {
  return (json.layerGroups ??= {}) as Record<string, Json>
}

// the list order is the draw order, top drawn on top
function LayersScreen() {
  const layers = useLayers()
  const groups = useGroups()
  const editLayers = useLayerEdit()
  const { pushPanel } = useEditor()
  const [adding, setAdding] = useState(false)
  const [naming, setNaming] = useState(false)
  const items = layerItems(layers, groups)
  const rows = flatRows(items)
  const byId = new Map(layers.map((l) => [l.id, l]))
  return (
    <>
      <Block>
        <div className="grid grid-cols-2 gap-2">
          <PanelButton kind="add" onClick={() => setAdding(true)}>
            + Add layer
          </PanelButton>
          <PanelButton kind="add" onClick={() => setNaming(true)}>
            + New group
          </PanelButton>
        </div>
      </Block>
      <PanelNote>
        Drag to change the order in the layer list and on the map: the top one is drawn on top. Drag a layer under a group
        to put it in, or out of it to take it out.
      </PanelNote>
      <SortableList
        rows={rows.map((row) =>
          row.kind === 'slot'
            ? { key: `slot:${row.group}`, title: 'Drag layers here', slot: true as const, groupKey: row.group }
            : row.kind === 'group'
            ? {
                key: `group:${row.name}`,
                title: row.name,
                detail: row.count ? `${row.count} ${row.count === 1 ? 'layer' : 'layers'}` : 'Empty',
                span: row.span,
                group: true as const,
                groupKey: row.name,
                onClick: () => pushPanel(groupEntry(row.name)),
              }
            : {
                key: row.id,
                title: byId.get(row.id)?.name ?? row.id,
                detail: byId.get(row.id)?.type,
                indent: row.group ? (true as const) : undefined,
                groupKey: row.group,
                onClick: () => pushPanel(layerEntry(byId.get(row.id)!)),
              },
        )}
        landing={(from, to, out) => {
          const { group } = landing(rows, from, to, out)
          return { indent: !!group, group }
        }}
        onMove={(from, to, out) => editLayers((list, g) => moveRow(list, g, from, to, out), 'placed')}
      />
      <AddLayerDialog open={adding} onAdded={(layer) => pushPanel(layerEntry(layer))} onClose={() => setAdding(false)} />
      <NameDialog
        key={`new-${naming}`}
        open={naming}
        title="New group"
        taken={items.flatMap((i) => (i.kind === 'group' ? [i.name] : []))}
        onName={(name) => editLayers((_, g) => void (g[name] = { position: 0 }))}
        onClose={() => setNaming(false)}
      />
    </>
  )
}

// the kind is guessed from the file name or URL, the layer goes on top
function AddLayerDialog({ open, onAdded, onClose }: { open: boolean; onAdded: (layer: Layer) => void; onClose: () => void }) {
  const { project } = useEditor()
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const [name, setName] = useState('')
  const [fromUrl, setFromUrl] = useState(false)
  const [file, setFile] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState('')
  const [files, setFiles] = useState<string[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // a URL that failed its check, the next Add adds it anyway
  const [warning, setWarning] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const at = `/${encodeURIComponent(project)}/folder/layers`

  useEffect(() => {
    if (open) api<{ files: string[] }>(at).then((list) => setFiles(list.files), (err: Error) => setError(err.message))
  }, [open, at])

  const close = () => {
    setName('')
    setFromUrl(false)
    setFile('')
    setUrl('')
    setKind('')
    setError(null)
    setWarning(null)
    onClose()
  }
  // a file or URL guesses the kind, and fills an empty name from the file
  const pickFile = (next: string) => {
    setFile(next)
    setKind(guessKind(next))
    if (!name.trim()) setName(next.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  }

  async function upload(chosen: File | undefined) {
    if (!chosen) return
    const cleaned = cleanFileName(chosen.name)
    setUploading(true)
    setError(null)
    try {
      await api(`${at}?name=${encodeURIComponent(cleaned)}`, 'POST', chosen)
      setFiles((list) => [...(list ?? []), cleaned].sort((a, b) => a.localeCompare(b)))
      pickFile(cleaned)
    } catch (err) {
      setError(
        (err as { status?: number }).status === 409
          ? `layers/${cleaned} already exists. Pick it from the list, or rename your file and upload it again.`
          : (err instanceof Error ? err.message : String(err)).replace(/^\[conness-gis\] /, ''),
      )
    } finally {
      setUploading(false)
    }
  }

  const fileKinds = ['geojson', 'pmtiles', 'pmtiles-raster', 'flatgeobuf', 'geoparquet']
  return (
    <Modal
      open={open}
      title="Add layer"
      submitLabel={checking ? 'Checking…' : warning ? 'Add anyway' : 'Add'}
      error={error}
      onClose={close}
      onSubmit={async () => {
        if (checking) return
        const source = fromUrl ? url.trim() : file && `./layers/${file}`
        if (!name.trim()) return setError('Name is required.')
        if (!source) return setError(fromUrl ? 'Enter the URL.' : 'Pick or upload a file.')
        if (!kind) return setError('Choose what kind of data it is.')
        setError(null)
        let checkedKind = kind
        let checkedSource = source
        if (fromUrl && !warning) {
          setChecking(true)
          const check = await checkSource(kind, source)
          setChecking(false)
          if (!check.ok) return setWarning(check.why)
          // the service's own description knows better than the URL's shape
          if (check.kind) checkedKind = check.kind
          if (check.url) checkedSource = check.url
        }
        const layer = newLayer(checkedKind, name.trim(), checkedSource, layers) as Layer
        editLayers((list) => void list.unshift(layer))
        onAdded(layer)
        close()
      }}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="font-medium text-ink">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={modalInput} />
          <span className="mt-1.5 block">Shown in the layer list and legend.</span>
        </label>
        <div className="flex items-center justify-between gap-3">
          <span id="layer-from-url" className="font-medium text-ink">
            From a URL
          </span>
          <Switch
            labelledBy="layer-from-url"
            value={fromUrl}
            onChange={(next) => {
              setFromUrl(next)
              setKind(next ? guessKind(url) : file && guessKind(file))
            }}
            onLight
          />
        </div>
        {fromUrl ? (
          <label className="block">
            <span className="font-medium text-ink">URL</span>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setKind(guessKind(e.target.value))
                setWarning(null)
              }}
              className={modalInput}
            />
            <span className="mt-1.5 block">A file on the web, a tile server (TileJSON or {'{z}/{x}/{y}'}), or an Esri service.</span>
          </label>
        ) : (
          <div>
            <span id="layer-file" className="font-medium text-ink">
              File in layers/
            </span>
            <div className="flex gap-2">
              <select
                aria-labelledby="layer-file"
                value={file}
                onChange={(e) => pickFile(e.target.value)}
                className={`${modalInput} min-w-0 flex-1`}
              >
                <option value="" disabled>
                  {files === null ? 'Reading…' : files.length === 0 ? 'No files yet' : 'Choose…'}
                </option>
                {files?.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`${button.quiet} mt-1.5`}
                disabled={uploading}
                onClick={() => input.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input
                ref={input}
                type="file"
                hidden
                accept=".geojson,.json,.pmtiles,.fgb,.parquet"
                onChange={(e) => {
                  upload(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
            <span className="mt-1.5 block">Upload copies the file into the project right away. Only files a layer uses go into a build.</span>
          </div>
        )}
        <label className="block">
          <span className="font-medium text-ink">Kind</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value)
              setWarning(null)
            }}
            className={modalInput}
          >
            <option value="" disabled>
              Choose…
            </option>
            {(fromUrl ? Object.keys(LAYER_KINDS) : fileKinds).map((k) => (
              <option key={k} value={k}>
                {LAYER_KINDS[k].label}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block">Guessed from the {fromUrl ? 'URL' : 'file name'}. Change it if it&apos;s wrong.</span>
        </label>
        {warning && (
          <p role="alert" className="rounded-md bg-alarm/8 px-3 py-2 text-alarm">
            Couldn&apos;t check this URL: {warning}. Add anyway if you know it works from your hosted site.
          </p>
        )}
      </div>
    </Modal>
  )
}

// a layer's fields shown above its list, or on their own screens
const LAYER_OWN = new Set(['id', 'name', 'group', 'type', 'raster', 'service', 'url', 'symbology', 'label', 'popup', 'filters', 'legend', 'hideFromLegend', 'sourceLayers', 'collapsed', 'actions'])
// in this order, every other field goes under Advanced, these first
const LAYER_SHOWN = ['geometryType', 'visible', 'minZoom', 'maxZoom', 'where', 'layers', 'esriOpacity', 'rasterOpacity', 'tileSize', 'limit', 'mvt']
const ADVANCED_FIRST = ['duckdb']
const LAYER_LABELS: Record<string, string> = {
  geometryType: 'Geometry type',
  visible: 'Visible at start',
  minZoom: 'Min zoom',
  maxZoom: 'Max zoom',
  layers: 'Sublayers',
  esriOpacity: 'Opacity',
  rasterOpacity: 'Opacity',
  limit: 'Feature limit',
  mvt: 'Vector tiles',
  duckdb: 'DuckDB',
  bbox: 'Loading',
  minTileZoom: 'Min tile zoom',
  maxTileZoom: 'Max tile zoom',
  maxTileFeatures: 'Max features per tile',
}
const MENU_ACTIONS: [string, string][] = [
  ['opacity', 'Transparency'],
  ['labels', 'Labels'],
  ['zoomToExtent', 'Zoom to extent'],
  ['filter', 'Filter'],
  ['export', 'Export'],
  ['visibilityZoom', 'Zoom range'],
]
const FILE_KINDS = ['geojson', 'pmtiles', 'flatgeobuf', 'geoparquet']

// `top` is what most layers need, `general` is the rest
function useLayerRows(id: string) {
  const { files } = useEditor()
  const layers = useLayers()
  const index = layers.findIndex((l) => l.id === id)
  const layer = layers[index]
  if (!layer) return null
  const at = `layers:layers.${index}`
  const fields = fieldsAt(at, files).filter((k) => !LAYER_OWN.has(k))
  const order = [...LAYER_SHOWN, ...ADVANCED_FIRST]
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length)
  const rows: Entry[] = [
    ...fields
      .sort((a, b) => rank(a) - rank(b))
      .flatMap((key): Entry[] => [
        {
          path: `${at}.${key}`,
          ...(LAYER_LABELS[key] ? { label: LAYER_LABELS[key] } : {}),
          ...(LAYER_SHOWN.includes(key) ? {} : { advanced: true }),
          // GeoParquet's tile limits only matter when it draws vector tiles
          ...(layer.type === 'geoparquet' && (key === 'maxTileFeatures' || key === 'maxTileZoom')
            ? { dependsOn: { path: `${at}.mvt`, equals: true } }
            : {}),
          // vector tiles start at zoom 10, so turning them on writes it
          ...(key === 'mvt' || key === 'duckdb' ? { fills: { path: `${at}.minZoom`, value: 10 } } : {}),
        },
        // DuckDB's own tile limits, right under it, once it draws vector tiles
        ...(key === 'duckdb'
          ? (['maxTileFeatures', 'maxTileZoom'] as const).map((sub) => ({
              path: `${at}.duckdb.${sub}`,
              label: `DuckDB ${LAYER_LABELS[sub].toLowerCase()}`,
              advanced: true as const,
              dependsOn: { path: `${at}.duckdb.mvt`, equals: true },
            }))
          : []),
      ]),
    ...(fieldsAt(at, files).includes('actions')
      ? MENU_ACTIONS.map(([key, label]) => ({
          path: `${at}.actions.${key}`,
          label: `Layer List: ${label}`,
          advanced: true as const,
          fallbackFrom: `settings:widgets.layer-list.actions.${key}`,
        }))
      : []),
  ]
  const isTop = (e: Entry) => 'path' in e && (e.path === `${at}.geometryType` || e.path === `${at}.visible`)
  return { layer, at, files, top: rows.filter(isTop), general: rows.filter((e) => !isTop(e)) }
}

function LayerScreen({ id }: { id: string }) {
  const found = useLayerRows(id)
  const layer = found?.layer
  const vectorTiles = (layer?.type === 'pmtiles' || layer?.type === 'tiles') && layer?.raster !== true
  const tiles = useTileSourceLayers(vectorTiles ? layer : undefined)
  if (!found || !layer) return <Gone>This layer is no longer in layers.json.</Gone>
  const { at, files, top } = found
  const name = layer.name ?? id
  const fields = fieldsAt(at, files)
  const drawn = tiles.list.length
  // a layer drawing several source layers has no one geometry
  const shown = drawn > 1 ? top.filter((e) => !('path' in e && e.path === `${at}.geometryType`)) : top
  const link = (screen: PanelEntry['screen'], label: string) => (
    <PanelLink nested entry={{ panel: `${screen}:${id}`, label, title: `${label} – ${name}`, screen, param: id, sections: [] }} />
  )
  return (
    <>
      {/* one section, Source belongs with the rows under it */}
      <div>
        <Block className="pb-0">
          <SourceRow key={layer.id} path={`${at}.url`} layer={layer} />
        </Block>
        <PanelSection nested className="pt-2 pb-3" section={{ settings: [{ path: `${at}.name`, label: 'Name' }, ...shown] }} />
      </div>
      <Block gap={1}>
        {link('layer-general', 'General')}
        {vectorTiles && (tiles.count > 1 || drawn !== 1) && link('source-layers', 'Source layers')}
        {vectorTiles ? (
          <>
            {drawn === 1 && <StyleLinks layerId={id} name={name} source={0} fields={['symbology']} />}
            <StyleLinks layerId={id} name={name} fields={['label', 'popup']} defaults={drawn !== 1} />
          </>
        ) : (
          <StyleLinks layerId={id} name={name} fields={fields} esriRaster={layer.type === 'esri' && layer.service !== 'feature'} />
        )}
        {fields.includes('filters') && link('layer-filters', 'Filters')}
      </Block>
      <RemoveLayer layer={layer} />
    </>
  )
}

// the layer's group, zooms and the advanced settings
function LayerGeneralScreen({ id }: { id: string }) {
  const found = useLayerRows(id)
  const { list } = useSourceLayers(id)
  if (!found) return <Gone>This layer is no longer in layers.json.</Gone>
  const collapsed: Entry[] = list.length > 1 ? [{ path: `${found.at}.collapsed`, label: 'Start collapsed' }] : []
  return (
    // one section, Group belongs with the rows under it
    <div>
      <Block className="pb-0">
        <GroupRow layer={found.layer} />
      </Block>
      <PanelSection nested className="pt-2 pb-3" section={{ settings: [...collapsed, ...found.general] }} />
    </div>
  )
}

const isUrl = (source: string) => /^[a-z]+:\/\//i.test(source) || source.startsWith('//')

// the switch writes nothing until a file is picked or a URL typed
function SourceRow({ path, layer }: { path: string; layer: Layer }) {
  const { setValue, problemsAt } = useEditor()
  const url = typeof layer.url === 'string' ? layer.url : ''
  const fileKind = FILE_KINDS.includes(layer.type)
  const [asUrl, setAsUrl] = useState(!fileKind || isUrl(url))
  const labelId = `source-${layer.id}`
  return (
    <div>
      <ControlRow label={<InfoLabel id={labelId} path={path} label="Source" />} wide>
        {asUrl ? (
          <TextField labelledBy={labelId} value={isUrl(url) ? url : undefined} onChange={(v) => setValue(path, v ?? '')} />
        ) : (
          <FilePicker
            folder="layers"
            preview={false}
            labelledBy={labelId}
            value={isUrl(url) ? undefined : url.replace(/^\.?\/?layers\//, '')}
            emptyLabel="Choose…"
            onChange={(name) => setValue(path, `./layers/${name}`)}
          />
        )}
      </ControlRow>
      {fileKind && (
        <button type="button" onClick={() => setAsUrl(!asUrl)} className={`mt-1 ml-auto block ${TEXT_LINK}`}>
          {asUrl ? 'Use an existing file or upload' : 'Use a URL instead'}
        </button>
      )}
      {problemsAt(path).map((p) => (
        <ProblemText key={p}>{p}</ProblemText>
      ))}
    </div>
  )
}

type SourceLayer = { sourceLayer: string; name?: string }

// dropped when emptied, since no list means every source layer
function useSourceLayers(layerId: string) {
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const index = layers.findIndex((l) => l.id === layerId)
  const list = (layers[index]?.sourceLayers ?? []) as SourceLayer[]
  const change = (fn: (list: SourceLayer[]) => void) =>
    editLayers((all) => {
      const layer = all.find((l) => l.id === layerId)
      if (!layer) return
      const next = ((layer.sourceLayers ??= []) as SourceLayer[])
      fn(next)
      if (next.length === 0) delete layer.sourceLayers
    })
  return { index, list, change }
}

const sourceLayerEntry = (layerId: string, i: number, title: string): PanelEntry => ({
  panel: `source-layer:${layerId}:${i}`,
  label: title,
  screen: 'source-layer',
  param: `${layerId}|${i}`,
  sections: [],
})

// with none listed, the tiles' names are written in once read
// so each source layer can have its own style
function useTileSourceLayers(layer: Layer | undefined) {
  const { index, list, change } = useSourceLayers(layer?.id ?? '')
  const url = layer && typeof layer.url === 'string' ? layer.url : ''
  const names = usePreviewAnswer<string[]>('source-layers', url ? { layerType: layer!.type, url } : null)
  useEffect(() => {
    if (layer && list.length === 0 && names.value?.length) change((l) => void l.push(...names.value!.map((n) => ({ sourceLayer: n }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, names.value])
  return { index, list, change, names, count: names.value?.length ?? 0 }
}

function SourceLayersScreen({ layerId }: { layerId: string }) {
  const layer = useLayers().find((l) => l.id === layerId)
  const { list, change, names } = useTileSourceLayers(layer)
  const { pushPanel } = useEditor()
  const [choosing, setChoosing] = useState(false)
  if (!layer) return <Gone>This layer is no longer in layers.json.</Gone>
  return (
    <>
      {list.length === 0 && (
        <PanelNote>
          {names.loading
            ? 'Reading the source layers in the tiles…'
            : `Every source layer in the tiles is drawn, in automatic colors.${names.error ? ` Couldn’t read their names (${names.error}). Add them with Choose source layers to style each.` : ''}`}
        </PanelNote>
      )}
      <AddButton label="Choose source layers" onClick={() => setChoosing(true)} />
      <SortableList
        rows={list.map((s, i) => ({
          key: `${i}:${s.sourceLayer}`,
          title: s.name ?? s.sourceLayer,
          detail: s.name ? s.sourceLayer : undefined,
          onClick: () => pushPanel(sourceLayerEntry(layerId, i, s.name ?? s.sourceLayer)),
        }))}
        onMove={(from, to) => change((l) => move(l, from, to))}
      />
      <ChooseSourceLayersDialog
        key={String(choosing)}
        open={choosing}
        layer={layer}
        shown={list.map((s) => s.sourceLayer)}
        // kept ones keep their settings and order, new ones go at the end
        onUpdate={(picked) =>
          change((l) => {
            const kept = l.filter((s) => picked.includes(s.sourceLayer))
            const added = picked.filter((n) => !l.some((s) => s.sourceLayer === n)).map((n) => ({ sourceLayer: n }))
            l.splice(0, l.length, ...kept, ...added)
          })
        }
        onClose={() => setChoosing(false)}
      />
    </>
  )
}

// the tiles' source layers as a checklist, typed if the preview can't read
function ChooseSourceLayersDialog({
  open,
  layer,
  shown,
  onUpdate,
  onClose,
}: {
  open: boolean
  layer: Layer
  shown: string[]
  onUpdate: (names: string[]) => void
  onClose: () => void
}) {
  const { loading, value, error } = usePreviewAnswer<string[]>(
    'source-layers',
    open && typeof layer.url === 'string' ? { layerType: layer.type, url: layer.url } : null,
  )
  return (
    <ChooseDialog
      open={open}
      title="Choose source layers"
      items={value ?? []}
      shown={shown}
      loading={loading}
      loadingText="Reading the names the tiles list…"
      error={error && `Couldn’t read the names (${error})`}
      typed={{ label: 'Add a source layer', hint: 'Type its name as the tiles name it (tippecanoe’s -l).' }}
      noneNote="None checked: every source layer in the tiles is drawn."
      onUpdate={onUpdate}
      onClose={onClose}
    />
  )
}

// a source layer's page, laid out like a layer's
function SourceLayerScreen({ param }: { param: string }) {
  const [layerId, i] = param.split('|')
  const { index, list, change } = useSourceLayers(layerId)
  const { backPanel } = useEditor()
  const item = list[Number(i)]
  if (!item) return <Gone>This source layer is no longer listed.</Gone>
  const at = `layers:layers.${index}.sourceLayers.${i}`
  const name = item.name ?? item.sourceLayer
  return (
    <>
      <PanelSection
        nested
        section={{
          settings: [
            // a lone source layer shows under the layer's own name
            ...(list.length > 1 ? [{ path: `${at}.name`, label: 'Name' }] : []),
            { path: `${at}.geometryType`, label: 'Geometry type' },
            { path: `${at}.visible`, label: 'Visible at start' },
          ],
        }}
      />
      <Block gap={1}>
        <PanelLink
          nested
          entry={{ panel: `source-layer-general:${layerId}:${i}`, label: 'General', title: `General – ${name}`, screen: 'source-layer-general', param, sections: [] }}
        />
        <StyleLinks layerId={layerId} name={name} source={Number(i)} fields={['symbology', 'label', 'popup']} />
      </Block>
      <Block>
        <PanelButton
          kind="danger"
          onClick={() => {
            backPanel()
            change((l) => void l.splice(Number(i), 1))
          }}
        >
          Remove source layer
        </PanelButton>
      </Block>
    </>
  )
}

// a source layer's zooms, and its name in the tiles
function SourceLayerGeneralScreen({ param }: { param: string }) {
  const [layerId, i] = param.split('|')
  const { index, list } = useSourceLayers(layerId)
  const item = list[Number(i)]
  if (!item) return <Gone>This source layer is no longer listed.</Gone>
  const at = `layers:layers.${index}.sourceLayers.${i}`
  return (
    // one section, In the tiles belongs with the zooms above it
    <div>
      <PanelSection
        nested
        className="pt-3 pb-2"
        section={{
          settings: [
            { path: `${at}.minZoom`, label: 'Min zoom' },
            { path: `${at}.maxZoom`, label: 'Max zoom' },
          ],
        }}
      />
      <Block className="pt-0">
        <PlainRow label="In the tiles" value={item.sourceLayer} />
      </Block>
    </div>
  )
}

// an Esri map service is a server-drawn image, so none of these apply
function StyleLinks({
  layerId,
  name,
  source,
  fields,
  esriRaster = false,
  defaults = false,
}: {
  layerId: string
  name: string
  source?: number
  fields: string[]
  esriRaster?: boolean
  // the defaults a vector tile layer's source layers start from
  defaults?: boolean
}) {
  const param = `${layerId}|${source ?? ''}`
  const at = `${layerId}:${source ?? ''}`
  return (
    <>
      {fields.includes('symbology') && !esriRaster && (
        <PanelLink
          nested
          entry={{
            panel: `layer-style:${at}`,
            label: 'Style',
            title: `Style – ${name}`,
            screen: 'layer-style',
            param,
            sections: [],
          }}
        />
      )}
      {fields.includes('label') && !esriRaster && (
        <PanelLink
          nested
          entry={{ panel: `layer-labels:${at}`, label: defaults ? 'Default labels' : 'Labels', title: `${defaults ? 'Default labels' : 'Labels'} – ${name}`, screen: 'layer-labels', param, sections: [] }}
        />
      )}
      {fields.includes('popup') && !esriRaster && (
        <PanelLink
          nested
          entry={{ panel: `layer-popup:${at}`, label: defaults ? 'Default popup' : 'Popup', title: `${defaults ? 'Default popup' : 'Popup'} – ${name}`, screen: 'layer-popup', param, sections: [] }}
        />
      )}
    </>
  )
}

// a Style or Labels screen's target, the layer or a source layer
function useStyleTarget(param: string) {
  const layers = useLayers()
  const [layerId, source] = param.split('|')
  const index = layers.findIndex((l) => l.id === layerId)
  const layer = layers[index]
  const sourceLayer = source === '' ? undefined : (layer?.sourceLayers as (SourceLayer & Json)[] | undefined)?.[Number(source)]
  if (!layer || (source !== '' && !sourceLayer)) return null
  return {
    layer,
    layers,
    sourceLayer,
    base: source === '' ? `layers:layers.${index}` : `layers:layers.${index}.sourceLayers.${source}`,
    geometry: (sourceLayer?.geometryType ?? layer.geometryType) as string | undefined,
  }
}

type Symbology = { kind: 'simple' | 'raw' | 'ref'; name?: string; description?: string } & Json

const STYLE_HELP =
  "How the layer is drawn. Simple: one color plus size, stroke and opacity, set here. A named style comes from the project's symbology.json, where colors by category or by number range are written. Change it in that file and every layer using it updates. Custom (raw) is MapLibre paint written into this layer in layers.json. Edit it there."

// none where a style is optional, Simple, and symbology.json's entries
function StyleScreen({ param }: { param: string }) {
  const { project, files, setValue, resetValue } = useEditor()
  const target = useStyleTarget(param)
  const [pending, setPending] = useState<string | null>(null)
  if (!target) return <Gone>This layer is no longer in layers.json.</Gone>
  const { layer, layers, sourceLayer, base, geometry } = target
  const path = `${base}.symbology`
  const style = valueAt(files, path) as Symbology | undefined
  const named = Object.entries((files.symbology ?? {}) as Record<string, unknown>).filter(([name]) => name !== '$schema') as [string, Symbology][]
  // GeoJSON, FlatGeobuf and GeoParquet need one, tiles and Esri don't
  const optional = sourceLayer !== undefined || ['pmtiles', 'tiles', 'esri'].includes(layer.type)
  const noneLabel = sourceLayer !== undefined ? 'Automatic color' : layer.type === 'esri' ? "The service's own style" : 'Automatic colors'
  const current = style === undefined ? 'none' : style.kind === 'ref' ? `ref:${style.name}` : style.kind
  const options = [...(optional ? ['none'] : []), 'simple', ...named.map(([name]) => `ref:${name}`), ...(current === 'raw' ? ['raw'] : [])]
  const labelOf = (o: string) =>
    o === 'none' ? noneLabel : o === 'simple' ? 'Simple' : o === 'raw' ? 'Custom (raw)' : `${o.slice(4)} (symbology.json)`
  const apply = (choice: string) => {
    if (choice === 'none') resetValue(path)
    else if (choice === 'simple') setValue(path, { kind: 'simple', color: unusedColor(layers) })
    else if (choice.startsWith('ref:')) setValue(path, { kind: 'ref', name: choice.slice(4) })
  }
  return (
    <>
      <PanelNote>
        Simple styles are set here. For colors by category or by number range, add a named style to
        app/projects/{project}/symbology.json, then pick it from Style.{' '}
        <a href="https://conness-gis.com/configuration/symbology/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
          How to write one
        </a>
      </PanelNote>
      <Block>
        <ControlRow label={<InfoLabel id={`style-${param}`} path={path} label="Style" text={STYLE_HELP} />} wide>
          <Select
            labelledBy={`style-${param}`}
            value={current === 'none' && !optional ? undefined : current}
            options={options}
            labelOf={labelOf}
            emptyLabel="Choose…"
            // switching loses a simple or raw style, so ask
            onChange={(choice) => (choice === current ? undefined : current === 'simple' || current === 'raw' ? setPending(choice) : apply(choice))}
          />
        </ControlRow>
      </Block>
      {style?.kind === 'simple' && (
        <PanelSection nested section={{ settings: simpleFields(geometry).map(([key, label]) => ({ path: `${path}.${key}`, label })) }} />
      )}
      <LegendBlock base={base} name={sourceLayer?.name ?? sourceLayer?.sourceLayer ?? layer.name ?? layer.id} color={style?.kind === 'simple' ? (style.color as string) : undefined} layerLevel={sourceLayer === undefined} />
      <Modal
        open={pending !== null}
        title="Replace this style?"
        submitLabel="Replace"
        danger
        onClose={() => setPending(null)}
        onSubmit={() => {
          if (pending) apply(pending)
          setPending(null)
        }}
      >
        {current === 'raw'
          ? 'Switching away from the raw style loses it.'
          : 'Switching away from Simple loses its current colors and sizes.'}
      </Modal>
    </>
  )
}

type LegendEntry = { label: string; color: string }

// a gradient written in layers.json stays as it is
// only a layer, not a source layer, may carry the older hideFromLegend
function LegendBlock({ base, name, color, layerLevel }: { base: string; name: string; color?: string; layerLevel: boolean }) {
  const { files, setValue, resetValue } = useEditor()
  const legend = valueAt(files, `${base}.legend`) as { kind?: string; entries?: LegendEntry[] } | undefined
  const mode =
    valueAt(files, `${base}.hideFromLegend`) === true || legend?.kind === 'hidden'
      ? 'hidden'
      : legend?.kind === 'categories'
        ? 'custom'
        : legend?.kind === 'gradient'
          ? 'gradient'
          : 'style'
  const labels: Record<string, string> = {
    style: 'From the style',
    hidden: 'Hidden',
    custom: 'Custom',
    gradient: 'Custom (gradient, set in layers.json)',
  }
  const choose = (next: string) => {
    if (next === mode) return
    if (layerLevel) resetValue(`${base}.hideFromLegend`)
    if (next === 'style') resetValue(`${base}.legend`)
    if (next === 'hidden') setValue(`${base}.legend`, { kind: 'hidden' })
    if (next === 'custom') setValue(`${base}.legend`, { kind: 'categories', entries: [{ label: name, color: color ?? '#888888' }] })
  }
  const entries = legend?.kind === 'categories' ? (legend.entries ?? []) : []
  const at = `${base}.legend.entries`
  return (
    <Block gap={2}>
      <ControlRow label="Legend" labelId={`legend-${base}`} wide>
        <Select
          labelledBy={`legend-${base}`}
          value={mode}
          options={['style', 'hidden', 'custom', ...(mode === 'gradient' ? ['gradient'] : [])]}
          labelOf={(o) => labels[o]}
          onChange={choose}
        />
      </ControlRow>
      {mode === 'custom' && (
        <>
          {entries.map((entry, k) => (
            <div key={k} className="flex items-center gap-1.5 text-[13px]">
              <span className="w-[45%] shrink-0">
                <MapColorField
                  labelledBy={`legend-${base}`}
                  value={entry.color}
                  onChange={(v) => setValue(`${at}.${k}.color`, v ?? '')}
                />
              </span>
              <TextField labelledBy={`legend-${base}`} value={entry.label || undefined} fallback="Label" onChange={(v) => setValue(`${at}.${k}.label`, v ?? '')} />
              <button
                type="button"
                aria-label={`Remove ${entry.label || 'entry'}`}
                onClick={() => setValue(at, entries.filter((_, n) => n !== k))}
                className="shrink-0 rounded px-1.5 text-fg-subtle hover:text-problem focus-visible:outline-2 focus-visible:outline-glacier-light"
              >
                ×
              </button>
            </div>
          ))}
          <PanelButton kind="add" onClick={() => setValue(at, [...entries, { label: '', color: color ?? '#888888' }])}>
            + Add entry
          </PanelButton>
        </>
      )}
    </Block>
  )
}

// the look defaults to Label defaults
function LabelsScreen({ param }: { param: string }) {
  const { files } = useEditor()
  const target = useStyleTarget(param)
  if (!target) return <Gone>This layer is no longer in layers.json.</Gone>
  const at = `${target.base}.label`
  const on = { path: at }
  // in the Overwrite defaults fold, each defaulting to Label defaults
  const look = (key: string, label: string): Entry => ({
    path: `${at}.${key}`,
    label,
    dependsOn: on,
    fallbackFrom: `settings:ui.layerDefaults.label.${key}`,
    advanced: true,
  })
  const label = valueAt(files, at) as Json | undefined
  return (
    <PanelSection nested
      section={{
        note: label?.expression !== undefined
          ? 'This label uses an expression from layers.json, which wins over Column. Edit it there.'
          : "Labels use the app's Label defaults (Layers → Label defaults) for their size, colors and position. To change those for this layer only, open Overwrite defaults for this layer.",
        advancedLabel: 'Overwrite defaults for this layer',
        advancedNote: "All of these settings will take precedence over the app's label defaults.",
        settings: [
          { path: at, label: 'Show labels', presence: true },
          { path: `${at}.field`, label: 'Column', dependsOn: on },
          ...(label?.text !== undefined ? [{ path: `${at}.text`, label: 'Custom Label', dependsOn: on }] : []),
          look('fontSize', 'Text size'),
          look('bold', 'Bold'),
          look('color', 'Text color'),
          look('haloColor', 'Halo color'),
          look('haloWidth', 'Halo width'),
          look('anchor', 'Position'),
          // with labels on (the position decides it, so it can't also depend on them)
          ...(label
            ? [{ ...look('offset', 'Offset'), dependsOn: { path: `${at}.anchor`, not: 'center', fallbackFrom: 'settings:ui.layerDefaults.label.anchor' } }]
            : []),
          look('allowOverlap', 'Allow overlap'),
          ...(target.geometry === 'line' ? [look('spacing', 'Repeat spacing')] : []),
          { path: `${at}.minZoom`, label: 'Starting zoom', dependsOn: on, advanced: true },
        ],
      }}
    />
  )
}

// off keeps their settings as `enabled: false`
function PopupScreen({ param }: { param: string }) {
  const { files, setValue, resetValue } = useEditor()
  const target = useStyleTarget(param)
  if (!target) return <Gone>This layer is no longer in layers.json.</Gone>
  const at = `${target.base}.popup`
  const popup = valueAt(files, at) as Json | false | undefined
  const on = typeof popup === 'object' && popup.enabled !== false
  const toggle = (next: boolean) => {
    if (next) return typeof popup === 'object' ? resetValue(`${at}.enabled`) : setValue(at, {})
    const kept = typeof popup === 'object' && Object.keys(popup).some((k) => k !== 'enabled')
    return kept ? setValue(`${at}.enabled`, false) : resetValue(at)
  }
  const fields = typeof popup === 'object' ? (popup.fields as Record<string, string> | undefined) : undefined
  const name = target.sourceLayer?.name ?? target.sourceLayer?.sourceLayer ?? target.layer.name ?? target.layer.id
  const fold = (key: string, label: string): Entry => ({
    path: `${at}.${key}`,
    label,
    fallbackFrom: `settings:ui.popups.${key}`,
    advanced: true,
  })
  return (
    <>
      <PanelNote>
        Popups use the app&apos;s Popup defaults (Layers → Popup defaults) for the template, how they open and their
        buttons. To change those for this layer only, open Overwrite defaults for this layer.
      </PanelNote>
      {/* with popups on, the row and settings below read as one section */}
      <section className={on ? 'border-b-0! px-4 pt-3 -mb-1' : 'px-4 py-3'}>
        <ControlRow label={<InfoLabel id={`popup-${param}`} path={at} label="Show popups" />}>
          <Switch labelledBy={`popup-${param}`} value={on} onChange={toggle} />
        </ControlRow>
      </section>
      {on && (
        <PanelSection
          nested
          section={{
            advancedLabel: 'Overwrite defaults for this layer',
            advancedNote: "All of these settings will take precedence over the app's popup defaults.",
            settings: [
              { path: `${at}.header`, label: 'Header' },
              { path: `${at}.title`, label: 'Title' },
              {
                panel: `popup-fields:${param}`,
                label: fields ? `Fields (${Object.keys(fields).length})` : 'Fields (every column)',
                title: `Fields – ${name}`,
                screen: 'popup-fields',
                param,
                sections: [],
              },
              fold('displayType', 'Template'),
              fold('trigger', 'Opens on'),
              fold('position', 'Position'),
              fold('highlight', 'Highlight'),
              fold('zoomToFeature', 'Zoom to feature'),
              fold('copyCoordinates', 'Copy coordinates'),
              fold('viewInGoogleMaps', 'View in Google Maps'),
            ],
          }}
        />
      )}
    </>
  )
}

// none listed means every column, by its name
function usePopupFields(param: string) {
  const { files, setValue, resetValue } = useEditor()
  const target = useStyleTarget(param)
  const at = target && `${target.base}.popup.fields`
  const fields = (at ? valueAt(files, at) : undefined) as Record<string, string> | undefined
  const write = (entries: [string, string][]) => {
    if (!at) return
    if (entries.length === 0) resetValue(at)
    else setValue(at, Object.fromEntries(entries))
  }
  return { target, entries: Object.entries(fields ?? {}), write }
}

function PopupFieldsScreen({ param }: { param: string }) {
  const { target, entries, write } = usePopupFields(param)
  const { pushPanel } = useEditor()
  const [adding, setAdding] = useState(false)
  if (!target) return <Gone>This layer is no longer in layers.json.</Gone>
  return (
    <>
      <PanelNote>
        The columns this popup shows, in this order, each with its label. With none listed, the popup shows every column by
        its name.
      </PanelNote>
      <AddButton label="Choose columns" onClick={() => setAdding(true)} />
      <SortableList
        rows={entries.map(([column, label]) => ({
          key: column,
          title: label || column,
          detail: label && label !== column ? column : undefined,
          onClick: () =>
            pushPanel({ panel: `popup-field:${param}|${column}`, label: label || column, screen: 'popup-field', param: `${param}|${column}`, sections: [] }),
        }))}
        onMove={(from, to) => {
          const next = entries.slice()
          move(next, from, to)
          write(next)
        }}
      />
      <ChooseColumnsDialog
        key={String(adding)}
        open={adding}
        layerId={target.layer.id}
        sourceLayer={target.sourceLayer?.sourceLayer}
        shown={entries.map(([column]) => column)}
        onUpdate={(columns) =>
          write([
            ...entries.filter(([c]) => columns.includes(c)),
            ...columns.filter((c) => !entries.some(([shown]) => shown === c)).map((c): [string, string] => [c, c]),
          ])
        }
        onClose={() => setAdding(false)}
      />
    </>
  )
}

function PopupFieldScreen({ param }: { param: string }) {
  const at = param.lastIndexOf('|')
  const column = param.slice(at + 1)
  const { entries, write } = usePopupFields(param.slice(0, at))
  const index = entries.findIndex(([c]) => c === column)
  if (index < 0) return <Gone>This column is no longer in the popup.</Gone>
  return (
    <>
      <Block gap={2}>
        <PlainRow label="Column" value={column} />
        <ControlRow label="Label" labelId={`field-${param}`} wide>
          <TextField
            labelledBy={`field-${param}`}
            value={entries[index][1] || undefined}
            fallback={column}
            onChange={(v) => write(entries.map(([c, l]) => [c, c === column ? (v ?? '') : l]))}
          />
        </ControlRow>
      </Block>
      <RemoveButton
        label="Remove from the popup"
        name={column}
        onRemove={() => write(entries.filter(([c]) => c !== column))}
      />
    </>
  )
}

// Update adds newly checked columns at the end and drops the unchecked
function ChooseColumnsDialog({
  open,
  layerId,
  sourceLayer,
  shown,
  onUpdate,
  onClose,
}: {
  open: boolean
  layerId: string
  sourceLayer?: string
  shown: string[]
  onUpdate: (columns: string[]) => void
  onClose: () => void
}) {
  const { loading, columns, error } = useLayerColumns(open ? layerId : undefined, sourceLayer)
  return (
    <ChooseDialog
      open={open}
      title="Choose columns"
      items={columns}
      shown={shown}
      loading={loading}
      loadingText="Reading columns…"
      error={error && `Couldn’t read this layer’s columns from the preview: ${error}`}
      noneNote="None checked: the popup shows every column."
      onUpdate={onUpdate}
      onClose={onClose}
    />
  )
}

type LayerFilter = { column: string; kind: 'categorical' | 'numeric'; label?: string }
const FILTER_KINDS: Record<string, string> = { categorical: 'Categorical', numeric: 'Numeric' }

// the list is created when missing and dropped when emptied
function useFilters(layerId: string) {
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const index = layers.findIndex((l) => l.id === layerId)
  const list = (layers[index]?.filters ?? []) as LayerFilter[]
  const change = (fn: (list: LayerFilter[]) => void) =>
    editLayers((all) => {
      const layer = all.find((l) => l.id === layerId)
      if (!layer) return
      const next = ((layer.filters ??= []) as LayerFilter[])
      fn(next)
      if (next.length === 0) delete layer.filters
    })
  return { index, layer: layers[index], list, change }
}

function FiltersScreen({ layerId }: { layerId: string }) {
  const { index, layer, list, change } = useFilters(layerId)
  const { pushPanel } = useEditor()
  const [adding, setAdding] = useState(false)
  if (index < 0) return <Gone>This layer is no longer in layers.json.</Gone>
  const open = (i: number, f: LayerFilter) =>
    pushPanel({ panel: `layer-filter:${layerId}:${i}`, label: f.label ?? f.column, screen: 'layer-filter', param: `${layerId}|${i}`, sections: [] })
  return (
    <>
      <PanelNote>
        Filters let people narrow this layer from its menu in the Layer List. Categorical: a checklist of the column&apos;s
        values. Numeric: one condition, like over 1000.
      </PanelNote>
      <AddButton label="Add filter" onClick={() => setAdding(true)} />
      <SortableList
        rows={list.map((f, i) => ({ key: `${i}:${f.column}`, title: f.label ?? f.column, detail: FILTER_KINDS[f.kind], onClick: () => open(i, f) }))}
        onMove={(from, to) => change((l) => move(l, from, to))}
      />
      <AddFilterDialog
        open={adding}
        layerId={layer.id}
        onAdd={(filter) => {
          change((l) => void l.push(filter))
          open(list.length, filter)
        }}
        onClose={() => setAdding(false)}
      />
    </>
  )
}

function AddFilterDialog({ open, layerId, onAdd, onClose }: { open: boolean; layerId: string; onAdd: (f: LayerFilter) => void; onClose: () => void }) {
  const { loading, columns, error: readError } = useLayerColumns(open ? layerId : undefined)
  const [column, setColumn] = useState('')
  const [kind, setKind] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    setColumn('')
    setKind('')
    setLabel('')
    setError(null)
    onClose()
  }
  return (
    <Modal
      open={open}
      title="Add filter"
      submitLabel="Add"
      error={error}
      onClose={close}
      onSubmit={() => {
        if (!column.trim()) return setError('Choose a column.')
        if (!kind) return setError('Choose categorical or numeric.')
        onAdd({ column: column.trim(), kind: kind as LayerFilter['kind'], ...(label.trim() ? { label: label.trim() } : {}) })
        close()
      }}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="font-medium text-ink">Column</span>
          {readError ? (
            <input autoFocus value={column} onChange={(e) => setColumn(e.target.value)} className={modalInput} />
          ) : (
            <select autoFocus value={column} onChange={(e) => setColumn(e.target.value)} className={modalInput}>
              <option value="" disabled>
                {loading ? 'Reading columns…' : 'Choose…'}
              </option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {readError && <span className="mt-1.5 block">Couldn’t read the columns ({readError}). Type the name.</span>}
        </label>
        <label className="block">
          <span className="font-medium text-ink">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={modalInput}>
            <option value="" disabled>
              Choose…
            </option>
            <option value="categorical">Categorical: a checklist of its values</option>
            <option value="numeric">Numeric: one condition, like over 1000</option>
          </select>
        </label>
        <label className="block">
          <span className="font-medium text-ink">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={column} className={modalInput} />
          <span className="mt-1.5 block">Its name in the filter panel. Left empty, it&apos;s the column&apos;s name.</span>
        </label>
      </div>
    </Modal>
  )
}

function FilterScreen({ param }: { param: string }) {
  const [layerId, i] = param.split('|')
  const { index, list, change } = useFilters(layerId)
  const filter = list[Number(i)]
  if (!filter) return <Gone>This filter is no longer in layers.json.</Gone>
  const at = `layers:layers.${index}.filters.${i}`
  return (
    <>
      <PanelSection nested
        section={{
          settings: [
            { path: `${at}.column`, label: 'Column' },
            { path: `${at}.kind`, label: 'Kind' },
            { path: `${at}.label`, label: 'Label' },
          ],
        }}
      />
      <RemoveButton
        label="Remove filter"
        name={filter.label ?? filter.column}
        onRemove={() => change((l) => void l.splice(Number(i), 1))}
      />
    </>
  )
}

const NEW_GROUP = '__new-group'

// none, one of the groups, or a new one named in a dialog
function GroupRow({ layer }: { layer: Layer }) {
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const [naming, setNaming] = useState(false)
  const groups = layerItems(layers, useGroups()).flatMap((i) => (i.kind === 'group' ? [i.name] : []))
  const setGroup = (group: string | undefined) =>
    editLayers((list) => {
      const target = list.find((l) => l.id === layer.id)
      if (!target) return
      if (group) target.group = group
      else delete target.group
    })
  return (
    <div>
      <ControlRow label="Group" labelId={`group-${layer.id}`} wide>
        <Select
          labelledBy={`group-${layer.id}`}
          value={layer.group}
          // Select adds its own None while nothing is picked
          options={[...(layer.group ? [''] : []), ...groups, NEW_GROUP]}
          labelOf={(o) => (o === '' ? 'None' : o === NEW_GROUP ? 'New group…' : o)}
          emptyLabel="None"
          onChange={(o) => (o === NEW_GROUP ? setNaming(true) : setGroup(o || undefined))}
        />
      </ControlRow>
      <NameDialog
        key={`new-${naming}`}
        open={naming}
        title="New group"
        taken={groups}
        onName={(name) => setGroup(name)}
        onClose={() => setNaming(false)}
      />
    </div>
  )
}

// asks for a group name that isn't taken
function NameDialog({
  open,
  title,
  initial = '',
  taken,
  onName,
  onClose,
}: {
  open: boolean
  title: string
  initial?: string
  taken: string[]
  onName: (name: string) => void
  onClose: () => void
}) {
  // a fresh dialog starts from `initial` (callers key it by when it opens)
  const [name, setName] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    setError(null)
    onClose()
  }
  return (
    <Modal
      open={open}
      title={title}
      submitLabel="OK"
      error={error}
      onClose={close}
      onSubmit={() => {
        const next = name.trim()
        if (!next) return setError('Name is required.')
        if (next !== initial && taken.includes(next)) return setError(`There's already a group called ${next}.`)
        onName(next)
        close()
      }}
    >
      <label className="block">
        <span className="font-medium text-ink">Group name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={modalInput} />
        <span className="mt-1.5 block">The header its layers sit under in the layer list.</span>
      </label>
    </Modal>
  )
}

// a layer's data file in layers/, when it's local and no other layer uses it
function ownFile(layer: Layer, layers: Layer[]): string | null {
  const match = typeof layer.url === 'string' ? /^(?:\.\/|\/)?layers\/([^/]+)$/.exec(layer.url) : null
  if (!match) return null
  return layers.some((l) => l !== layer && l.url === layer.url) ? null : match[1]
}

// out of the draft at once with its Search entries, its file moves on Save
function RemoveLayer({ layer }: { layer: Layer }) {
  const { files, edit, backPanel, trashOnSave } = useEditor()
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const [confirming, setConfirming] = useState(false)
  const [deleteFile, setDeleteFile] = useState(false)
  const file = ownFile(layer, layers)
  const searches = ((valueAt(files, 'settings:widgets.search.layers') ?? []) as SearchLayer[]).filter(
    (e) => e.layerId === layer.id,
  )
  const name = layer.name ?? layer.id
  const remove = () => {
    editLayers((list) => {
      const i = list.findIndex((l) => l.id === layer.id)
      if (i >= 0) list.splice(i, 1)
    })
    if (searches.length > 0) {
      edit('settings', (json) => {
        const search = valueAt({ settings: json }, 'settings:widgets.search.layers') as SearchLayer[] | undefined
        if (search) {
          const kept = search.filter((e) => e.layerId !== layer.id)
          search.splice(0, search.length, ...kept)
          if (kept.length === 0) removeAt(json, 'widgets.search.layers')
        }
      })
    }
    if (file && deleteFile) trashOnSave(file)
  }
  return (
    <Block>
      <PanelButton
        kind="danger"
        onClick={() => {
          setDeleteFile(false)
          setConfirming(true)
        }}
      >
        Remove layer
      </PanelButton>
      <Modal
        open={confirming}
        title={`Remove ${name}?`}
        submitLabel="Remove"
        danger
        onClose={() => setConfirming(false)}
        onSubmit={() => {
          setConfirming(false)
          backPanel()
          remove()
        }}
      >
        <div className="space-y-3">
          <p>It comes out of the draft now. Save writes the change to the project.</p>
          {searches.length > 0 && (
            <p>
              Search stops searching it too ({searches.length} searchable {searches.length === 1 ? 'column' : 'columns'}).
            </p>
          )}
          {file && (
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={deleteFile}
                onChange={(e) => setDeleteFile(e.target.checked)}
                className="accent-glacier"
              />
              Also delete layers/{file}
            </label>
          )}
          {file && deleteFile && <p>It moves to app/projects/_trash/ when you Save.</p>}
          {file && !deleteFile && <p>The file stays in layers/. A build leaves out files no layer uses.</p>}
        </div>
      </Modal>
    </Block>
  )
}

function LayerGroupScreen({ name }: { name: string }) {
  const layers = useLayers()
  const editLayers = useLayerEdit()
  const { files, edit, pushPanel, backPanel } = useEditor()
  const [renaming, setRenaming] = useState(false)
  const items = layerItems(layers, useGroups())
  const group = items.find((i) => i.kind === 'group' && i.name === name)
  if (group?.kind !== 'group') return <Gone>This group is gone.</Gone>
  const collapsed = valueAt(files, 'settings:layerGroups')
    ? ((valueAt(files, 'settings:layerGroups') as Record<string, Json>)[name]?.collapsed as boolean | undefined)
    : undefined
  const byDefault = (valueAt(files, 'settings:widgets.layer-list.groupsCollapsedByDefault') ??
    schemaInfo('settings:widgets.layer-list.groupsCollapsedByDefault').default) as boolean | undefined
  return (
    <>
      <Block gap={2}>
        {/* the name truncates, so it isn't a ControlRow's fixed control */}
        <div className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 truncate">Name</span>
          <span className="ml-auto truncate text-fg-muted">{name}</span>
          <InlineButton onClick={() => setRenaming(true)}>Rename</InlineButton>
        </div>
        <ControlRow label="Start collapsed" labelId={`collapsed-${name}`}>
          <Switch
            labelledBy={`collapsed-${name}`}
            value={collapsed}
            fallback={byDefault}
            onChange={(next) => edit('settings', (json) => void ((groupsIn(json)[name] ??= {}).collapsed = next))}
          />
        </ControlRow>
      </Block>
      <Block>
        <PanelButton
          kind="secondary"
          onClick={() => {
            editLayers((list, groups) => ungroup(list, groups, name), 'drop')
            backPanel()
          }}
        >
          {group.ids.length > 0 ? 'Ungroup (keeps its layers)' : 'Remove group'}
        </PanelButton>
      </Block>
      <NameDialog
        key={`rename-${renaming}`}
        open={renaming}
        title="Rename group"
        initial={name}
        taken={items.flatMap((i) => (i.kind === 'group' ? [i.name] : []))}
        onName={(next) => {
          if (next === name) return
          editLayers((list, groups) => renameGroup(list, groups, name, next), 'drop')
          // the screen is keyed by the name, so swap it for the renamed group's
          backPanel()
          pushPanel(groupEntry(next))
        }}
        onClose={() => setRenaming(false)}
      />
    </>
  )
}

type Basemap = { id: string; name: string; style: unknown; license?: string; thumbnail?: string }
type CustomLink = { label: string; url: string }
type SearchLayer = { layerId: string; fields?: string[] }
type Json = Record<string, unknown>

// where each of the three editable lists lives in its file
const LISTS = {
  basemaps: { file: 'basemaps', path: 'basemaps' },
  links: { file: 'settings', path: 'contextMenu.custom' },
  search: { file: 'settings', path: 'widgets.search.layers' },
} as const
type ListName = keyof typeof LISTS

function useList<T>(name: ListName): T[] {
  const { file, path } = LISTS[name]
  return (valueAt(useEditor().files, `${file}:${path}`) ?? []) as T[]
}

// the list's array in a file's JSON, created when missing
function listIn(json: Json, path: string): unknown[] {
  const keys = path.split('.')
  let node = json
  for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Json
  return ((node[keys.at(-1)!] ??= []) as unknown[])
}

function useListEdits(name: ListName) {
  const { edit } = useEditor()
  const { file, path } = LISTS[name]
  return {
    add: (item: unknown) => edit(file, (json) => void listIn(json, path).push(item)),
    move: (from: number, to: number) => edit(file, (json) => move(listIn(json, path), from, to)),
    // the last one removed takes the key, basemaps.json keeps its list
    remove: (index: number) =>
      edit(file, (json) => {
        const list = listIn(json, path)
        list.splice(index, 1)
        if (list.length === 0 && file !== 'basemaps') removeAt(json, path)
      }),
  }
}

function geojsonLayers(files: Record<string, Json>) {
  return ((files.layers?.layers ?? []) as Layer[]).filter((l) => l.type === 'geojson')
}

// Add asks for the item's required fields first
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Block>
      <PanelButton kind="add" onClick={onClick}>
        + {label}
      </PanelButton>
    </Block>
  )
}

type DialogField = { key: string; label: string; hint?: string; options?: { value: string; label: string }[] }

// `onAdd` returns an error to show, or null when added
function AddDialog({
  open,
  title,
  fields,
  onAdd,
  onClose,
}: {
  open: boolean
  title: string
  fields: DialogField[]
  onAdd: (values: Record<string, string>) => string | null
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    setValues({})
    setError(null)
    onClose()
  }
  return (
    <Modal
      open={open}
      title={title}
      submitLabel="Add"
      error={error}
      onClose={close}
      onSubmit={() => {
        const missing = fields.find((f) => !values[f.key]?.trim())
        if (missing) return setError(`${missing.label} is required.`)
        const problem = onAdd(Object.fromEntries(fields.map((f) => [f.key, values[f.key].trim()])))
        if (problem) return setError(problem)
        close()
      }}
    >
      <div className="space-y-4">
        {fields.map((f, i) => (
          <label key={f.key} className="block">
            <span className="font-medium text-ink">{f.label}</span>
            {f.options ? (
              <select
                autoFocus={i === 0}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className={modalInput}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                autoFocus={i === 0}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className={modalInput}
              />
            )}
            {f.hint && <span className="mt-1.5 block">{f.hint}</span>}
          </label>
        ))}
      </div>
    </Modal>
  )
}

// Remove after a confirm, then back to the list
function RemoveButton({ label, name, onRemove }: { label: string; name: string; onRemove: () => void }) {
  const { backPanel } = useEditor()
  const [confirming, setConfirming] = useState(false)
  return (
    <Block>
      <PanelButton kind="danger" onClick={() => setConfirming(true)}>
        {label}
      </PanelButton>
      <Modal
        open={confirming}
        title={`Remove ${name}?`}
        submitLabel="Remove"
        danger
        onClose={() => setConfirming(false)}
        onSubmit={() => {
          setConfirming(false)
          backPanel()
          onRemove()
        }}
      >
        It comes out of the draft now. Save writes the change to the project.
      </Modal>
    </Block>
  )
}

// one list item's settings, edited in place on its indexed paths
function ItemSettings({ list, index, rows }: { list: ListName; index: number; rows: [string, string][] }) {
  const { file, path } = LISTS[list]
  return (
    <PanelSection nested
      section={{ settings: rows.map(([key, label]) => ({ path: `${file}:${path}.${index}.${key}`, label })) }}
    />
  )
}

function BasemapsScreen() {
  const basemaps = useList<Basemap>('basemaps')
  const { pushPanel } = useEditor()
  const { move: reorder } = useListEdits('basemaps')
  const [adding, setAdding] = useState(false)
  const open = (i: number, name: string) =>
    pushPanel({ panel: `basemap:${i}`, label: name, screen: 'basemap', param: String(i), sections: [] })
  return (
    <>
      <AddButton label="Add basemap" onClick={() => setAdding(true)} />
      <SortableList
        rows={basemaps.map((b, i) => ({
          key: b.id,
          title: b.name,
          detail: `${b.id}${b.license === 'restricted' ? ' · not for commercial use' : ''}`,
          onClick: () => open(i, b.name),
        }))}
        onMove={reorder}
      />
      <AddBasemapDialog open={adding} basemaps={basemaps} onAdded={open} onClose={() => setAdding(false)} />
    </>
  )
}

// catalog basemaps the project doesn't have, or your own style URL
function AddBasemapDialog({
  open,
  basemaps,
  onAdded,
  onClose,
}: {
  open: boolean
  basemaps: Basemap[]
  onAdded: (index: number, name: string) => void
  onClose: () => void
}) {
  const { add } = useListEdits('basemaps')
  const ids = basemaps.map((b) => b.id)
  const available = (CATALOG as Basemap[]).filter((b) => !ids.includes(b.id))
  const [own, setOwn] = useState<boolean | null>(null)
  const [choice, setChoice] = useState('')
  const [name, setName] = useState('')
  const [style, setStyle] = useState('')
  const [error, setError] = useState<string | null>(null)
  // with nothing left in the catalog, your own is the only way
  const useOwn = own ?? available.length === 0
  const close = () => {
    setOwn(null)
    setChoice('')
    setName('')
    setStyle('')
    setError(null)
    onClose()
  }
  return (
    <Modal
      open={open}
      title="Add basemap"
      submitLabel="Add"
      error={error}
      onClose={close}
      onSubmit={() => {
        let entry: Basemap | undefined
        if (useOwn) {
          if (!name.trim() || !style.trim()) return setError('Name and Style URL are required.')
          entry = { id: freeSlug(name.trim(), ids, 'basemap'), name: name.trim(), style: style.trim() }
        } else {
          entry = available.find((b) => b.id === choice)
          if (!entry) return setError('Choose a basemap.')
        }
        add(entry)
        onAdded(basemaps.length, entry.name)
        close()
      }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span id="own-style" className="font-medium text-ink">
            Add Custom Basemap from URL
          </span>
          <Switch labelledBy="own-style" value={useOwn} onChange={setOwn} onLight />
        </div>
        {useOwn ? (
          <>
            <label className="block">
              <span className="font-medium text-ink">Name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={modalInput} />
              <span className="mt-1.5 block">Shown in the basemap switcher, e.g. "Positron (OpenFreeMap)".</span>
            </label>
            <label className="block">
              <span className="font-medium text-ink">Style URL</span>
              <input value={style} onChange={(e) => setStyle(e.target.value)} className={modalInput} />
              <span className="mt-1.5 block">A MapLibre style JSON URL.</span>
            </label>
          </>
        ) : (
          <label className="block">
            <span className="font-medium text-ink">Available Basemaps</span>
            <select autoFocus value={choice} onChange={(e) => setChoice(e.target.value)} className={modalInput}>
              <option value="" disabled>
                Choose…
              </option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.license === 'restricted' ? ' (not for commercial use)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        {available.length === 0 && (
          <p>Every catalog basemap is in the list already, so this adds your own style.</p>
        )}
      </div>
    </Modal>
  )
}

function BasemapScreen({ index }: { index: number }) {
  const basemap = useList<Basemap>('basemaps')[index]
  const { remove } = useListEdits('basemaps')
  if (!basemap) return <Gone>This basemap is no longer in basemaps.json.</Gone>
  return (
    <>
      <ItemSettings
        list="basemaps"
        index={index}
        rows={[
          ['name', 'Name'],
          ['id', 'ID'],
          ['style', 'Style URL'],
          ['license', 'License'],
          ['thumbnail', 'Thumbnail'],
        ]}
      />
      <RemoveButton label="Remove from the basemap list" name={basemap.name} onRemove={() => remove(index)} />
    </>
  )
}

function CustomLinksScreen() {
  const links = useList<CustomLink>('links')
  const { pushPanel } = useEditor()
  const { add, move: reorder } = useListEdits('links')
  const [adding, setAdding] = useState(false)
  const open = (i: number, label: string) =>
    pushPanel({ panel: `custom-link:${i}`, label, screen: 'custom-link', param: String(i), sections: [] })
  return (
    <>
      <AddButton label="Add link" onClick={() => setAdding(true)} />
      <SortableList
        rows={links.map((link, i) => ({ key: String(i), title: link.label, detail: link.url, onClick: () => open(i, link.label) }))}
        onMove={reorder}
      />
      <AddDialog
        open={adding}
        title="Add link"
        fields={[
          { key: 'label', label: 'Label', hint: 'The menu item, e.g. "Open in Bing Maps".' },
          { key: 'url', label: 'URL', hint: 'Use {lat}, {lng} and {zoom} for the spot that was right-clicked.' },
        ]}
        onAdd={({ label, url }) => {
          add({ label, url })
          open(links.length, label)
          return null
        }}
        onClose={() => setAdding(false)}
      />
    </>
  )
}

function CustomLinkScreen({ index }: { index: number }) {
  const link = useList<CustomLink>('links')[index]
  const { remove } = useListEdits('links')
  if (!link) return <Gone>This link is no longer in settings.json.</Gone>
  return (
    <>
      <ItemSettings
        list="links"
        index={index}
        rows={[
          ['label', 'Label'],
          ['url', 'URL'],
        ]}
      />
      <PanelNote>The URL can use {'{lat}'}, {'{lng}'} and {'{zoom}'} for the spot that was right-clicked.</PanelNote>
      <RemoveButton label="Remove link" name={link.label} onRemove={() => remove(index)} />
    </>
  )
}

function SearchLayersScreen() {
  const entries = useList<SearchLayer>('search')
  const { pushPanel } = useEditor()
  const { move: reorder } = useListEdits('search')
  const [adding, setAdding] = useState(false)
  const layers = useLayers()
  const nameOf = (id: string) => layers.find((l) => l.id === id)?.name ?? id
  const open = (i: number, entry: SearchLayer) =>
    pushPanel({
      panel: `search-layer:${i}`,
      label: `${nameOf(entry.layerId)} · ${entry.fields?.join(', ')}`,
      screen: 'search-layer',
      param: String(i),
      sections: [],
    })
  return (
    <>
      <AddButton label="Add searchable columns" onClick={() => setAdding(true)} />
      <SortableList
        rows={entries.map((entry, i) => ({
          key: String(i),
          title: `${nameOf(entry.layerId)} · ${entry.fields?.join(', ')}`,
          onClick: () => open(i, entry),
        }))}
        onMove={reorder}
      />
      <AddSearchDialog open={adding} entries={entries} onClose={() => setAdding(false)} />
    </>
  )
}

// each new column becomes its own entry, labelling results with it
function AddSearchDialog({ open, entries, onClose }: { open: boolean; entries: SearchLayer[]; onClose: () => void }) {
  const { files } = useEditor()
  const { add } = useListEdits('search')
  const [layerId, setLayerId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const { loading, columns, error: readError } = useColumns(layerId || undefined)
  const taken = entries.filter((e) => e.layerId === layerId).flatMap((e) => e.fields ?? [])
  const close = () => {
    setLayerId('')
    setPicked([])
    setError(null)
    onClose()
  }
  return (
    <Modal
      open={open}
      title="Add searchable columns"
      submitLabel={picked.length > 1 ? `Add ${picked.length}` : 'Add'}
      error={error}
      onClose={close}
      onSubmit={() => {
        if (!layerId) return setError('Choose a layer.')
        if (picked.length === 0) return setError('Check at least one column.')
        for (const column of picked) add({ layerId, fields: [column], labelField: column })
        close()
      }}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="font-medium text-ink">Layer</span>
          <select
            autoFocus
            value={layerId}
            onChange={(e) => {
              setLayerId(e.target.value)
              setPicked([])
            }}
            className={modalInput}
          >
            <option value="" disabled>
              Choose…
            </option>
            {geojsonLayers(files).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? l.id}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block">Layer search reads GeoJSON layers.</span>
        </label>
        {layerId && (
          <fieldset>
            <legend className="font-medium text-ink">Columns</legend>
            {loading && <p className="mt-1.5">Reading columns…</p>}
            {readError && <p className="mt-1.5 text-alarm">Couldn’t read this layer’s columns from the preview: {readError}</p>}
            {!loading && !readError && (
              <div className="mt-1.5">
                <Checklist items={columns} picked={picked} onChange={setPicked} fixed={taken} fixedNote="already searchable" />
              </div>
            )}
            <span className="mt-1.5 block">Each checked column becomes its own entry.</span>
          </fieldset>
        )}
      </div>
    </Modal>
  )
}

function SearchLayerScreen({ index }: { index: number }) {
  const entry = useList<SearchLayer>('search')[index]
  const { remove } = useListEdits('search')
  const layers = useLayers()
  if (!entry) return <Gone>This entry is no longer in settings.json.</Gone>
  const name = layers.find((l) => l.id === entry.layerId)?.name ?? entry.layerId
  return (
    <>
      <ItemSettings
        list="search"
        index={index}
        rows={[
          ['layerId', 'Layer'],
          ['fields', 'Column'],
          ['labelField', 'Label field'],
          ['limit', 'Limit'],
          ['pointZoom', 'Point zoom'],
        ]}
      />
      <RemoveButton label="Remove from search" name={name} onRemove={() => remove(index)} />
    </>
  )
}

// Mapterhorn, a tile URL template or a TileJSON URL, one at a time
// switching writes the other one away
const DEM_KINDS: Record<string, string> = {
  mapterhorn: 'Mapterhorn',
  tiles: 'Tile URL template',
  tilejson: 'TileJSON URL',
}

function DemSourceScreen({ path }: { path: string }) {
  const { files, edit } = useEditor()
  const keys = path.replace(/^settings:/, '').split('.')
  const source = valueAt(files, path) as { tiles?: string[]; url?: string } | undefined
  const kind = source?.url !== undefined ? 'tilejson' : source?.tiles !== undefined ? 'tiles' : 'mapterhorn'
  const url = kind === 'tilejson' ? source?.url : source?.tiles?.[0]
  // edits the source directly, removeAt would prune its parents too
  // a map control's block is its on switch, so it's never created here
  const change = (fn: (source: Record<string, unknown>) => void) =>
    edit('settings', (json) => {
      let parent = json as Record<string, unknown>
      for (const key of keys.slice(0, -1)) {
        if (parent[key] === undefined) {
          if (keys[0] === 'mapControls') return
          parent[key] = {}
        }
        parent = parent[key] as Record<string, unknown>
      }
      const last = keys[keys.length - 1]
      const next = (parent[last] ?? {}) as Record<string, unknown>
      fn(next)
      if (Object.keys(next).length > 0) parent[last] = next
      else delete parent[last]
    })
  return (
    <>
      <Block gap={2}>
        <ControlRow label="Elevation tiles" labelId="dem-kind" wide>
          <Select
            labelledBy="dem-kind"
            value={kind === 'mapterhorn' ? undefined : kind}
            options={Object.keys(DEM_KINDS)}
            labelOf={(k) => DEM_KINDS[k]}
            fallback="mapterhorn"
            onChange={(next) =>
              change((s) => {
                delete s.tiles
                delete s.url
                if (next === 'tiles') s.tiles = [...DEFAULT_DEM_SOURCE.tiles]
                if (next === 'tilejson') s.url = ''
              })
            }
          />
        </ControlRow>
        <div>
          <ControlRow label="URL" labelId="dem-url" wide>
            <TextField
              labelledBy="dem-url"
              value={url || undefined}
              // the URL in use shows in gray, typing one makes it your own
              fallback={kind === 'tilejson' ? undefined : DEFAULT_DEM_SOURCE.tiles[0]}
              onChange={(v) =>
                change((s) => {
                  if (kind === 'tilejson') s.url = v ?? ''
                  else if (v) s.tiles = [v]
                  else delete s.tiles
                })
              }
            />
          </ControlRow>
          {kind === 'tilejson' && !url && <ProblemText>Enter the {DEM_KINDS[kind]}.</ProblemText>}
        </div>
      </Block>
      <PanelSection nested
        section={{
          settings: [
            { path: `${path}.encoding` },
            { path: `${path}.tileSize` },
            { path: `${path}.maxzoom`, label: 'Max zoom' },
          ],
        }}
      />
    </>
  )
}

// map controls' names, from their on/off blocks in the Map Controls group
const CONTROL_NAMES: Record<string, string> = {
  ...Object.fromEntries(
    SETTINGS_MAP.find((g) => g.name === 'Map Controls')!.sections.flatMap((s) =>
      s.toggle && s.name ? [[s.toggle.replace('settings:mapControls.', ''), s.name]] : [],
    ),
  ),
  attribution: 'Credits',
  spin: 'Globe spin',
}

// a control dragged to another corner takes it as its Position
// and a floating widget moves to that corner's slot
function CornersScreen() {
  const { files, edit } = useEditor()
  const labels = Object.fromEntries(useWidgetList().map((w) => [w.id, w.label]))
  const corners = cornerLists(files.settings as Parameters<typeof cornerLists>[0])
  const name = (item: CornerItem) => (item.kind === 'control' ? CONTROL_NAMES[item.key] : (labels[item.id] ?? item.id))
  const identity = (item: CornerItem) => (item.kind === 'control' ? `control:${item.key}` : `widget:${item.id}`)
  const rows = corners.flatMap(({ corner, items }) => [
    { key: `header:${corner}`, title: corner.replace('-', ' ').replace(/^./, (c) => c.toUpperCase()), header: true as const },
    ...items.map((item) => ({
      key: identity(item),
      title: name(item),
      detail: item.kind === 'control' ? 'Map control' : 'Floating widget',
    })),
  ])
  const headers = rows.map((r) => 'header' in r)
  const onMove = (from: number, to: number) => {
    const source = sectionTarget(headers, from, from)
    const target = sectionTarget(headers, from, to)
    if (!source || !target) return
    const item = corners[source.section].items[source.index]
    const corner = corners[target.section].corner
    // the target corner's new order, with the moved item in place
    const order = corners[target.section].items.filter((i) => identity(i) !== identity(item)).map(identity)
    order.splice(target.index, 0, identity(item))
    edit('settings', (json) => {
      const settings = json as Parameters<typeof cornerLists>[0] & Parameters<typeof moveTo>[0]
      if (target.section !== source.section) {
        if (item.kind === 'control') {
          const controls = ((json.mapControls ??= {}) as Record<string, Record<string, unknown>>)
          ;(controls[item.key] ??= {}).position = corner
        } else {
          moveTo(settings, item.id, `floating:${corner}`)
        }
      }
      const now = cornerLists(settings).find((c) => c.corner === corner)?.items ?? []
      const sorted = [...now].sort((x, y) => order.indexOf(identity(x)) - order.indexOf(identity(y)))
      setCornerOrder(json as Parameters<typeof setCornerOrder>[0], sorted)
    })
  }
  return (
    <>
      <PanelNote>
        Map controls and floating widgets stack in each corner of the map. Drag to change the order, or to another corner
        to move one there.
      </PanelNote>
      <SortableList rows={rows} onMove={onMove} />
    </>
  )
}

export function CustomScreen({ entry }: { entry: PanelEntry }) {
  switch (entry.screen) {
    case 'layers':
      return <LayersScreen />
    case 'layer':
      return <LayerScreen id={entry.param!} />
    case 'layer-general':
      return <LayerGeneralScreen id={entry.param!} />
    case 'source-layers':
      return <SourceLayersScreen layerId={entry.param!} />
    case 'source-layer-general':
      return <SourceLayerGeneralScreen param={entry.param!} />
    case 'layer-popup':
      return <PopupScreen param={entry.param!} />
    case 'popup-fields':
      return <PopupFieldsScreen param={entry.param!} />
    case 'popup-field':
      return <PopupFieldScreen param={entry.param!} />
    case 'layer-filters':
      return <FiltersScreen layerId={entry.param!} />
    case 'layer-filter':
      return <FilterScreen param={entry.param!} />
    case 'layer-group':
      return <LayerGroupScreen name={entry.param!} />
    case 'layer-style':
      return <StyleScreen param={entry.param!} />
    case 'layer-labels':
      return <LabelsScreen param={entry.param!} />
    case 'source-layer':
      return <SourceLayerScreen param={entry.param!} />
    case 'basemaps':
      return <BasemapsScreen />
    case 'basemap':
      return <BasemapScreen index={Number(entry.param)} />
    case 'custom-links':
      return <CustomLinksScreen />
    case 'custom-link':
      return <CustomLinkScreen index={Number(entry.param)} />
    case 'search-layers':
      return <SearchLayersScreen />
    case 'search-layer':
      return <SearchLayerScreen index={Number(entry.param)} />
    case 'placement-order':
      return <PlacementLists />
    case 'corners':
      return <CornersScreen />
    case 'dem-source':
      return <DemSourceScreen path={entry.param ?? ''} />
    default:
      return null
  }
}
