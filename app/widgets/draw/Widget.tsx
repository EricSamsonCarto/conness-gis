import { useEffect, useMemo, useRef, useState } from 'react'
import { widgetSettings } from '@/core/widgetSettings'
import type { DrawSettings } from './settings'
import { useMap, useMapReady, useMapClickLock } from '@/core/hooks'
import { useStore } from '@/core/store'
import { InfoSection } from '@/ui/InfoSection'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import {
  DrawController,
  DRAW_PALETTE,
  DRAWINGS_LAYER_ID,
  getDrawingsBounds,
  type DrawTool,
  type Drawing,
  type DrawStyle,
  type DrawingSetPayload,
} from './lib/DrawController'
import type { LayerMetadata } from '@/core/types'
import { allowedExportFormats, downloadFile, downloadGeoJSON } from '@/core/export/download'
import { toGeoParquet } from '@/core/export/writeGeoParquet'
import { drawingsToGeoJSON } from './lib/exportGeoJSON'
import { drawingsToKML } from './lib/exportKML'
import { ChoiceDialog } from '@/ui/ChoiceDialog'
import { Spinner } from '@/ui/Spinner'
import { TrashIcon, DownloadIcon, EditNameIcon, CheckIcon, ChevronIcon } from '@/ui/icons'
import { useSavedItems } from '@/ui/useSavedItems'
import { RenameInput } from '@/ui/RenameInput'
import { IconButton } from '@/ui/IconButton'
import { ActionButton } from '@/ui/ActionButton'
import { EmptyState } from '@/ui/EmptyState'
import { ItemRow, ItemRowLabel } from '@/ui/ItemRow'
import { ToolButtonGrid, type Tool } from '@/ui/ToolButtonGrid'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import './assets/draw.css'

interface DrawingSet {
  id: string
  name: string
  payload: DrawingSetPayload
}

function drawingsMetadata(existing: LayerMetadata | undefined): LayerMetadata {
  return {
    id: DRAWINGS_LAYER_ID,
    name: 'Drawings',
    visible: existing?.visible ?? true,
    opacity: existing?.opacity ?? 1,
    symbology: { kind: 'simple', color: '#3b82f6' },
    // text is geometry, it toggles with the layer, no labels button
    labelIsGeometry: true,
    // per-drawing transparency lives in the style panel
    actions: { opacity: false },
  }
}

// read each time, live changes remount the widget
const config = () => widgetSettings<DrawSettings>('draw')
// 0 or less means no cap
const maxSavedSets = () => config()?.maxCount ?? 50
// no CSV, drawings have no attribute table
const exportFormats = () => allowedExportFormats(config()?.exportFormats, ['geojson', 'kml', 'geoparquet'])

const TOOLS: Tool<DrawTool>[] = [
  {
    id: 'point',
    label: 'Point',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="8" strokeWidth={2} />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4m-4 0h4v4" />
      </svg>
    ),
  },
  {
    id: 'polygon',
    label: 'Polygon',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l9 6.5-3.5 10.5h-11L3 9.5z" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5h16v2M9 19h6M12 5v14" />
      </svg>
    ),
  },
]

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  // older saved sets may lack a color, the native input needs hex
  const safe = value || '#3b82f6'
  return (
    <div className="style-field">
      <label className="style-label">{label}</label>
      <div className="swatch-row">
        <label className="swatch custom" title="Pick your own color" style={{ backgroundColor: safe }}>
          <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} />
        </label>
        {DRAW_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${safe.toLowerCase() === c.toLowerCase() ? ' active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
    </div>
  )
}

function ShadowField({
  style,
  onChange,
}: {
  style: DrawStyle
  onChange: (patch: Partial<DrawStyle>) => void
}) {
  return (
    <div className="style-field">
      <label className="flex cursor-pointer items-center gap-2 text-medium font-medium text-text">
        <input
          type="checkbox"
          checked={style.shadow}
          onChange={(e) => onChange({ shadow: e.target.checked })}
          className="accent-[var(--color-primary)]"
        />
        Drop shadow
      </label>
      {style.shadow && (
        <>
          <label className="style-label">
            Shadow intensity: {Math.round(style.shadowIntensity * 100)}%
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={style.shadowIntensity}
            onChange={(e) => onChange({ shadowIntensity: Number(e.target.value) })}
            aria-label="Shadow intensity"
          />
        </>
      )}
    </div>
  )
}

