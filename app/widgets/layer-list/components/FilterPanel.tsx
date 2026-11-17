import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useStore } from '@/core/store'
import { updateLayerFilter } from '@/core/filters/apply'
import { numericInputStatus } from '@/core/filters/compile'
import { ToggleSwitch } from '@/ui/ToggleSwitch'
import { ChevronIcon } from '@/ui/icons'
import { IconButton } from '@/ui/IconButton'
import { Spinner } from '@/ui/Spinner'
import type {
  ColumnFilterState,
  FilterValue,
  LayerFilterConfig,
  LayerFilterHandler,
  LayerFilterState,
  LayerMetadata,
  NumericFilterOp,
} from '@/core/types'

type CategoricalState = Extract<ColumnFilterState, { kind: 'categorical' }>
type NumericState = Extract<ColumnFilterState, { kind: 'numeric' }>

const SEARCH_THRESHOLD = 10
// esri refetches on every apply
const NUMERIC_COMMIT_DELAY_MS = 400

const NUMERIC_OPS: { op: NumericFilterOp; label: string }[] = [
  { op: '>', label: '>' },
  { op: '>=', label: '≥' },
  { op: '<', label: '<' },
  { op: '<=', label: '≤' },
  { op: '=', label: '=' },
  { op: '!=', label: '≠' },
  { op: 'between', label: 'between' },
]

// columns start off, the user builds each filter, then turns it on
function defaultColumnState(config: LayerFilterConfig): ColumnFilterState {
  return config.kind === 'categorical'
    ? { kind: 'categorical', enabled: false, selected: [] }
    : { kind: 'numeric', enabled: false, op: '>', value: '', value2: '' }
}

