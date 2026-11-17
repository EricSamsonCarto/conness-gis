import { useMemo } from 'react'
import { settings } from '@user/settings'
import { useStore } from '@/core/store'
import { legendForLayer, type LegendSwatch } from '@/core/legend/introspect'
import type { SizeStops } from '@/core/legend/sizes'
import { resolveSymbology } from '@/core/layers/symbology'
import type { LayerGeometryType, LayerMetadata } from '@/core/types'
import { EmptyState } from '@/ui/EmptyState'

// fixed so layer names line up whatever the swatch shape
const SWATCH_COL_PX = 30
// big dots are capped to fit the panel, their labels keep the real values
const MAX_DOT_PX = 28

function sortBucket(layer: LayerMetadata): number {
  // custom legends sort with raw ones
  if (layer.legend || resolveSymbology(layer.symbology!).kind === 'raw') return 0
  switch (layer.geometryType) {
    case 'point':
      return 1
    case 'line':
      return 2
    case 'polygon':
      return 3
    default:
      // untyped last so neutral squares don't split the typed groups
      return 4
  }
}

function visibleLayersSorted(metadata: Record<string, LayerMetadata>): LayerMetadata[] {
  const out: LayerMetadata[] = []
  for (const layer of settings.layers) {
    const m = metadata[layer.id]
    // neither symbology nor `legend`: raster / default-styled esri
    if (m?.visible && (m.symbology || m.legend) && !m.hideFromLegend) out.push(m)
  }
  return out
    .map((m, i) => ({ m, i, bucket: sortBucket(m) }))
    .sort((a, b) => a.bucket - b.bucket || a.i - b.i)
    .map((x) => x.m)
}

// whole-archive PMTiles, children in draw order, first on top
function visibleParents(
  metadata: Record<string, LayerMetadata>,
): { parent: LayerMetadata; children: LayerMetadata[] }[] {
  const out: { parent: LayerMetadata; children: LayerMetadata[] }[] = []
  for (const layer of settings.layers) {
    const m = metadata[layer.id]
    if (!m?.isParent || m.hideFromLegend) continue
    const children = (m.childIds ?? [])
      .map((id) => metadata[id])
      .filter((c): c is LayerMetadata => !!c?.visible && !!(c.symbology || c.legend) && !c.hideFromLegend)
    if (children.length > 0) out.push({ parent: m, children })
  }
  return out
}

function SwatchSlot({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: SWATCH_COL_PX }}
    >
      {children}
    </span>
  )
}

