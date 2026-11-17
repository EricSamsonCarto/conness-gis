import { useEffect, useState } from 'react'
import { settings } from '@user/settings'
import { useDataLoading } from '@/core/map/useDataLoading'
import { useStore } from '@/core/store'

const DEFAULT_LABEL_INTERVAL_MS = 2500
export function LoadingOverlay() {
  const loaderCfg = settings.ui?.loader
  const enabled = loaderCfg?.enabled ?? true
  const showDetails = loaderCfg?.showDetails ?? true
  const labels = [loaderCfg?.label ?? []].flat().filter(Boolean)
  const interval = loaderCfg?.labelInterval ?? DEFAULT_LABEL_INTERVAL_MS
  const { isLoading, waiting } = useDataLoading()
  const [labelIndex, setLabelIndex] = useState(0)
  // DuckDB startup step, null once ready
  const status = useStore((s) => s.loadingStatus)
  const layerMetadata = useStore((s) => s.layerMetadata)
  const setLoadingStatus = useStore((s) => s.setLoadingStatus)

  useEffect(() => {
    if (!isLoading) setLoadingStatus(null)
  }, [isLoading, setLoadingStatus])

  useEffect(() => {
    if (!isLoading || labels.length < 2) return
    const timer = setInterval(() => setLabelIndex((i) => (i + 1) % labels.length), interval)
    return () => clearInterval(timer)
  }, [isLoading, labels.length, interval])

  if (!enabled || !isLoading) return null

  // end of list, so the name changes as layers finish
  const lastWaiting = waiting[waiting.length - 1]
  const detail = status ?? (lastWaiting ? (layerMetadata[lastWaiting]?.name ?? lastWaiting) : null)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading map data"
      // z-[45]: below InfoModal so a greeting stays interactive
      className="fixed inset-0 z-[45] flex flex-col items-center justify-center gap-3 bg-slate-900/50 backdrop-blur-sm"
    >
      <span
        className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-primary"
        aria-hidden="true"
      />
      {labels.length > 0 && (
        // keyed, so each new line replays the fade-in
        <span key={labelIndex} className="kit-fade-in text-large font-semibold text-white">
          {labels[labelIndex % labels.length]}
        </span>
      )}
      {showDetails && detail && <span className="text-large text-white/90">{detail}</span>}
    </div>
  )
}
