import type { ExpressionSpecification } from 'maplibre-gl'
import type {
  ColumnFilterState,
  FilterValue,
  LayerFilterConfig,
  LayerFilterState,
} from '../types'

// all three targets share activeConditions, so they can't disagree

type CompareOp = '=' | '!=' | '>' | '>=' | '<' | '<='

type Condition =
  | { type: 'in'; column: string; values: FilterValue[] }
  | { type: 'compare'; column: string; op: CompareOp; value: number }

// '' is null (not entered yet), anything unparseable is NaN
function parseNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : NaN
}

export type NumericInputStatus = 'empty' | 'incomplete' | 'valid' | 'invalid'

export function numericInputStatus(
  col: Extract<ColumnFilterState, { kind: 'numeric' }>,
): NumericInputStatus {
  const a = parseNumber(col.value)
  if (col.op !== 'between') {
    if (a === null) return 'empty'
    return Number.isNaN(a) ? 'invalid' : 'valid'
  }
  const b = parseNumber(col.value2)
  if (Number.isNaN(a) || Number.isNaN(b)) return 'invalid'
  if (a === null && b === null) return 'empty'
  if (a === null || b === null) return 'incomplete'
  return a > b ? 'invalid' : 'valid'
}

function columnConditions(column: string, col: ColumnFilterState): Condition[] {
  if (!col.enabled) return []
  if (col.kind === 'categorical') {
    return col.selected.length > 0 ? [{ type: 'in', column, values: col.selected }] : []
  }
  if (numericInputStatus(col) !== 'valid') return []
  const a = parseNumber(col.value) as number
  if (col.op === 'between') {
    const b = parseNumber(col.value2) as number
    return [
      { type: 'compare', column, op: '>=', value: a },
      { type: 'compare', column, op: '<=', value: b },
    ]
  }
  return [{ type: 'compare', column, op: col.op, value: a }]
}

export function activeConditions(state: LayerFilterState | undefined): Condition[] {
  if (!state?.enabled) return []
  return Object.entries(state.columns).flatMap(([column, col]) =>
    columnConditions(column, col),
  )
}

export function isFilterActive(state: LayerFilterState | undefined): boolean {
  return activeConditions(state).length > 0
}

export function toExpression(
  state: LayerFilterState | undefined,
): ExpressionSpecification | null {
  const conditions = activeConditions(state)
  if (conditions.length === 0) return null
  const parts = conditions.map((c): unknown => {
    if (c.type === 'in') return ['in', ['get', c.column], ['literal', c.values]]
    const op = c.op === '=' ? '==' : c.op
    return [
      'all',
      ['!=', ['get', c.column], null],
      // to-number('') is 0 on the map and the predicate skips blanks, so match
      ['!=', ['get', c.column], ''],
      [op, ['to-number', ['get', c.column]], c.value],
    ]
  })
  return (parts.length === 1 ? parts[0] : ['all', ...parts]) as ExpressionSpecification
}

export function toPredicate(
  state: LayerFilterState | undefined,
): ((props: Record<string, unknown> | null) => boolean) | null {
  const conditions = activeConditions(state)
  if (conditions.length === 0) return null
  return (props) =>
    conditions.every((c) => {
      const raw = props?.[c.column]
      if (c.type === 'in') return c.values.some((v) => v === raw)
      if (raw === null || raw === undefined || raw === '') return false
      const n = Number(raw)
      if (!Number.isFinite(n)) return false
      switch (c.op) {
        case '=': return n === c.value
        case '!=': return n !== c.value
        case '>': return n > c.value
        case '>=': return n >= c.value
        case '<': return n < c.value
        case '<=': return n <= c.value
      }
    })
}

function whereLiteral(v: FilterValue): string {
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return `'${v.replace(/'/g, "''")}'`
}

export function toWhere(state: LayerFilterState | undefined): string | null {
  const conditions = activeConditions(state)
  if (conditions.length === 0) return null
  return conditions
    .map((c) => {
      if (c.type === 'in') {
        return `(${c.column} IN (${c.values.map(whereLiteral).join(', ')}))`
      }
      const op = c.op === '!=' ? '<>' : c.op
      return `(${c.column} ${op} ${c.value})`
    })
    .join(' AND ')
}

export function andWhere(
  base: string | undefined,
  extra: string | null,
): string | null {
  const parts = [base, extra].filter((p): p is string => !!p && p.trim() !== '')
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return parts.map((p) => `(${p})`).join(' AND ')
}

// a bookmark's saved filter, minus columns gone or changed kind
export function restorableFilter(
  saved: LayerFilterState,
  config: LayerFilterConfig[],
): { state: LayerFilterState | undefined; dropped: { column: string; why: string }[] } {
  const columns: Record<string, ColumnFilterState> = {}
  const dropped: { column: string; why: string }[] = []
  for (const [column, filter] of Object.entries(saved.columns)) {
    const now = config.find((c) => c.column === column)
    if (!now) dropped.push({ column, why: 'no longer a filter column' })
    else if (now.kind !== filter.kind) dropped.push({ column, why: `now ${now.kind}` })
    else columns[column] = filter
  }
  const state = Object.keys(columns).length > 0 ? { enabled: saved.enabled, columns } : undefined
  return { state, dropped }
}
