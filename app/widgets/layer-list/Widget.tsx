import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { settings } from '@user/settings'
import { widgetSettings } from '@/core/widgetSettings'
import type { LayerListSettings } from './settings'
import { useStore } from '@/core/store'
import { useMap } from '@/core/hooks'
import {
  setLayerVisibility,
  setLayerOpacity,
  setLabelVisibility,
  setLayerZoomRange,
} from '@/core/layers/layerOps'
import { isValidLngLatBounds } from '@/core/layers/bounds'
import { isFilterActive } from '@/core/filters/compile'
import { currentFilterPredicate, updateLayerFilter } from '@/core/filters/apply'
import { allowedExportFormats, downloadFile, downloadGeoJSON } from '@/core/export/download'
import { featuresToKML } from '@/core/export/writeKML'
import { resolveSymbology } from '@/core/layers/symbology'
import { toGeoParquet } from '@/core/export/writeGeoParquet'
import { featuresToCSV } from '@/core/export/writeCSV'
import {
  KebabIcon,
  ZoomToExtentIcon,
  FilterIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  CheckboxIcon,
  ChevronIcon,
} from '@/ui/icons'
import type { LayerMetadata } from '@/core/types'
import { EmptyState } from '@/ui/EmptyState'
import { IconButton } from '@/ui/IconButton'
import { Spinner } from '@/ui/Spinner'
import { ChoiceDialog } from '@/ui/ChoiceDialog'
import { DialogFrame } from '@/ui/DialogFrame'
import { RangeSlider } from '@/ui/RangeSlider'
import { FilterPanel } from './components/FilterPanel'

// read each time so live changes show
const config = () => widgetSettings<LayerListSettings>('layer-list')

// kit default ← widget actions ← layer actions. zoom range is opt-in
function actionEnabled(
  metadata: LayerMetadata,
  action: 'opacity' | 'labels' | 'zoomToExtent' | 'filter' | 'export' | 'visibilityZoom',
): boolean {
  const global = config()?.actions?.[action]
  const perLayer = metadata.actions?.[action]
  return perLayer ?? global ?? action !== 'visibilityZoom'
}

function resolveGroupDefault(name: string): boolean {
  const perGroup = settings.layerGroups?.[name]?.collapsed
  if (perGroup !== undefined) return perGroup
  return config()?.groupsCollapsedByDefault ?? true
}

// minzoom inclusive, maxzoom exclusive, per MapLibre
function isOutOfZoom(
  metadata: LayerMetadata,
  zoom: number | null,
): boolean {
  if (zoom === null) return false
  if (metadata.minZoom !== undefined && zoom < metadata.minZoom) return true
  if (metadata.maxZoom !== undefined && zoom >= metadata.maxZoom) return true
  return false
}

// one vertical line runs down the list, every row keeps a gutter
// left of it for the 20px expand chevron
const ROW_PAD_PX = 2
const GUTTER_PX = 24
const LINE_LEFT_PX = ROW_PAD_PX + 21
// source layers get their own line 17px in, the step keeps the same
// line-to-eye gap as the main line (7px)
const CHILD_LINE_LEFT_PX = LINE_LEFT_PX + 17
const CHILD_STEP_PX = 13

function Gutter({ children }: { children?: React.ReactNode }) {
  return <span className="flex w-6 shrink-0">{children}</span>
}

// a single format skips the choice dialog
const exportFormats = () => allowedExportFormats(config()?.exportFormats)

const toggleStyle = (): 'eye' | 'checkbox' =>
  config()?.toggleStyle ?? 'eye'

const rowClickToggle = (): boolean =>
  config()?.rowClickToggle ?? true

type LayerListItem =
  | { kind: 'layer'; layerId: string }
  | { kind: 'group'; name: string; layerIds: string[] }