export function FilterPanel({
  metadata,
  onBack,
}: {
  metadata: LayerMetadata
  onBack: () => void
}) {
  const layerId = metadata.id
  const configs = metadata.filters ?? []
  const stored = useStore((s) => s.layerFilters[layerId])
  const handler = useStore((s) => s.layerFilterHandlers[layerId])

  const state: LayerFilterState = stored ?? { enabled: false, columns: {} }
  const columnState = (config: LayerFilterConfig): ColumnFilterState => {
    const existing = state.columns[config.column]
    return existing && existing.kind === config.kind ? existing : defaultColumnState(config)
  }

  const setColumn = (column: string, next: ColumnFilterState) => {
    updateLayerFilter(layerId, {
      ...state,
      columns: { ...state.columns, [column]: next },
    })
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-panelBorder bg-panelBg px-2 py-1.5">
        <IconButton label="Back to layers" onClick={onBack}>
          <ChevronIcon direction="left" />
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-large font-semibold text-text" title={metadata.name}>
          Filter · {metadata.name}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-panelBorder bg-surface px-3 py-2">
        <span className="flex-1 text-medium font-medium text-strongText">Filter this layer</span>
        <ToggleSwitch
          checked={state.enabled}
          onChange={(enabled) => updateLayerFilter(layerId, { ...state, enabled })}
          ariaLabel={`Filter ${metadata.name}`}
        />
      </div>

      {configs.map((config) => {
        const col = columnState(config)
        const label = config.label ?? config.column
        return (
          <div key={config.column} className="border-b border-panelBorder px-3 py-2">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-medium font-medium text-strongText" title={label}>
                {label}
              </span>
              <ToggleSwitch
                checked={col.enabled}
                onChange={(enabled) => setColumn(config.column, { ...col, enabled })}
                ariaLabel={`Filter by ${label}`}
              />
            </div>
            {col.kind === 'categorical' ? (
              <CategoricalFilter
                label={label}
                column={config.column}
                handler={handler}
                state={col}
                onChange={(next) => setColumn(config.column, next)}
              />
            ) : (
              <NumericFilter
                label={label}
                state={col}
                onChange={(next) => setColumn(config.column, next)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CategoricalFilter({
  label,
  column,
  handler,
  state,
  onChange,
}: {
  label: string
  column: string
  // undefined until the layer registers, so keep spinning
  handler: LayerFilterHandler | undefined
  state: CategoricalState
  onChange: (next: CategoricalState) => void
}) {
  const [values, setValues] = useState<FilterValue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // changes only on re-register, values cached per layer and column
  useEffect(() => {
    if (!handler) return
    let cancelled = false
    handler
      .getValues(column)
      .then((v) => {
        if (cancelled) return
        setValues(v)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [handler, column])

  if (error) {
    return <div className="text-medium text-danger">Couldn't load values: {error}</div>
  }
  if (!values) {
    return (
      <div className="flex items-center gap-2 py-1 text-medium text-text">
        <Spinner />
        Loading values…
      </div>
    )
  }
  if (values.length === 0) {
    return <div className="text-medium text-text">No values found.</div>
  }

  const isSelected = (v: FilterValue) => state.selected.some((s) => s === v)
  const toggle = (v: FilterValue) =>
    onChange({
      ...state,
      selected: isSelected(v) ? state.selected.filter((s) => s !== v) : [...state.selected, v],
    })

  // checked values stay on top regardless of the search
  const q = query.trim().toLowerCase()
  const checked = values.filter(isSelected)
  const unchecked = values.filter(
    (v) => !isSelected(v) && (q === '' || String(v).toLowerCase().includes(q)),
  )

  const row = (v: FilterValue) => (
    <label
      key={`${typeof v}:${String(v)}`}
      className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-medium text-text hover:bg-text/5"
    >
      <input
        type="checkbox"
        checked={isSelected(v)}
        onChange={() => toggle(v)}
        className="accent-[var(--color-primary)]"
      />
      <span className="min-w-0 flex-1 truncate" title={String(v)}>
        {String(v)}
      </span>
    </label>
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-hidden rounded border border-panelBorder">
        {values.length > SEARCH_THRESHOLD && (
          <div className="border-b border-panelBorder bg-surface p-1.5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label={`Search ${label} values`}
              className="w-full rounded-full border border-panelBorder bg-panelBg px-2.5 py-1 text-medium text-text outline-none focus:border-primary"
            />
          </div>
        )}
        <div className="kit-scrollbar max-h-32 overflow-y-auto py-0.5">
          {checked.map(row)}
          {checked.length > 0 && unchecked.length > 0 && (
            <div className="mx-1.5 my-0.5 border-t border-panelBorder" />
          )}
          {unchecked.map(row)}
          {checked.length === 0 && unchecked.length === 0 && (
            <div className="px-1.5 py-1 text-medium text-text">No matches.</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 text-medium text-text">
        <span>{state.selected.length} selected</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => onChange({ ...state, selected: [] })}
          disabled={state.selected.length === 0}
          className="text-primary hover:underline disabled:cursor-default disabled:text-text disabled:no-underline"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

function NumericFilter({
  label,
  state,
  onChange,
}: {
  label: string
  state: NumericState
  onChange: (next: NumericState) => void
}) {
  // commits on Enter, blur or pause, flushed on unmount so Back keeps it
  const [draft, setDraft] = useState({ value: state.value, value2: state.value2 })
  // store changed underneath (bookmark restore): drop the stale draft
  const [seen, setSeen] = useState(state)
  if (state.value !== seen.value || state.value2 !== seen.value2) {
    setSeen(state)
    setDraft({ value: state.value, value2: state.value2 })
  }
  const latest = useRef({ state, onChange, draft })
  useEffect(() => {
    latest.current = { state, onChange, draft }
  })

  const commit = useCallback(() => {
    const { state: current, onChange: change, draft: d } = latest.current
    if (d.value === current.value && d.value2 === current.value2) return
    change({ ...current, value: d.value, value2: d.value2 })
  }, [])

  useEffect(() => {
    const timer = setTimeout(commit, NUMERIC_COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, commit])

  useEffect(() => commit, [commit])

  const invalid = numericInputStatus({ ...state, ...draft }) === 'invalid'
  const inputClass =
    'min-w-0 flex-1 rounded border px-2 py-1 text-medium text-text outline-none ' +
    (invalid ? 'border-danger' : 'border-panelBorder focus:border-primary')

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={state.op}
          onChange={(e) =>
            onChange({ ...state, ...draft, op: e.target.value as NumericFilterOp })
          }
          aria-label={`${label} operator`}
          className="shrink-0 rounded border border-panelBorder bg-panelBg px-1.5 py-1 text-medium text-text outline-none focus:border-primary"
        >
          {NUMERIC_OPS.map(({ op, label: opLabel }) => (
            <option key={op} value={op}>
              {opLabel}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          value={draft.value}
          onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          onBlur={() => commit()}
          onKeyDown={onKeyDown}
          placeholder={state.op === 'between' ? 'min' : 'value'}
          aria-label={state.op === 'between' ? `${label} minimum` : `${label} value`}
          aria-invalid={invalid}
          className={inputClass}
        />
      </div>
      {state.op === 'between' && (
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 pl-1 text-medium text-text">and</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.value2}
            onChange={(e) => setDraft((d) => ({ ...d, value2: e.target.value }))}
            onBlur={() => commit()}
            onKeyDown={onKeyDown}
            placeholder="max"
            aria-label={`${label} maximum`}
            aria-invalid={invalid}
            className={inputClass}
          />
        </div>
      )}
    </div>
  )
}
