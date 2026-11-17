// two thumbs on one track, marker is a tick such as the current zoom
export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  marker,
  label,
  onPointerDown,
}: {
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  marker?: number
  label: string
  onPointerDown?: () => void
}) {
  const [lo, hi] = value
  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`
  return (
    <div className="kit-range relative h-4 flex-1" onPointerDown={onPointerDown}>
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-text/20" />
      <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-primary" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }} />
      {marker !== undefined && marker >= min && marker <= max && (
        <span aria-hidden="true" className="absolute top-0 h-4 w-px bg-strongText" style={{ left: pct(marker) }} />
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
        aria-label={`${label} minimum`}
        // both thumbs at the top end, so the low one stays grabbable
        style={{ zIndex: lo >= max - step ? 2 : 1 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
        aria-label={`${label} maximum`}
      />
    </div>
  )
}