// groups sit at first appearance, empty ones at their layerGroups spot
// unlisted ids (__drawings__) go last
function buildItems(
  layerIds: string[],
  metadata: Record<string, LayerMetadata>,
): LayerListItem[] {
  const items: LayerListItem[] = []
  const groupIndex = new Map<string, number>()
  const placed = new Set<string>()

  for (const layer of settings.layers) {
    if (!layerIds.includes(layer.id)) continue
    placed.add(layer.id)
    if (!layer.group) {
      items.push({ kind: 'layer', layerId: layer.id })
      continue
    }
    const existing = groupIndex.get(layer.group)
    if (existing !== undefined) {
      const group = items[existing] as Extract<LayerListItem, { kind: 'group' }>
      group.layerIds.push(layer.id)
    } else {
      groupIndex.set(layer.group, items.length)
      items.push({ kind: 'group', name: layer.group, layerIds: [layer.id] })
    }
  }

  const empty = Object.entries(settings.layerGroups ?? {})
    .filter(([name]) => !settings.layers.some((l) => l.group === name))
    .sort(([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0))
  for (const [name, g] of empty) {
    items.splice(Math.min(g.position ?? 0, items.length), 0, { kind: 'group', name, layerIds: [] })
  }

  for (const id of layerIds) {
    // PMTiles children render under their parent row
    if (metadata[id]?.parentId) continue
    if (!placed.has(id)) items.push({ kind: 'layer', layerId: id })
  }
  return items
}

function VisibilityToggle({
  visible,
  label,
  onToggle,
  partial = false,
  loading = false,
}: {
  visible: boolean
  label: string
  onToggle: () => void
  partial?: boolean
  // deferred first load, or DuckDB re-fill after a basemap switch
  loading?: boolean
}) {
  const style = toggleStyle()
  return (
    <button
      type="button"
      // don't also fire the row toggle
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      // a partial click turns everything on, so it reads as Show
      aria-label={visible && !partial ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={partial ? 'mixed' : visible}
      aria-busy={loading}
      className={
        'shrink-0 rounded p-1 transition-colors ' +
        (partial
          ? 'text-primary/50 hover:bg-primary/10'
          : visible
            ? 'text-primary hover:bg-primary/10'
            : 'text-text hover:bg-text/10')
      }
    >
      {loading ? (
        <span className="flex h-4 w-4 items-center justify-center">
          <Spinner size={13} />
        </span>
      ) : style === 'checkbox' ? (
        <CheckboxIcon
          state={partial ? 'indeterminate' : visible ? 'checked' : 'unchecked'}
        />
      ) : visible ? (
        <EyeIcon />
      ) : (
        <EyeOffIcon />
      )}
    </button>
  )
}

function OpacityIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 a9 9 0 0 1 0 18 z" fill="currentColor" stroke="none" />
    </svg>
  )
}

// a bar with two stops, like the slider it opens
function ZoomRangeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="8" cy="12" r="2.5" fill="currentColor" />
      <circle cx="16" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}

function LabelsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="15" height="11" rx="2" />
      <line x1="6.5" y1="6.75" x2="14.5" y2="6.75" />
      <line x1="6.5" y1="10.25" x2="11.5" y2="10.25" />
      <path d="M10.5 14 L10.5 18" />
      <circle cx="10.5" cy="20" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface LayerActionsMenuProps {
  layerName: string
  showZoomToExtent: boolean
  showLabels: boolean
  showOpacity: boolean
  showFilter: boolean
  showExport: boolean
  showZoomRange: boolean
  labelsOn: boolean
  onZoomToExtentClick: () => void
  onLabelsClick: () => void
  onOpacityClick: () => void
  onFilterClick: () => void
  onExportClick: () => void
  onZoomRangeClick: () => void
}

