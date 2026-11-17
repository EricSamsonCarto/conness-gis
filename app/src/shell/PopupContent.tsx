import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import { bbox as turfBbox, centroid as turfCentroid } from '@turf/turf'
import { popupTemplates } from '@user/popups'
import { useStore } from '@/core/store'
import { useMap } from '@/core/hooks'
import { isValidLngLatBounds } from '@/core/layers/bounds'
import { ZoomToExtentIcon, CopyIcon, CheckIcon, ExternalLinkIcon, TriangleIcon } from '@/ui/icons'
import { useCopyToClipboard } from '@/ui/useCopyToClipboard'
import { SheetHeader } from './SheetHeader'

interface PopupContentProps {
  // when set, the header becomes the drag handle
  onHeaderPointerDown?: (e: ReactPointerEvent) => void
  // when set, in the mobile sheet its one row drags the sheet
  onSheetDrag?: (e: ReactPointerEvent) => void
}

// mirrors SearchWidget's, the shell can't import user-surface code
const DEFAULT_POINT_ZOOM = 14

// points give a zero-size bbox, so fly to the centroid instead
function zoomToFeature(map: MapLibreMap, feature: GeoJSON.Feature): void {
  const bounds = turfBbox(feature) as LngLatBoundsLike
  if (isValidLngLatBounds(bounds)) {
    map.fitBounds(bounds, { padding: 40 })
    return
  }
  const [lng, lat] = turfCentroid(feature).geometry.coordinates
  map.flyTo({ center: [lng, lat], zoom: DEFAULT_POINT_ZOOM })
}

// matches CoordinatesWidget's formatCoord
function formatFeatureCoords(feature: GeoJSON.Feature): string {
  const [lng, lat] = turfCentroid(feature).geometry.coordinates
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

// the search form drops a pin, unlike /@lat,lng, and opens Maps on mobile
function googleMapsUrl(feature: GeoJSON.Feature): string {
  const [lng, lat] = turfCentroid(feature).geometry.coordinates
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

function resolveHeader(
  template: string | undefined,
  layerName: string,
  group: string | undefined,
  props: Record<string, unknown> | null,
): string {
  if (!template) return layerName
  // {column} as in labels, the two built-ins win over same-named columns
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    const name = key.trim()
    if (name === 'layerName') return layerName
    if (name === 'group') return group ?? ''
    return String(props?.[name] ?? '')
  })
}

export function PopupContent({ onHeaderPointerDown, onSheetDrag }: PopupContentProps = {}) {
  const features = useStore((s) => s.selectedFeatures)
  const index = useStore((s) => s.selectedFeatureIndex)
  const trigger = useStore((s) => s.selectedFeatureTrigger)
  const advance = useStore((s) => s.advancePopup)
  const close = useStore((s) => s.closePopup)
  const map = useMap()
  const { copied, copy } = useCopyToClipboard()

  if (features.length === 0) return null
  const current = features[Math.min(index, features.length - 1)]
  const Template = popupTemplates[current.resolved.displayType]
  if (!Template) return null

  const titleField = current.resolved.title
  const props = current.feature.properties as Record<string, unknown> | null
  const titleValue =
    titleField != null ? String(props?.[titleField] ?? '') : undefined

  const headerText = resolveHeader(
    current.resolved.header,
    current.layerName,
    current.resolved.group,
    props,
  )

  const showPager = trigger === 'click' && features.length > 1
  const hasActions =
    current.resolved.zoomToFeature || current.resolved.copyCoordinates || current.resolved.viewInGoogleMaps

  // in the sheet they sit beside the close, so the footer is only the pager
  // `tip` shows under the header's button and above the footer's, inside
  const button = (onClick: () => void, label: string, icon: ReactNode, tip?: string) => (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        className={
          'inline-flex shrink-0 items-center justify-center rounded text-popupArrow hover:bg-text/10 ' +
          (onSheetDrag ? 'h-7 w-7' : 'h-5 w-5')
        }
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
      {tip && (
        <span
          role="status"
          className={
            'kit-flash pointer-events-none absolute right-0 z-10 whitespace-nowrap rounded bg-strongText px-1.5 py-0.5 text-small text-panelBg shadow ' +
            (onSheetDrag ? 'top-full mt-1' : 'bottom-full mb-1')
          }
        >
          {tip}
        </span>
      )}
    </span>
  )
  const iconSize = onSheetDrag ? 16 : 14
  const actions = hasActions && (
    <>
      {current.resolved.copyCoordinates &&
        button(
          () => copy(formatFeatureCoords(current.feature)),
          copied ? 'Copied' : 'Copy coordinates',
          copied ? <CheckIcon size={iconSize} /> : <CopyIcon size={iconSize} />,
          copied ? 'Coordinates copied' : undefined,
        )}
      {current.resolved.viewInGoogleMaps &&
        button(
          () => window.open(googleMapsUrl(current.feature), '_blank', 'noopener,noreferrer'),
          'View in Google Maps',
          <ExternalLinkIcon size={iconSize} />,
        )}
      {current.resolved.zoomToFeature &&
        button(() => map && zoomToFeature(map, current.feature), 'Zoom to feature', <ZoomToExtentIcon size={iconSize} />)}
    </>
  )

  return (
    <>
      {onSheetDrag ? (
        <SheetHeader
          title={headerText}
          titleClass="text-popupHeader font-medium text-text"
          divider
          onClose={close}
          closeLabel="Close popup"
          onDragStart={onSheetDrag}
          actions={actions}
        />
      ) : (
        <div
          onPointerDown={onHeaderPointerDown}
          className={
            'flex shrink-0 items-center justify-between gap-2 border-b border-panelBorder bg-popupHeaderBg px-2 py-1.5 ' +
            (onHeaderPointerDown ? 'cursor-move select-none' : '')
          }
        >
          <span
            className="min-w-0 flex-1 truncate text-popupHeader font-medium text-text"
            title={headerText}
          >
            {headerText}
          </span>
          <button
            type="button"
            onClick={close}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close popup"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-text hover:bg-text/10 hover:text-strongText"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere]">
        <Template
          feature={current.feature}
          fields={current.resolved.fields}
          title={titleValue}
          layerId={current.layerId}
          layerName={current.layerName}
        />
      </div>
      {(showPager || (hasActions && !onSheetDrag)) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center justify-between border-t border-panelBorder bg-surface px-2 py-1"
        >
          <div className="flex items-center gap-0.5 text-medium text-popupArrow">
            {showPager && (
              <>
                <button
                  type="button"
                  onClick={() => advance(-1)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-text/10"
                  aria-label="Previous feature"
                  title="Previous feature"
                >
                  <TriangleIcon direction="left" size={12} />
                </button>
                <span className="whitespace-nowrap px-1 font-mono tabular-nums">
                  {index + 1} / {features.length}
                </span>
                <button
                  type="button"
                  onClick={() => advance(1)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-text/10"
                  aria-label="Next feature"
                  title="Next feature"
                >
                  <TriangleIcon direction="right" size={12} />
                </button>
              </>
            )}
          </div>
          {!onSheetDrag && actions && <div className="flex items-center gap-0.5">{actions}</div>}
        </div>
      )}
    </>
  )
}
