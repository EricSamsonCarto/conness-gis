import { useEffect, useRef, useState } from 'react'
import { useMap, useMapReady, useMapClickLock } from '@/core/hooks'
import { widgetSettings } from '@/core/widgetSettings'
import type { MeasureSettings } from './settings'
import { InfoSection } from '@/ui/InfoSection'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import {
  MeasureController,
  getMeasurePrefs,
  setMeasurePrefs,
  type MeasureTool,
  type Measurement,
  type LiveState,
} from './lib/MeasureController'
import {
  LINEAR_UNITS,
  AREA_UNITS,
  formatLinear,
  formatArea,
  type LinearUnit,
  type AreaUnit,
} from './lib/units'
import { TrashIcon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { ActionButton } from '@/ui/ActionButton'
import { EmptyState } from '@/ui/EmptyState'
import { ItemRow, ItemRowLabel } from '@/ui/ItemRow'
import { ToolButtonGrid, type Tool } from '@/ui/ToolButtonGrid'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import './assets/measure.css'

const TOOLS: Tool<MeasureTool>[] = [
  {
    id: 'distance',
    label: 'Line',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'freehand-polyline',
    label: 'Freehand Line',
    shortLabel: 'Freehand',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17c3-6 6 2 9-2s5-7 9-4" />
      </svg>
    ),
  },
  {
    id: 'area',
    label: 'Area',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
      </svg>
    ),
  },
  {
    id: 'freehand-polygon',
    label: 'Freehand Area',
    shortLabel: 'Freehand',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
]

const DEFAULT_LINEAR_UNIT: LinearUnit = 'kilometers'
const DEFAULT_AREA_UNIT: AreaUnit = 'square-kilometers'

// read on mount, live changes remount the widget
function measureConfig() {
  const config = widgetSettings<MeasureSettings>('measure')
  const allowedLinear = config?.linearUnits
  const allowedArea = config?.areaUnits
  return {
    initialLinearUnit: (config?.defaultLinearUnit ?? DEFAULT_LINEAR_UNIT) as LinearUnit,
    initialAreaUnit: (config?.defaultAreaUnit ?? DEFAULT_AREA_UNIT) as AreaUnit,
    initialShowEdgeLabels: config?.showEdgeLabels ?? false,
    initialShowTotal: config?.showTotal ?? true,
    initialPersistOnClose: config?.persistOnClose ?? false,
    linearOptions:
      allowedLinear && allowedLinear.length > 0
        ? allowedLinear
            .map((v) => LINEAR_UNITS.find((u) => u.value === v))
            .filter((u): u is (typeof LINEAR_UNITS)[number] => u !== undefined)
        : LINEAR_UNITS,
    areaOptions:
      allowedArea && allowedArea.length > 0
        ? allowedArea
            .map((v) => AREA_UNITS.find((u) => u.value === v))
            .filter((u): u is (typeof AREA_UNITS)[number] => u !== undefined)
        : AREA_UNITS,
  }
}