function LayerActionsMenu({
  layerName,
  showZoomToExtent,
  showLabels,
  showOpacity,
  showFilter,
  showExport,
  showZoomRange,
  labelsOn,
  onZoomToExtentClick,
  onLabelsClick,
  onOpacityClick,
  onFilterClick,
  onExportClick,
  onZoomRangeClick,
}: LayerActionsMenuProps) {
  const itemClass =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-medium text-text hover:bg-text/10'

  // opens upward when the panel would clip it
  const menuRef = useRef<HTMLDivElement>(null)
  const [up, setUp] = useState(false)
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    let clip = menu.parentElement
    while (clip && !/auto|scroll|hidden/.test(getComputedStyle(clip).overflowY)) clip = clip.parentElement
    const bounds = clip?.getBoundingClientRect()
    const top = Math.max(bounds?.top ?? 0, 0)
    const bottom = Math.min(bounds?.bottom ?? window.innerHeight, window.innerHeight)
    const anchor = menu.parentElement!.getBoundingClientRect()
    const menuBottom = menu.getBoundingClientRect().bottom
    if (menuBottom > bottom && anchor.top - top > bottom - anchor.bottom) setUp(true)
  }, [])

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${layerName} actions`}
      onClick={(e) => e.stopPropagation()}
      className={
        'absolute right-0 z-20 w-44 overflow-hidden rounded border border-panelBorder bg-panelBg py-1 shadow-lg ' +
        (up ? 'bottom-full mb-1' : 'top-full mt-1')
      }
    >
      {showZoomToExtent && (
        <button type="button" role="menuitem" className={itemClass} onClick={onZoomToExtentClick}>
          <ZoomToExtentIcon size={14} className="shrink-0 text-text" />
          Zoom to Extent
        </button>
      )}
      {showLabels && (
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={labelsOn}
          className={itemClass}
          onClick={onLabelsClick}
        >
          <LabelsIcon
            className={'h-3.5 w-3.5 shrink-0 ' + (labelsOn ? 'text-primary' : 'text-text')}
          />
          Labels
          {labelsOn && <span className="ml-auto text-primary">✓</span>}
        </button>
      )}
      {showOpacity && (
        <button type="button" role="menuitem" className={itemClass} onClick={onOpacityClick}>
          <OpacityIcon className="h-3.5 w-3.5 shrink-0 text-text" />
          Adjust Transparency
        </button>
      )}
      {showZoomRange && (
        <button type="button" role="menuitem" className={itemClass} onClick={onZoomRangeClick}>
          <ZoomRangeIcon className="h-3.5 w-3.5 shrink-0 text-text" />
          Zoom Range
        </button>
      )}
      {showFilter && (
        <button type="button" role="menuitem" className={itemClass} onClick={onFilterClick}>
          <FilterIcon size={14} className="shrink-0 text-text" />
          Filter
        </button>
      )}
      {showExport && (
        <button type="button" role="menuitem" className={itemClass} onClick={onExportClick}>
          <DownloadIcon size={14} className="shrink-0 text-text" />
          Export Data
        </button>
      )}
    </div>
  )
}

interface LayerRowProps {
  metadata: LayerMetadata
  // a source layer under an expandable parent
  isChild?: boolean
  // whole-archive PMTiles parent row only
  parent?: { expanded: boolean; onExpandToggle: () => void; state: 'all' | 'some' | 'none' }
  outOfZoom: boolean
  opacityOpen: boolean
  zoomRangeOpen: boolean
  // the map's own zoom limits and its current zoom, for the zoom range slider
  zoomLimits: [number, number]
  zoom: number | null
  menuOpen: boolean
  filterActive: boolean
  loading: boolean
  // loader provides features (geojson + geoparquet only)
  canExport: boolean
  onToggle: () => void
  onOpacityToggle: () => void
  onOpacityChange: (value: number) => void
  onLabelsToggle: () => void
  onMenuOpen: () => void
  onMenuClose: () => void
  onZoomToExtent: () => void
  onFilterOpen: () => void
  onExport: () => void
  onZoomRangeToggle: () => void
  onZoomRangeChange: (range: [number, number]) => void
  onZoomRangeReset: () => void
}

function LayerRow({
  metadata,
  isChild = false,
  parent,
  outOfZoom,
  opacityOpen,
  zoomRangeOpen,
  zoomLimits,
  zoom,
  menuOpen,
  filterActive,
  loading,
  canExport,
  onToggle,
  onOpacityToggle,
  onOpacityChange,
  onLabelsToggle,
  onMenuOpen,
  onMenuClose,
  onZoomToExtent,
  onFilterOpen,
  onExport,
  onZoomRangeToggle,
  onZoomRangeChange,
  onZoomRangeReset,
}: LayerRowProps) {
  const pct = Math.round(metadata.opacity * 100)
  const showOpacity = actionEnabled(metadata, 'opacity')
  const showLabels = actionEnabled(metadata, 'labels') && metadata.hasLabel === true
  const showZoomToExtent = actionEnabled(metadata, 'zoomToExtent')
  const showFilter =
    actionEnabled(metadata, 'filter') && (metadata.filters?.length ?? 0) > 0
  const showExport = actionEnabled(metadata, 'export') && canExport
  const range = metadata.configuredZoom ?? { min: metadata.minZoom, max: metadata.maxZoom }
  const showZoomRange =
    actionEnabled(metadata, 'visibilityZoom') && !metadata.isParent && (range.min !== undefined || range.max !== undefined)
  // no item to offer, so no ⋯ at all
  const hasActions = showOpacity || showLabels || showZoomToExtent || showFilter || showExport || showZoomRange
  const labelsOn = metadata.labelsVisible ?? false

  const visible = parent ? parent.state !== 'none' : metadata.visible

  const clickToToggle = rowClickToggle()

  // wraps the trigger too, so clicking it to close isn't an outside click
  const menuWrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuWrapperRef.current?.contains(e.target as Node)) onMenuClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMenuClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, onMenuClose])

  // a drag ending just off the slider clicks the row, so ignore that click
  // cleared a tick after pointerup so the click still sees it
  const draggingOpacityRef = useRef(false)
  const onOpacityPointerDown = () => {
    draggingOpacityRef.current = true
    const clear = () => {
      setTimeout(() => {
        draggingOpacityRef.current = false
      }, 0)
      document.removeEventListener('pointerup', clear)
    }
    document.addEventListener('pointerup', clear)
  }

  return (
    <div
      className={
        'border-b border-panelBorder py-1.5 pr-3 hover:bg-text/5' +
        (clickToToggle ? ' cursor-pointer' : '')
      }
      style={{ paddingLeft: ROW_PAD_PX }}
      onClick={
        clickToToggle
          ? () => {
              if (draggingOpacityRef.current) return
              onToggle()
            }
          : undefined
      }
      role={clickToToggle ? 'button' : undefined}
      aria-pressed={clickToToggle ? visible : undefined}
    >
      <div className="flex items-center gap-1">
        <Gutter>
          {parent && (
            <IconButton
              label={parent.expanded ? `Collapse ${metadata.name}` : `Expand ${metadata.name}`}
              onClick={(e) => {
                e.stopPropagation()
                parent.onExpandToggle()
              }}
              aria-expanded={parent.expanded}
            >
              <ChevronIcon
                direction="down"
                size={12}
                className={'transition-transform ' + (parent.expanded ? '' : '-rotate-90')}
              />
            </IconButton>
          )}
        </Gutter>
        {isChild && <span aria-hidden="true" className="shrink-0" style={{ width: CHILD_STEP_PX }} />}
        <VisibilityToggle
          visible={visible}
          partial={parent?.state === 'some'}
          label={metadata.name}
          onToggle={onToggle}
          loading={loading}
        />
        {/* min-w-0, so a long name truncates instead of pushing actions off */}
        <span
          className={
            'min-w-0 flex-1 truncate text-medium ' +
            (visible && !outOfZoom ? 'text-strongText' : 'text-text')
          }
          title={
            outOfZoom
              ? `${metadata.name}, hidden at this zoom level`
              : metadata.name
          }
        >
          {metadata.name}
        </span>
        {/* funnel left of the kebab so the kebab never shifts */}
        {filterActive && (
          <IconButton
            label={`${metadata.name} filter (active)`}
            variant="primary"
            onClick={(e) => {
              e.stopPropagation()
              onFilterOpen()
            }}
            className="ml-auto"
          >
            <FilterIcon size={14} />
          </IconButton>
        )}
        {hasActions && (
        <div
          ref={menuWrapperRef}
          className={'relative shrink-0' + (filterActive ? '' : ' ml-auto')}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (menuOpen) onMenuClose()
              else onMenuOpen()
            }}
            aria-label={`${metadata.name} actions`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={
              'rounded p-1 transition-colors ' +
              (menuOpen
                ? 'bg-text/10 text-primary'
                : 'text-text hover:bg-text/10')
            }
          >
            <KebabIcon size={14} />
          </button>
          {menuOpen && (
            <LayerActionsMenu
              layerName={metadata.name}
              showZoomToExtent={showZoomToExtent}
              showLabels={showLabels}
              showOpacity={showOpacity}
              showFilter={showFilter}
              showExport={showExport}
              showZoomRange={showZoomRange}
              labelsOn={labelsOn}
              onZoomToExtentClick={() => {
                onMenuClose()
                onZoomToExtent()
              }}
              onLabelsClick={onLabelsToggle}
              onOpacityClick={() => {
                onMenuClose()
                onOpacityToggle()
              }}
              onFilterClick={() => {
                onMenuClose()
                onFilterOpen()
              }}
              onExportClick={() => {
                onMenuClose()
                onExport()
              }}
              onZoomRangeClick={() => {
                onMenuClose()
                onZoomRangeToggle()
              }}
            />
          )}
        </div>
        )}
      </div>
      {opacityOpen && (
        <div
          className="mt-1.5 flex items-center gap-2"
          style={{ paddingLeft: GUTTER_PX + 4 + (isChild ? CHILD_STEP_PX : 0) }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-9 shrink-0 text-right text-small tabular-nums text-text">
            {pct}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={metadata.opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            onPointerDown={onOpacityPointerDown}
            aria-label={`${metadata.name} opacity`}
            className="h-1 flex-1 accent-[var(--color-primary)]"
          />
          <IconButton label={`Close opacity for ${metadata.name}`} onClick={onOpacityToggle}>
            <CloseIcon size={12} />
          </IconButton>
        </div>
      )}
      {zoomRangeOpen && showZoomRange && (
        <div
          className="mt-1.5 flex items-center gap-2"
          style={{ paddingLeft: GUTTER_PX + 4 + (isChild ? CHILD_STEP_PX : 0) }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* fixed width, half zooms would resize the slider while dragging */}
          <span className="w-[4.75rem] shrink-0 text-right text-small tabular-nums text-text">
            z{metadata.minZoom ?? zoomLimits[0]}–{metadata.maxZoom ?? zoomLimits[1]}
          </span>
          <RangeSlider
            min={zoomLimits[0]}
            max={zoomLimits[1]}
            step={0.5}
            value={[metadata.minZoom ?? zoomLimits[0], metadata.maxZoom ?? zoomLimits[1]]}
            onChange={onZoomRangeChange}
            marker={zoom ?? undefined}
            label={`${metadata.name} zoom range`}
            onPointerDown={onOpacityPointerDown}
          />
          {metadata.configuredZoom && (
            <button type="button" onClick={onZoomRangeReset} className="shrink-0 text-small text-primary hover:underline">
              Reset
            </button>
          )}
          <IconButton label={`Close zoom range for ${metadata.name}`} onClick={onZoomRangeToggle}>
            <CloseIcon size={12} />
          </IconButton>
        </div>
      )}
    </div>
  )
}

interface GroupHeaderProps {
  name: string
  layerIds: string[]
  metadata: Record<string, LayerMetadata>
  collapsed: boolean
  onCollapseToggle: () => void
  onVisibilityToggle: () => void
}

function GroupHeader({
  name,
  layerIds,
  metadata,
  collapsed,
  onCollapseToggle,
  onVisibilityToggle,
}: GroupHeaderProps) {
  const states = layerIds.map((id) => metadata[id]?.visible ?? false)
  const allVisible = states.length > 0 && states.every((v) => v)
  const allHidden = states.every((v) => !v)
  const indeterminate = !allVisible && !allHidden

  return (
    <div
      onClick={onCollapseToggle}
      role="button"
      aria-expanded={!collapsed}
      className={
        'flex cursor-pointer items-center gap-1 py-1.5 pr-2 ' +
        (allVisible ? 'bg-primary/10 hover:bg-primary/15' : 'bg-layerGroupBg hover:bg-text/5') +
        (collapsed ? '' : ' shadow-[0_2px_4px_rgba(0,0,0,0.12)]')
      }
      style={{ paddingLeft: ROW_PAD_PX }}
    >
      <Gutter>
        <IconButton
          label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
          onClick={(e) => {
            e.stopPropagation()
            onCollapseToggle()
          }}
          aria-expanded={!collapsed}
        >
          <ChevronIcon
            direction="down"
            size={12}
            className={'transition-transform ' + (collapsed ? '-rotate-90' : '')}
          />
        </IconButton>
      </Gutter>
      <VisibilityToggle
        visible={!allHidden}
        partial={indeterminate}
        label={`all in ${name}`}
        onToggle={onVisibilityToggle}
      />
      <span
        className={
          'min-w-0 flex-1 truncate text-large font-semibold ' +
          (allVisible ? 'text-strongText' : 'text-text')
        }
        title={name}
      >
        {name}
      </span>
    </div>
  )
}

export function LayerListWidget() {
  const map = useMap()
  const layerMetadata = useStore((s) => s.layerMetadata)
  const updateLayerMetadata = useStore((s) => s.updateLayerMetadata)
  const layerBoundsGetters = useStore((s) => s.layerBoundsGetters)
  const layerFeatureGetters = useStore((s) => s.layerFeatureGetters)
  // in the store so it survives the widget unmounting
  const collapsedGroups = useStore((s) => s.collapsedGroups)
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed)
  const seedGroupCollapsed = useStore((s) => s.seedGroupCollapsed)
  const expandedParents = useStore((s) => s.expandedParents)
  const toggleParentExpanded = useStore((s) => s.toggleParentExpanded)
  // local on purpose, a transient control may reset on unmount
  const [opacityOpen, setOpacityOpen] = useState<Set<string>>(new Set())
  const [zoomRangeOpen, setZoomRangeOpen] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [filterLayerId, setFilterLayerId] = useState<string | null>(null)
  const [exportLayerId, setExportLayerId] = useState<string | null>(null)
  const [exportFailed, setExportFailed] = useState<string | null>(null)
  const layerFilters = useStore((s) => s.layerFilters)
  const pendingLayerData = useStore((s) => s.pendingLayerData)

  const [zoom, setZoom] = useState<number | null>(null)
  useEffect(() => {
    if (!map) return
    const sync = () => setZoom(map.getZoom())
    sync()
    map.on('zoom', sync)
    return () => {
      map.off('zoom', sync)
    }
  }, [map])

  // the order is settings.layers', which the editor's live changes can change
  const settingsVersion = useStore((s) => s.settingsVersion)
  const items = useMemo(() => {
    const ids = Object.keys(layerMetadata)
    return buildItems(ids, layerMetadata)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerMetadata, settingsVersion])

  // no-op for groups already seen, so remounts keep the user's choices
  useEffect(() => {
    const entries = items
      .filter((i): i is Extract<LayerListItem, { kind: 'group' }> => i.kind === 'group')
      .map((g) => ({ name: g.name, collapsed: resolveGroupDefault(g.name) }))
    if (entries.length === 0) return
    seedGroupCollapsed(entries)
  }, [items, seedGroupCollapsed])

  if (items.length === 0) {
    return (
      <EmptyState
        title="No layers yet"
        hint={<>Add your data in your project's <code>layers.json</code>.</>}
      />
    )
  }

  // layer gone (e.g. failed re-register): fall back to the list
  const filterMetadata = filterLayerId ? layerMetadata[filterLayerId] : undefined
  if (filterMetadata) {
    return <FilterPanel metadata={filterMetadata} onBack={() => setFilterLayerId(null)} />
  }

  // labels never show on a hidden layer, labelsVisible stays untouched
  const applyVisibility = (meta: LayerMetadata, visible: boolean) => {
    if (!map) return
    // a PMTiles parent has no sublayers of its own
    if (meta.isParent) {
      const all = useStore.getState().layerMetadata
      for (const childId of meta.childIds ?? []) {
        const child = all[childId]
        if (child) applyVisibility(child, visible)
      }
      updateLayerMetadata(meta.id, { visible })
      return
    }
    // labelIsGeometry (e.g. draw text): labels toggle with the layer
    setLayerVisibility(map, meta.id, visible, meta.labelIsGeometry)
    if (meta.hasLabel && !meta.labelIsGeometry) {
      setLabelVisibility(map, meta.id, visible && (meta.labelsVisible ?? false))
    }
    updateLayerMetadata(meta.id, { visible })
    // group toggles and bookmarks read the parent's visible
    if (meta.parentId) {
      const all = useStore.getState().layerMetadata
      const siblings = all[meta.parentId]?.childIds ?? []
      updateLayerMetadata(meta.parentId, {
        visible: siblings.some((id) => all[id]?.visible),
      })
    }
  }

  // no children yet (archive still loading): its own stored state
  const parentState = (meta: LayerMetadata): 'all' | 'some' | 'none' => {
    const ids = meta.childIds ?? []
    if (ids.length === 0) return meta.visible ? 'all' : 'none'
    const on = ids.filter((id) => layerMetadata[id]?.visible).length
    return on === 0 ? 'none' : on === ids.length ? 'all' : 'some'
  }

  const toggleLayer = (id: string) => {
    const current = layerMetadata[id]
    if (!current) return
    const next = current.isParent ? parentState(current) !== 'all' : !current.visible
    applyVisibility(current, next)
  }

  const toggleLabels = (id: string) => {
    if (!map) return
    const current = layerMetadata[id]
    if (!current || !current.hasLabel) return
    const next = !(current.labelsVisible ?? false)
    // a hidden layer remembers the choice for when it's shown
    if (current.visible) setLabelVisibility(map, id, next)
    updateLayerMetadata(id, { labelsVisible: next })
  }

  const changeOpacity = (id: string, value: number) => {
    if (!map) return
    // a parent sets every child, each keeps its own slider after
    for (const childId of layerMetadata[id]?.childIds ?? []) {
      setLayerOpacity(map, childId, value)
      updateLayerMetadata(childId, { opacity: value })
    }
    setLayerOpacity(map, id, value)
    updateLayerMetadata(id, { opacity: value })
  }

  const zoomToExtent = (id: string) => {
    if (!map) return
    const getBounds = layerBoundsGetters[id]
    if (!getBounds) return
    void getBounds().then((bounds) => {
      if (isValidLngLatBounds(bounds)) map.fitBounds(bounds, { padding: 40 })
    })
  }

  // KML carries colors for simple symbology only
  const exportLayer = (id: string, format: string) => {
    const getFeatures = layerFeatureGetters[id]
    const meta = layerMetadata[id]
    const name = meta?.name ?? id
    if (!getFeatures) return
    void getFeatures()
      .then(async (all) => {
        const passes = currentFilterPredicate(id)
        const fc: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: passes ? all.filter((f) => passes(f.properties)) : all,
        }
        if (format === 'geojson') downloadGeoJSON(fc, name)
        if (format === 'kml') {
          downloadFile(featuresToKML(fc, name, meta?.symbology && resolveSymbology(meta.symbology)), name, 'kml', 'application/vnd.google-earth.kml+xml')
        }
        if (format === 'geoparquet') {
          downloadFile(await toGeoParquet(fc), name, 'parquet', 'application/vnd.apache.parquet')
        }
        if (format === 'csv') downloadFile(featuresToCSV(fc), name, 'csv', 'text/csv')
      })
      .catch((err: unknown) => {
        console.warn(
          `[conness-gis] Export of layer "${id}" failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        setExportFailed(name)
      })
  }

  const toggleGroup = (layerIds: string[]) => {
    if (!map) return
    const allVisible = layerIds.every((id) => layerMetadata[id]?.visible)
    const target = !allVisible
    for (const id of layerIds) {
      const meta = layerMetadata[id]
      if (meta) applyVisibility(meta, target)
    }
  }

  // first open enables the filter, later opens keep the user's state
  const openFilter = (id: string) => {
    if (!useStore.getState().layerFilters[id]) {
      updateLayerFilter(id, { enabled: true, columns: {} })
    }
    setFilterLayerId(id)
  }

  const toggleIn = (set: typeof setOpacityOpen) => (id: string) =>
    set((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleOpacityOpen = toggleIn(setOpacityOpen)
  const toggleZoomRangeOpen = toggleIn(setZoomRangeOpen)

  const zoomLimits: [number, number] = map ? [map.getMinZoom(), map.getMaxZoom()] : [0, 24]

  // until reload. the map's own limits mean no limit
  const changeZoomRange = (id: string, [lo, hi]: [number, number]) => {
    const meta = layerMetadata[id]
    if (!map || !meta) return
    const configured = meta.configuredZoom ?? {
      min: meta.minZoom,
      max: meta.maxZoom,
      labelMin: map.getLayer(`${id}-label`)?.minzoom,
    }
    const min = lo <= zoomLimits[0] ? undefined : lo
    const max = hi >= zoomLimits[1] ? undefined : hi
    // a label that started with the layer keeps following it
    const labelMin = configured.labelMin !== undefined && configured.labelMin > (configured.min ?? 0) ? configured.labelMin : undefined
    setLayerZoomRange(map, id, min, max, labelMin)
    updateLayerMetadata(id, { minZoom: min, maxZoom: max, configuredZoom: configured })
  }

  const resetZoomRange = (id: string) => {
    const configured = layerMetadata[id]?.configuredZoom
    if (!map || !configured) return
    setLayerZoomRange(map, id, configured.min, configured.max, configured.labelMin)
    updateLayerMetadata(id, { minZoom: configured.min, maxZoom: configured.max, configuredZoom: undefined })
  }

  const renderLayer = (id: string) => {
    const metadata = layerMetadata[id]
    if (!metadata) return null
    if (metadata.isParent) {
      const expanded = expandedParents.has(id)
      return (
        <div key={id}>
          {renderRow(metadata, {
            expanded,
            onExpandToggle: () => toggleParentExpanded(id),
            state: parentState(metadata),
          })}
          {expanded && (
            <div className="relative bg-text/5">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary/30"
                style={{ left: CHILD_LINE_LEFT_PX }}
              />
              {(metadata.childIds ?? []).map((childId) => {
                const child = layerMetadata[childId]
                return child ? renderRow(child, undefined, true) : null
              })}
            </div>
          )}
        </div>
      )
    }
    return renderRow(metadata)
  }

  const renderRow = (
    metadata: LayerMetadata,
    parent?: LayerRowProps['parent'],
    isChild = false,
  ) => {
    const id = metadata.id
    return (
      <LayerRow
        key={id}
        metadata={metadata}
        isChild={isChild}
        parent={parent}
        outOfZoom={isOutOfZoom(metadata, zoom)}
        opacityOpen={opacityOpen.has(id)}
        zoomRangeOpen={zoomRangeOpen.has(id)}
        zoomLimits={zoomLimits}
        zoom={zoom}
        menuOpen={openMenuId === id}
        filterActive={isFilterActive(layerFilters[id])}
        canExport={id in layerFeatureGetters}
        loading={id in pendingLayerData}
        onToggle={() => toggleLayer(id)}
        onOpacityToggle={() => toggleOpacityOpen(id)}
        onOpacityChange={(v) => changeOpacity(id, v)}
        onLabelsToggle={() => toggleLabels(id)}
        onMenuOpen={() => setOpenMenuId(id)}
        onMenuClose={() => setOpenMenuId((current) => (current === id ? null : current))}
        onZoomToExtent={() => zoomToExtent(id)}
        onFilterOpen={() => openFilter(id)}
        onZoomRangeToggle={() => toggleZoomRangeOpen(id)}
        onZoomRangeChange={(range) => changeZoomRange(id, range)}
        onZoomRangeReset={() => resetZoomRange(id)}
        onExport={() =>
          exportFormats().length === 1 ? exportLayer(id, exportFormats()[0].id) : setExportLayerId(id)
        }
      />
    )
  }

  return (
    // `relative` anchors the export dialog
    <div className="relative flex flex-col">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary/30"
        style={{ left: LINE_LEFT_PX }}
      />
      <ChoiceDialog
        open={exportLayerId !== null}
        title={`Export “${exportLayerId ? (layerMetadata[exportLayerId]?.name ?? exportLayerId) : ''}”`}
        message={exportLayerId && isFilterActive(layerFilters[exportLayerId]) ? 'Only features passing the active filter.' : undefined}
        choices={exportFormats()}
        onChoose={(format) => {
          if (exportLayerId) exportLayer(exportLayerId, format)
          setExportLayerId(null)
        }}
        onCancel={() => setExportLayerId(null)}
      />
      <DialogFrame
        open={exportFailed !== null}
        title="Export failed"
        message={`“${exportFailed}” couldn't be exported. Try again, or try another format.`}
        cancelLabel="OK"
        onCancel={() => setExportFailed(null)}
      />
      {items.map((item) => {
        if (item.kind === 'layer') {
          return renderLayer(item.layerId)
        }
        const collapsed = collapsedGroups.has(item.name)
        return (
          <div key={item.name} className="border-b border-panelBorder">
            <GroupHeader
              name={item.name}
              layerIds={item.layerIds}
              metadata={layerMetadata}
              collapsed={collapsed}
              onCollapseToggle={() => toggleGroupCollapsed(item.name)}
              onVisibilityToggle={() => toggleGroup(item.layerIds)}
            />
            {!collapsed && (
              <div className="bg-text/10">{item.layerIds.map(renderLayer)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