function withAlpha(color: string, opacity: number | undefined): string {
  if (opacity === undefined || opacity >= 1) return color
  return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`
}

// wavy so it can't be mistaken for a thin polygon
function LineSwatch({
  color,
  strokeWidth,
  opacity,
  size = 18,
}: {
  color: string
  strokeWidth?: number
  opacity?: number
  size?: number
}) {
  return (
    <svg
      viewBox="0 0 24 14"
      width={size}
      height={Math.round(size * (14 / 24))}
      className="inline-block shrink-0"
      aria-hidden="true"
    >
      <path
        d="M1 10 C 5 2, 9 12, 13 7 S 21 2, 23 4"
        fill="none"
        stroke={color}
        strokeOpacity={opacity ?? 1}
        strokeWidth={strokeWidth ?? 2}
        strokeLinecap="round"
      />
    </svg>
  )
}

function PointSwatch({
  color,
  strokeColor,
  strokeWidth,
  opacity,
  strokeOpacity,
  size = 10,
}: {
  color: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
  strokeOpacity?: number
  size?: number
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: withAlpha(color, opacity),
        border: `${strokeWidth ?? 1}px solid ${withAlpha(strokeColor ?? '#ffffff', strokeOpacity)}`,
      }}
    />
  )
}

function PolygonSwatch({
  color,
  opacity,
  size = 14,
}: {
  color: string
  opacity?: number
  size?: number
}) {
  // sharp corners to contrast with the round point swatch
  return (
    <span
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: withAlpha(color, opacity),
        border: '1px solid rgba(0,0,0,0.15)',
      }}
    />
  )
}

// SWATCH_COL_PX is sized to fit this one
function MixedSwatch({
  color,
  opacity,
  strokeColor,
  strokeOpacity,
}: {
  color: string
  opacity?: number
  strokeColor?: string
  strokeOpacity?: number
}) {
  const o = opacity ?? 1
  return (
    // a wavy line looks closer to the dot than it is, so a wider gap
    <svg viewBox="0 0 30 14" width={30} height={14} className="inline-block shrink-0" aria-hidden="true">
      <circle
        cx="4"
        cy="7"
        r="3.25"
        fill={color}
        fillOpacity={o}
        stroke={strokeColor ?? '#ffffff'}
        strokeOpacity={strokeOpacity ?? 1}
        strokeWidth="0.75"
      />
      <path d="M11 10.5 C 13 3, 15 11.5, 18.5 3.5" fill="none" stroke={color} strokeOpacity={o} strokeWidth="1.75" strokeLinecap="round" />
      <rect x="21.5" y="3.25" width="7.5" height="7.5" fill={color} fillOpacity={o} stroke="rgba(0,0,0,0.15)" strokeWidth="0.75" />
    </svg>
  )
}

function SingleSwatch({
  swatch,
}: {
  swatch: Extract<LegendSwatch, { kind: 'single' }>
}) {
  switch (swatch.geometryType) {
    case 'point':
      return (
        <PointSwatch
          color={swatch.color}
          strokeColor={swatch.strokeColor}
          strokeWidth={swatch.strokeWidth}
          opacity={swatch.opacity}
          strokeOpacity={swatch.strokeOpacity}
        />
      )
    case 'line':
      return <LineSwatch color={swatch.color} strokeWidth={swatch.width} opacity={swatch.opacity} />
    case 'polygon':
      return <PolygonSwatch color={swatch.color} opacity={swatch.opacity} />
    default:
      return (
        <MixedSwatch
          color={swatch.color}
          opacity={swatch.opacity}
          strokeColor={swatch.strokeColor}
          strokeOpacity={swatch.strokeOpacity}
        />
      )
  }
}

function CategorySwatch({
  color,
  geometryType,
}: {
  color: string
  geometryType: LayerGeometryType | undefined
}) {
  switch (geometryType) {
    case 'line':
      return <LineSwatch color={color} size={16} />
    case 'polygon':
      return <PolygonSwatch color={color} size={12} />
    case 'point':
    default:
      return <PointSwatch color={color} size={9} strokeWidth={1} strokeColor="#ffffff" />
  }
}

function GradientBar({ swatch }: { swatch: Extract<LegendSwatch, { kind: 'gradient' }> }) {
  const { stops } = swatch
  const min = stops[0].value
  const max = stops[stops.length - 1].value
  // numeric stops placed by value, string stops evenly
  const css = useMemo(() => {
    const numeric = typeof min === 'number' && typeof max === 'number' && max !== min
    const parts = stops.map((s, i) => {
      const pct = numeric
        ? (((s.value as number) - (min as number)) / ((max as number) - (min as number))) * 100
        : (i / (stops.length - 1)) * 100
      return `${s.color} ${pct}%`
    })
    return `linear-gradient(to right, ${parts.join(', ')})`
  }, [stops, min, max])

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <div className="h-3 w-full rounded-sm" style={{ background: css }} />
      <div className="flex justify-between text-small text-text">
        <span>{stops[0].label ?? String(stops[0].value)}</span>
        <span>{stops[stops.length - 1].label ?? String(stops[stops.length - 1].value)}</span>
      </div>
    </div>
  )
}

// one item per stop, in the layer's color if constant, else neutral
// so size reads apart from color
function SizeRow({ sizes, color }: { sizes: SizeStops; color?: string }) {
  const tint = color ?? 'var(--color-text)'
  return (
    // spread edge to edge, like the color bar above it, at any panel width
    <ul className="mt-1.5 flex w-full items-end justify-between gap-1">
      {sizes.stops.map((stop, i) => (
        <li key={`${stop.value}-${i}`} className="flex flex-col items-center gap-0.5">
          {sizes.kind === 'dot' ? (
            <PointSwatch color={tint} size={Math.min(MAX_DOT_PX, Math.max(2, stop.size * 2))} strokeWidth={0} />
          ) : (
            <LineSwatch color={tint} strokeWidth={Math.min(10, stop.size)} size={22} />
          )}
          <span className="text-small text-text">{stop.label}</span>
        </li>
      ))}
    </ul>
  )
}

function LegendRow({ layer, nested = false }: { layer: LayerMetadata; nested?: boolean }) {
  const swatch = legendForLayer(layer)
  if (!swatch || swatch.kind === 'hidden') return null

  return (
    <div className={nested ? 'py-1 pl-3' : 'border-b border-panelBorder px-3 py-2'}>
      {swatch.kind === 'single' && (
        <div className="flex items-center gap-2">
          <SwatchSlot>
            <SingleSwatch swatch={swatch} />
          </SwatchSlot>
          <span className="min-w-0 flex-1 truncate text-medium text-strongText" title={layer.name}>
            {layer.name}
          </span>
        </div>
      )}

      {swatch.kind === 'categories' && (
        <div>
          <div className="truncate text-medium font-medium text-strongText" title={layer.name}>
            {layer.name}
          </div>
          {swatch.description && (
            <div className="truncate text-medium text-text" title={swatch.description}>
              {swatch.description}
            </div>
          )}
          <ul className="mt-1.5 flex flex-col gap-1 pl-1">
            {swatch.entries.map((e, i) => (
              <li key={`${e.label}-${i}`} className="flex items-center gap-2">
                <SwatchSlot>
                  <CategorySwatch color={e.color} geometryType={swatch.geometryType} />
                </SwatchSlot>
                <span className="min-w-0 flex-1 truncate text-medium text-text" title={e.label}>
                  {e.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {swatch.kind === 'gradient' && (
        <div>
          <div className="truncate text-medium font-medium text-strongText" title={layer.name}>
            {layer.name}
          </div>
          {swatch.description && (
            <div className="truncate text-medium text-text" title={swatch.description}>
              {swatch.description}
            </div>
          )}
          <GradientBar swatch={swatch} />
        </div>
      )}

      {swatch.kind === 'unknown' && (
        <div className="flex items-center gap-2">
          <SwatchSlot>
            <span
              className="inline-block border border-panelBorder"
              style={{
                width: 14,
                height: 14,
                background:
                  'repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-text) 15%, transparent) 0 3px, color-mix(in srgb, var(--color-text) 35%, transparent) 3px 6px)',
              }}
            />
          </SwatchSlot>
          <span className="min-w-0 flex-1 truncate text-medium text-strongText" title={layer.name}>
            {layer.name}
          </span>
          <span
            className="shrink-0 text-small text-text"
            title="Add a `legend` to this layer in your project's layers.json to customize."
          >
            custom
          </span>
        </div>
      )}

      {'sizes' in swatch && swatch.sizes && (
        <SizeRow sizes={swatch.sizes} color={swatch.kind === 'single' ? swatch.color : undefined} />
      )}
    </div>
  )
}

export function LegendWidget() {
  const layerMetadata = useStore((s) => s.layerMetadata)
  // sorted by settings.layers, which the editor's live changes can reorder
  const settingsVersion = useStore((s) => s.settingsVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => visibleLayersSorted(layerMetadata), [layerMetadata, settingsVersion])
  const parents = useMemo(() => visibleParents(layerMetadata), [layerMetadata])

  if (visible.length === 0 && parents.length === 0) {
    return (
      <EmptyState
        title="No visible layers"
        hint="Toggle one on in the Layers panel to see its legend."
      />
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((layer) => (
        <LegendRow key={layer.id} layer={layer} />
      ))}
      {parents.map(({ parent, children }) => (
        <div key={parent.id} className="border-b border-panelBorder px-3 py-2">
          <div className="truncate text-medium font-medium text-strongText" title={parent.name}>
            {parent.name}
          </div>
          <div className="mt-1">
            {children.map((child) => (
              <LegendRow key={child.id} layer={child} nested />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