function OptionPill({
  on,
  onToggle,
  title,
  children,
}: {
  on: boolean
  onToggle: () => void
  title: string
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={title}
      className={
        // flex-auto so "Total" gives room to "Keep on Close"
        'flex-auto whitespace-nowrap rounded-full border px-1.5 py-1 text-medium font-medium transition-colors ' +
        (on
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-panelBorder text-text hover:bg-text/10')
      }
    >
      {children}
    </button>
  )
}

// on mobile, no info, tools on one row, the live total above them
export function MeasureWidget({ mobile = false }: { mobile?: boolean }) {
  const { initialLinearUnit, initialAreaUnit, initialShowEdgeLabels, initialShowTotal, initialPersistOnClose, linearOptions, areaOptions } =
    measureConfig()
  const map = useMap()
  const isMapReady = useMapReady()
  const controllerRef = useRef<MeasureController | null>(null)

  const [activeTool, setActiveTool] = useState<MeasureTool | null>(null)

  const defaults = JSON.stringify([initialLinearUnit, initialAreaUnit, initialShowEdgeLabels, initialShowTotal, initialPersistOnClose])
  const savedPrefs = getMeasurePrefs()?.madeWith === defaults ? getMeasurePrefs() : null
  const [linearUnit, setLinearUnit] = useState<LinearUnit>(
    savedPrefs?.linearUnit ?? initialLinearUnit,
  )
  const [areaUnit, setAreaUnit] = useState<AreaUnit>(savedPrefs?.areaUnit ?? initialAreaUnit)
  const [showEdgeLabels, setShowEdgeLabels] = useState(
    savedPrefs?.showEdgeLabels ?? initialShowEdgeLabels,
  )
  const [showTotal, setShowTotal] = useState(savedPrefs?.showTotal ?? initialShowTotal)
  // a ref, the unmount cleanup needs the latest value
  const [persistOnClose, setPersistOnClose] = useState(
    savedPrefs?.persistOnClose ?? initialPersistOnClose,
  )
  const persistRef = useRef(persistOnClose)
  useEffect(() => {
    persistRef.current = persistOnClose
  }, [persistOnClose])
  // creation-time prefs, held once so the controller effect doesn't re-run
  const seedRef = useRef({ linearUnit, areaUnit, showEdgeLabels, showTotal })

  useEffect(() => {
    setMeasurePrefs({ linearUnit, areaUnit, showEdgeLabels, showTotal, persistOnClose, madeWith: defaults })
  }, [linearUnit, areaUnit, showEdgeLabels, showTotal, persistOnClose, defaults])

  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [live, setLive] = useState<LiveState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  useMapClickLock('measure', activeTool !== null || editingId !== null)
  const [pendingClearAll, setPendingClearAll] = useState(false)

  useEffect(() => {
    if (!map || !isMapReady) return
    const controller = new MeasureController(map, {
      ...seedRef.current,
      onLive: setLive,
      onChange: (m) => setMeasurements([...m]),
      onFinish: () => setActiveTool(null),
      onSelect: (id) => {
        setEditingId(id)
        if (id) setActiveTool(null)
      },
    })
    controllerRef.current = controller

    return () => {
      controller.destroy(persistRef.current)
      controllerRef.current = null
    }
  }, [map, isMapReady])

  const pickTool = (tool: MeasureTool) => {
    const next = activeTool === tool ? null : tool
    setActiveTool(next)
    controllerRef.current?.setTool(next)
  }

  const onLinearUnit = (u: LinearUnit) => {
    setLinearUnit(u)
    controllerRef.current?.setLinearUnit(u)
  }
  const onAreaUnit = (u: AreaUnit) => {
    setAreaUnit(u)
    controllerRef.current?.setAreaUnit(u)
  }
  const onToggleEdgeLabels = () => {
    const next = !showEdgeLabels
    setShowEdgeLabels(next)
    controllerRef.current?.setShowEdgeLabels(next)
  }
  const onToggleTotal = () => {
    const next = !showTotal
    setShowTotal(next)
    controllerRef.current?.setShowTotal(next)
  }

  const formatMeasurement = (m: Measurement) =>
    m.kind === 'distance' ? formatLinear(m.rawValue, linearUnit) : formatArea(m.rawValue, areaUnit)

  const liveText = live
    ? live.kind === 'distance'
      ? formatLinear(live.rawValue, linearUnit)
      : formatArea(live.rawValue, areaUnit)
    : null

  const liveBox = live && liveText && (
    <div className="current-alert">
      <strong>Current {live.kind === 'distance' ? 'Distance' : 'Area'}</strong>
      <div className="live-measurement">
        <strong>{liveText}</strong>
      </div>
    </div>
  )

  return (
    <div className="measure-widget">
      <div className="widget-content">
        {!mobile && (
          <InfoSection>
            Pick a tool and click points on the map to measure. Double-click to
            finish a line or area, or press Escape to cancel. The freehand tools draw
            by dragging. To edit a finished measurement, click it on the map or its
            row below, then drag vertices (drag a midpoint to add one, or select a
            vertex and press Delete to remove it). Totals update live.
          </InfoSection>
        )}

        {mobile && liveBox}

        <ToolButtonGrid tools={TOOLS} active={activeTool} onPick={pickTool} row={mobile} />

        <div className="flex shrink-0 gap-1">
          <OptionPill on={showEdgeLabels} onToggle={onToggleEdgeLabels} title="Show a length label on every segment">
            Edge Labels
          </OptionPill>
          <OptionPill on={showTotal} onToggle={onToggleTotal} title="Show the total length or area on the map">
            Total
          </OptionPill>
          <OptionPill
            on={persistOnClose}
            onToggle={() => setPersistOnClose(!persistOnClose)}
            title="Leave finished measurements on the map after closing this widget"
          >
            Keep on Close
          </OptionPill>
        </div>

        <div className="unit-selectors">
          <div className="unit-group">
            <label className="unit-label">Linear Unit</label>
            <select value={linearUnit} onChange={(e) => onLinearUnit(e.target.value as LinearUnit)}>
              {linearOptions.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className="unit-group">
            <label className="unit-label">Area Unit</label>
            <select value={areaUnit} onChange={(e) => onAreaUnit(e.target.value as AreaUnit)}>
              {areaOptions.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!mobile && liveBox}

        <div className="flex shrink-0">
          <ActionButton
            variant="danger"
            onClick={() => setPendingClearAll(true)}
            disabled={measurements.length === 0}
          >
            <TrashIcon size={14} />
            Clear All
          </ActionButton>
        </div>

        <div className="measurements-list">
          {measurements.length === 0 ? (
            <EmptyState title="No measurements yet" hint="Click a tool and start drawing on the map" />
          ) : (
            measurements.map((m) => (
              <ItemRow
                key={m.id}
                active={editingId === m.id}
                onMouseEnter={() => controllerRef.current?.setHighlight(m.id)}
                onMouseLeave={() => controllerRef.current?.setHighlight(null)}
              >
                <ItemRowLabel
                  color={m.color}
                  onClick={() => controllerRef.current?.editMeasurement(m.id)}
                  title="Click to edit this measurement's geometry"
                >
                  <span>
                    {m.label}, {m.kind === 'distance' ? 'total length' : 'total area'}:{' '}
                    <b>{formatMeasurement(m)}</b>
                  </span>
                </ItemRowLabel>
                <IconButton
                  label={`Delete ${m.label}`}
                  variant="danger"
                  onClick={() => controllerRef.current?.deleteMeasurement(m.id)}
                >
                  <TrashIcon />
                </IconButton>
              </ItemRow>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingClearAll}
        title="Clear all measurements?"
        message="Remove every measurement from the map? This can't be undone."
        confirmLabel="Clear All"
        onConfirm={() => {
          controllerRef.current?.clearAll()
          setPendingClearAll(false)
        }}
        onCancel={() => setPendingClearAll(false)}
      />
    </div>
  )
}
