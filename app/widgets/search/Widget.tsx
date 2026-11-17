import { useEffect, useRef, useState, type ReactNode } from 'react'
import { settings } from '@user/settings'
import { widgetSettings } from '@/core/widgetSettings'
import type { SearchSettings } from './settings'
import { useMap, useMapReady } from '@/core/hooks'
import { useStore } from '@/core/store'
import { openPopupFor } from '@/core/popups/popupHandlers'
import { CloseIcon } from '@/ui/icons'
import { geocode, type GeocodeResult } from '@/core/search/providers'
import {
  searchLayer,
  type FeatureSearchResult,
} from '@/core/search/featureSearch'

// a result's place, to tell one feature's results apart from another's
const placeKey = (r: FeatureSearchResult) => `${r.lng},${r.lat},${r.bbox?.join(',') ?? ''}`

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const DEFAULT_POINT_ZOOM = 14

interface FeatureSection {
  layerId: string
  layerName: string
  results: FeatureSearchResult[]
}

export function SearchWidget() {
  const map = useMap()
  const isMapReady = useMapReady()
  const config = widgetSettings<SearchSettings>('search')
  const isMobile = useStore((s) => s.isMobile)

  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<GeocodeResult[]>([])
  const [featureSections, setFeatureSections] = useState<FeatureSection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // closed after a pick on mobile, until the user types again
  const [listHidden, setListHidden] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // a picked label goes in the box without searching again
  const skipSearchRef = useRef(false)

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false
      return
    }
    const trimmed = query.trim()
    // updateQuery already cleared the results
    if (trimmed.length < MIN_QUERY_LENGTH) return

    const handle = setTimeout(async () => {
      setLoading(true)
      setError(null)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const geocoderPromise: Promise<GeocodeResult[]> = config?.geocoder
          ? geocode(trimmed, config.geocoder, controller.signal)
          : Promise.resolve([])

        // a failing layer drops out instead of failing the whole search
        const layerPromises = (config?.layers ?? []).map((layerCfg) =>
          searchLayer(layerCfg, settings.layers, trimmed)
            .catch((err: unknown): FeatureSearchResult[] => {
              console.warn(
                `[conness-gis] search: layer "${layerCfg.layerId}" failed: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              )
              return []
            })
            .then((results) => ({
              layerId: layerCfg.layerId,
              layerName: results[0]?.layerName ?? layerCfg.layerId,
              results,
            })),
        )

        const [placeResults, layerResults] = await Promise.all([
          geocoderPromise,
          Promise.all(layerPromises),
        ])
        // layer searches ignore the signal, so check it here
        if (controller.signal.aborted) return

        const layerIndex = (id: string) =>
          settings.layers.findIndex((l) => l.id === id)
        // one section per layer, a feature matching two columns shows once
        const byLayer = new Map<string, (typeof layerResults)[number]>()
        for (const section of layerResults) {
          const merged = byLayer.get(section.layerId)
          if (!merged) byLayer.set(section.layerId, { ...section, results: [...section.results] })
          else {
            const seen = new Set(merged.results.map(placeKey))
            merged.results.push(...section.results.filter((r) => !seen.has(placeKey(r))))
          }
        }
        const sections = [...byLayer.values()]
          .filter((s) => s.results.length > 0)
          .sort((a, b) => layerIndex(a.layerId) - layerIndex(b.layerId))

        setPlaces(placeResults)
        setFeatureSections(sections)
      } catch (e) {
        if (controller.signal.aborted || (e as { name?: string })?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Search failed.')
        setPlaces([])
        setFeatureSections([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [query, config])

  useEffect(() => () => abortRef.current?.abort(), [])

  // only feature results carry a layerId
  const pointZoomFor = (r: GeocodeResult | FeatureSearchResult): number => {
    const layerId = (r as FeatureSearchResult).layerId
    const perLayer = layerId
      ? config?.layers?.find((l) => l.layerId === layerId)?.pointZoom
      : undefined
    return perLayer ?? config?.pointZoom ?? DEFAULT_POINT_ZOOM
  }

  const flyToResult = (r: GeocodeResult | FeatureSearchResult) => {
    if (!map || !isMapReady) return
    if (r.bbox) {
      map.fitBounds(
        [
          [r.bbox[0], r.bbox[1]],
          [r.bbox[2], r.bbox[3]],
        ],
        { padding: 60, maxZoom: 16 },
      )
    } else {
      map.flyTo({ center: [r.lng, r.lat], zoom: pointZoomFor(r) })
    }
  }

  const pick = (r: GeocodeResult | FeatureSearchResult) => {
    if (!map || !isMapReady) return
    // same text means no effect run to clear the flag
    if (r.label !== query) skipSearchRef.current = true
    setQuery(r.label)
    flyToResult(r)
    if ('layerId' in r && config?.openPopup !== false) openPopupFor(map, r.layerId, r.feature, [r.lng, r.lat])
    if (isMobile) {
      setListHidden(true)
      inputRef.current?.blur()
    }
  }

  const placeholder = config?.placeholder ?? 'Search…'
  const loadingText = config?.loadingText ?? 'Searching…'
  const noResultsText = config?.noResultsText ?? 'No results.'
  const placesFirst = config?.sectionOrder === 'places-first'
  const hasQuery = query.trim().length >= MIN_QUERY_LENGTH
  const noResults =
    hasQuery && !loading && !error && places.length === 0 && featureSections.length === 0

  const updateQuery = (next: string) => {
    setQuery(next)
    setListHidden(false)
    if (next.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setPlaces([])
      setFeatureSections([])
      setError(null)
      setLoading(false)
    } else {
      // so "No results." doesn't flash during the debounce
      setLoading(true)
    }
  }

  const clear = () => updateQuery('')

  const hasResults = places.length > 0 || featureSections.length > 0
  const showDropdown = !listHidden && (loading || !!error || noResults || hasResults)

  const featureSectionsEl = (
    <div key="features">
      {featureSections.map((section) => (
        <Section key={section.layerId} title={section.layerName}>
          {section.results.map((r, i) => (
            <ResultButton
              key={`${section.layerId}-${i}`}
              label={r.label}
              onClick={() => pick(r)}
            />
          ))}
        </Section>
      ))}
    </div>
  )
  const placesSection =
    places.length > 0 ? (
      <Section key="places" title="Places">
        {places.map((p, i) => (
          <ResultButton
            key={`place-${i}`}
            label={p.label}
            onClick={() => pick(p)}
          />
        ))}
      </Section>
    ) : null

  return (
    // shadow here so bar + dropdown read as one shape
    <div className="w-52 rounded text-large shadow-lg sm:w-80">
      {/* fixed h-10, the chromeless wrapper offsets by half to center it */}
      <div
        className={
          'relative flex h-10 items-center bg-panelBg ' +
          (showDropdown
            ? 'rounded-t border border-panelBorder'
            : 'rounded border border-panelBorder')
        }
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="h-full w-full bg-transparent pl-3 pr-8 text-large text-text outline-none"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text hover:bg-text/10"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {/* no shadow, it would cast onto the bar */}
      {showDropdown && (
        <div className="max-h-72 overflow-y-auto overflow-x-hidden rounded-b border border-t-0 border-panelBorder bg-panelBg p-1">
          {loading && <div className="px-2 py-1.5 text-medium text-text">{loadingText}</div>}
          {error && <div className="px-2 py-1.5 text-medium text-danger">{error}</div>}
          {noResults && (
            <div className="px-2 py-1.5 text-medium text-text">{noResultsText}</div>
          )}

          {(placesFirst ? [placesSection, featureSectionsEl] : [featureSectionsEl, placesSection])}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-1">
      {/* -mx-1 cancels the dropdown's p-1 so the bar spans edge to edge */}
      <div className="-mx-1 mb-1 bg-surface px-2 py-1 text-small font-bold uppercase tracking-wide text-text">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function ResultButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-1.5 text-left text-medium text-text hover:bg-text/10 [overflow-wrap:anywhere]"
    >
      {label}
    </button>
  )
}