// mobile (Widget.mobile.tsx): no info, the tools on one row
export function DrawWidget({ mobile = false }: { mobile?: boolean }) {
  const map = useMap()
  const isMapReady = useMapReady()
  const controllerRef = useRef<DrawController | null>(null)

  const [activeTool, setActiveTool] = useState<DrawTool | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  useMapClickLock('draw', activeTool !== null || editingId !== null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const savedSets = useSavedItems<DrawingSet>('drawings', { maxCount: maxSavedSets() })
  const [limitHit, setLimitHit] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [savedOpen, setSavedOpen] = useState(false)
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)
  const [pendingSetDeleteId, setPendingSetDeleteId] = useState<string | null>(null)
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null)
  const [pendingLoad, setPendingLoad] = useState<DrawingSet | null>(null)
  const [pendingClearAll, setPendingClearAll] = useState(false)
  const [pendingExport, setPendingExport] = useState<{ name: string; payload: DrawingSetPayload } | null>(null)
  const [exporting, setExporting] = useState(false)

  const setLayerMetadata = useStore((s) => s.setLayerMetadata)
  const removeLayerMetadata = useStore((s) => s.removeLayerMetadata)
  const setLayerBoundsGetter = useStore((s) => s.setLayerBoundsGetter)

  const drawingsVisibleRef = useRef(true)
  const drawingsOpacityRef = useRef(1)
  // before the first report, [] would drop the layer-list entry
  const reportedRef = useRef(false)

  useEffect(() => {
    if (!map || !isMapReady) return
    const controller = new DrawController(map, {
      onChange: (d) => {
        reportedRef.current = true
        setDrawings([...d])
      },
      onFinish: () => setActiveTool(null),
      onSelect: (id) => {
        setEditingId(id)
        // collapse saved sets to make room for the style panel
        if (id) {
          setActiveTool(null)
          setSavedOpen(false)
        }
      },
      defaultStyle: config()?.defaultStyle,
    })
    controllerRef.current = controller

    return () => {
      controller.destroy(true, drawingsVisibleRef.current, drawingsOpacityRef.current)
      controllerRef.current = null
    }
  }, [map, isMapReady])

  useEffect(() => {
    if (!reportedRef.current) return
    if (drawings.length > 0) {
      const existing = useStore.getState().layerMetadata[DRAWINGS_LAYER_ID]
      const meta = drawingsMetadata(existing)
      drawingsVisibleRef.current = meta.visible
      drawingsOpacityRef.current = meta.opacity
      setLayerMetadata(DRAWINGS_LAYER_ID, meta)
      setLayerBoundsGetter(DRAWINGS_LAYER_ID, async () => getDrawingsBounds())
    } else {
      removeLayerMetadata(DRAWINGS_LAYER_ID)
      setLayerBoundsGetter(DRAWINGS_LAYER_ID, undefined)
    }
  }, [drawings, setLayerMetadata, removeLayerMetadata, setLayerBoundsGetter])

  // refs, the unmount cleanup would capture stale values
  const drawingsMeta = useStore((s) => s.layerMetadata[DRAWINGS_LAYER_ID])
  useEffect(() => {
    if (drawingsMeta) {
      drawingsVisibleRef.current = drawingsMeta.visible
      drawingsOpacityRef.current = drawingsMeta.opacity
    }
  }, [drawingsMeta])

  const selected = editingId ? drawings.find((d) => d.id === editingId) ?? null : null

  const tools = useMemo(() => {
    const allowed = config()?.tools
    if (!allowed || allowed.length === 0) return TOOLS
    return allowed
      .map((id) => TOOLS.find((t) => t.id === id))
      .filter((t): t is Tool<DrawTool> => t !== undefined)
  }, [])

  const pickTool = (tool: DrawTool) => {
    const next = activeTool === tool ? null : tool
    setActiveTool(next)
    controllerRef.current?.setTool(next)
  }

  const setStyle = (id: string, patch: Partial<DrawStyle>) =>
    controllerRef.current?.setDrawingStyle(id, patch)

  const confirmDelete = (id: string) => {
    controllerRef.current?.deleteDrawing(id)
    setPendingDeleteId(null)
  }

  const saveCurrentSet = () => {
    const name = saveName.trim()
    const controller = controllerRef.current
    if (!name || !controller) return
    if (savedSets.findByName(name)) {
      setPendingOverwrite(name)
      return
    }
    if (!savedSets.add(name, { payload: controller.exportDrawings() })) {
      setLimitHit(true)
      return
    }
    setLimitHit(false)
    setSaveName('')
  }
  const confirmOverwrite = () => {
    const controller = controllerRef.current
    if (!pendingOverwrite || !controller) return
    savedSets.replace(pendingOverwrite, { payload: controller.exportDrawings() })
    setPendingOverwrite(null)
    setSaveName('')
  }

  const loadSet = (set: DrawingSet) => {
    if (drawings.length > 0) {
      setPendingLoad(set)
    } else {
      controllerRef.current?.loadDrawings(set.payload)
    }
  }
  const confirmLoad = () => {
    if (pendingLoad) controllerRef.current?.loadDrawings(pendingLoad.payload)
    setPendingLoad(null)
  }
  const confirmSetDelete = (id: string) => {
    savedSets.remove(id)
    setPendingSetDeleteId(null)
  }

  const startExport = (target: { name: string; payload: DrawingSetPayload }) => {
    if (exportFormats().length === 1) void runExport(exportFormats()[0].id, target)
    else setPendingExport(target)
  }
  const exportCurrent = () => {
    const controller = controllerRef.current
    if (!controller || drawings.length === 0) return
    startExport({ name: 'drawings', payload: controller.exportDrawings() })
  }
  const exportSet = (set: DrawingSet) => startExport({ name: set.name, payload: set.payload })

  const runExport = async (format: string, { name, payload }: { name: string; payload: DrawingSetPayload }) => {
    setPendingExport(null)
    if (format === 'geojson') downloadGeoJSON(drawingsToGeoJSON(payload), name)
    if (format === 'kml') {
      downloadFile(drawingsToKML(payload, name), name, 'kml', 'application/vnd.google-earth.kml+xml')
    }
    if (format === 'geoparquet') {
      setExporting(true)
      try {
        downloadFile(await toGeoParquet(drawingsToGeoJSON(payload)), name, 'parquet', 'application/vnd.apache.parquet')
      } catch (err) {
        console.warn(
          `[conness-gis] GeoParquet export failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        setExporting(false)
      }
    }
  }

  // in edit mode only the edited row shows, to make room for the style panel
  const visibleDrawings = selected ? drawings.filter((d) => d.id === selected.id) : drawings

  return (
    <div className="draw-widget">
      <div className="widget-content">
        {!mobile && (
          <InfoSection>
            Pick a tool and draw on the map. Click to place points/text. For lines
            and polygons, click to add vertices and double-click (or Enter) to
            finish. Escape cancels. Click a drawing (or its row) to edit its
            geometry and style. Drawings persist as a “Drawings” layer. Save sets to
            your browser under Saved Drawings, or download your drawings or any
            saved set as a file.
          </InfoSection>
        )}

        <ToolButtonGrid tools={tools} active={activeTool} onPick={pickTool} row={mobile} />

        {selected && (
          <div className="style-panel">
            <div className="style-panel-header">
              <span>Edit: {selected.name}</span>
              <button
                type="button"
                className="style-panel-done"
                onClick={() => controllerRef.current?.deselect()}
                title="Done editing"
                aria-label="Done editing"
              >
                <CheckIcon size={20} />
              </button>
            </div>

            <ColorField
              label={selected.kind === 'polygon' ? 'Fill color' : 'Color'}
              value={selected.style.color}
              onChange={(c) => setStyle(selected.id, { color: c })}
            />

            {selected.kind === 'polygon' && (
              <>
                <ColorField
                  label="Boundary color"
                  value={selected.style.boundaryColor}
                  onChange={(c) => setStyle(selected.id, { boundaryColor: c })}
                />
                <div className="style-field">
                  <label className="style-label">Boundary width: {selected.style.width}px</label>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={selected.style.width}
                    onChange={(e) => setStyle(selected.id, { width: Number(e.target.value) })}
                  />
                </div>
                <div className="style-field">
                  <label className="style-label">
                    Boundary opacity: {Math.round(selected.style.boundaryOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selected.style.boundaryOpacity}
                    onChange={(e) => setStyle(selected.id, { boundaryOpacity: Number(e.target.value) })}
                  />
                </div>
                <div className="style-field">
                  <label className="style-label">
                    Fill opacity: {Math.round(selected.style.fillOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selected.style.fillOpacity}
                    onChange={(e) => setStyle(selected.id, { fillOpacity: Number(e.target.value) })}
                  />
                </div>
                <ShadowField style={selected.style} onChange={(p) => setStyle(selected.id, p)} />
              </>
            )}

            {selected.kind === 'line' && (
              <>
                <div className="style-field">
                  <label className="style-label">Width: {selected.style.width}px</label>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={selected.style.width}
                    onChange={(e) => setStyle(selected.id, { width: Number(e.target.value) })}
                  />
                </div>
                <ShadowField style={selected.style} onChange={(p) => setStyle(selected.id, p)} />
              </>
            )}

            {selected.kind === 'point' && (
              <>
                <div className="style-field">
                  <label className="style-label">Size: {selected.style.radius}px</label>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    step={1}
                    value={selected.style.radius}
                    onChange={(e) => setStyle(selected.id, { radius: Number(e.target.value) })}
                  />
                </div>
                <ColorField
                  label="Halo color"
                  value={selected.style.strokeColor}
                  onChange={(c) => setStyle(selected.id, { strokeColor: c })}
                />
                <div className="style-field">
                  <label className="style-label">Halo width: {selected.style.strokeWidth}px</label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={selected.style.strokeWidth}
                    onChange={(e) => setStyle(selected.id, { strokeWidth: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            {selected.kind === 'text' && (
              <>
                <div className="style-field">
                  <label className="style-label">Text</label>
                  <input
                    type="text"
                    className="text-input"
                    value={selected.style.text ?? ''}
                    placeholder="Label text"
                    onChange={(e) => setStyle(selected.id, { text: e.target.value })}
                  />
                </div>
                <div className="style-field">
                  <label className="style-label">Font size: {selected.style.fontSize}px</label>
                  <input
                    type="range"
                    min={10}
                    max={48}
                    step={1}
                    value={selected.style.fontSize}
                    onChange={(e) => setStyle(selected.id, { fontSize: Number(e.target.value) })}
                  />
                </div>
                <ColorField
                  label="Halo color"
                  value={selected.style.strokeColor}
                  onChange={(c) => setStyle(selected.id, { strokeColor: c })}
                />
                <div className="style-field">
                  <label className="style-label">Halo width: {selected.style.strokeWidth}px</label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={selected.style.strokeWidth}
                    onChange={(e) => setStyle(selected.id, { strokeWidth: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {!selected && (
          <div className="flex shrink-0 gap-2">
            <ActionButton
              variant="danger"
              onClick={() => setPendingClearAll(true)}
              disabled={drawings.length === 0}
            >
              <TrashIcon size={14} />
              Clear All
            </ActionButton>
            <ActionButton
              variant="neutral"
              onClick={exportCurrent}
              disabled={drawings.length === 0 || exporting}
              title={drawings.length === 0 ? 'Draw something first' : 'Download drawings'}
            >
              {exporting ? <Spinner size={14} /> : <DownloadIcon size={14} />}
              Download
            </ActionButton>
          </div>
        )}

        <div className="drawings-list">
          {drawings.length === 0 ? (
            <EmptyState title="No drawings yet" hint="Click a tool and start drawing on the map" />
          ) : (
            visibleDrawings.map((d) => (
              <ItemRow
                key={d.id}
                active={editingId === d.id}
                onMouseEnter={() => controllerRef.current?.setHighlight(d.id)}
                onMouseLeave={() => controllerRef.current?.setHighlight(null)}
              >
                {renamingId === d.id ? (
                  <RenameInput
                    initial={d.name}
                    ariaLabel={`Rename ${d.name}`}
                    onCommit={(name) => {
                      controllerRef.current?.renameDrawing(d.id, name)
                      setRenamingId(null)
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                ) : (
                  <ItemRowLabel
                    color={d.style.color}
                    onClick={() => controllerRef.current?.editDrawing(d.id)}
                    title="Click to edit this drawing"
                  >
                    {d.name}
                  </ItemRowLabel>
                )}
                <IconButton label={`Rename ${d.name}`} onClick={() => setRenamingId(d.id)}>
                  <EditNameIcon />
                </IconButton>
                <IconButton
                  label={`Delete ${d.name}`}
                  variant="danger"
                  onClick={() => setPendingDeleteId(d.id)}
                >
                  <TrashIcon />
                </IconButton>
              </ItemRow>
            ))
          )}
        </div>

        <div className="saved-sets">
          <button
            type="button"
            className="saved-sets-header"
            onClick={() => setSavedOpen((v) => !v)}
            aria-expanded={savedOpen}
          >
            <ChevronIcon size={14} className={`saved-chevron${savedOpen ? ' open' : ''}`} />
            Saved Drawings
            {savedSets.items.length > 0 && (
              <span className="saved-count">{savedSets.items.length}</span>
            )}
          </button>

          {savedOpen && (
            <div className="saved-body">
              <div className="save-row">
                <input
                  type="text"
                  className="save-name-input"
                  value={saveName}
                  placeholder="Name these drawings…"
                  onChange={(e) => {
                    setSaveName(e.target.value)
                    if (pendingOverwrite) setPendingOverwrite(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrentSet()
                  }}
                />
                <ActionButton
                  variant="save"
                  onClick={saveCurrentSet}
                  disabled={!saveName.trim() || drawings.length === 0}
                  title={drawings.length === 0 ? 'Draw something first' : 'Save current drawings'}
                >
                  Save
                </ActionButton>
              </div>
              {limitHit && savedSets.full && (
                <p role="alert" className="text-medium text-danger">
                  No more drawing sets can be saved: the limit is {maxSavedSets()}. Delete one to save another.
                </p>
              )}
              {savedSets.saveFailed && (
                <p role="alert" className="text-medium text-danger">
                  Couldn't save to this browser (storage full or blocked). Saved drawings will be lost on reload.
                </p>
              )}

              {savedSets.items.map((s) => (
                <ItemRow key={s.id}>
                  {renamingSetId === s.id ? (
                    <RenameInput
                      initial={s.name}
                      ariaLabel={`Rename set ${s.name}`}
                      onCommit={(name) => {
                        savedSets.rename(s.id, name)
                        setRenamingSetId(null)
                      }}
                      onCancel={() => setRenamingSetId(null)}
                    />
                  ) : (
                    <ItemRowLabel
                      onClick={() => loadSet(s)}
                      title={`Load "${s.name}" (replaces current drawings)`}
                    >
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="set-count">{s.payload.features.length}</span>
                    </ItemRowLabel>
                  )}
                  <IconButton label={`Rename set ${s.name}`} onClick={() => setRenamingSetId(s.id)}>
                    <EditNameIcon />
                  </IconButton>
                  <IconButton label={`Download set ${s.name}`} onClick={() => exportSet(s)} disabled={exporting}>
                    <DownloadIcon />
                  </IconButton>
                  <IconButton
                    label={`Delete set ${s.name}`}
                    variant="danger"
                    onClick={() => setPendingSetDeleteId(s.id)}
                  >
                    <TrashIcon />
                  </IconButton>
                </ItemRow>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* at the root so dialogs center over the widget, not a scrolled list */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete drawing?"
        message="Delete this drawing? This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteId && confirmDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ChoiceDialog
        open={pendingExport !== null}
        title={pendingExport?.name === 'drawings' ? 'Download drawings' : `Download “${pendingExport?.name}”`}
        choices={exportFormats()}
        onChoose={(id) => {
          if (pendingExport) void runExport(id, pendingExport)
        }}
        onCancel={() => setPendingExport(null)}
      />
      <ConfirmDialog
        open={pendingClearAll}
        title="Clear all drawings?"
        message="Remove every drawing from the map? Unsaved drawings can't be recovered."
        confirmLabel="Clear All"
        onConfirm={() => {
          controllerRef.current?.clearAll()
          setPendingClearAll(false)
        }}
        onCancel={() => setPendingClearAll(false)}
      />
      <ConfirmDialog
        open={pendingOverwrite !== null}
        title="Overwrite saved drawing?"
        message={<>“{pendingOverwrite}” already exists. Overwrite it with the current drawings?</>}
        confirmLabel="Overwrite"
        onConfirm={confirmOverwrite}
        onCancel={() => setPendingOverwrite(null)}
      />
      <ConfirmDialog
        open={pendingSetDeleteId !== null}
        title="Delete saved drawing?"
        message={
          <>
            Delete “{savedSets.items.find((s) => s.id === pendingSetDeleteId)?.name}”?
            This can't be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => pendingSetDeleteId && confirmSetDelete(pendingSetDeleteId)}
        onCancel={() => setPendingSetDeleteId(null)}
      />
      <ConfirmDialog
        open={pendingLoad !== null}
        title="Load saved drawing?"
        message={
          <>
            Loading “{pendingLoad?.name}” will replace your current drawings.
            Unsaved work will be lost.
          </>
        }
        confirmLabel="Load"
        variant="default"
        onConfirm={confirmLoad}
        onCancel={() => setPendingLoad(null)}
      />
    </div>
  )
}
