import type { IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { ScaleControlConfig } from '../core/types.ts'

type Unit = 'metric' | 'imperial' | 'nautical'
type Style = NonNullable<ScaleControlConfig['style']>

// MapLibre's rounding, so the bar reads 1, 2, 3 or 5 times a power of ten
function roundNum(n: number): number {
  const pow10 = 10 ** (`${Math.floor(n)}`.length - 1)
  const d = n / pow10
  if (d >= 10) return 10 * pow10
  if (d >= 5) return 5 * pow10
  if (d >= 3) return 3 * pow10
  if (d >= 2) return 2 * pow10
  if (d >= 1) return pow10
  const m = 10 ** Math.ceil(-Math.log10(d))
  return (Math.round(d * m) / m) * pow10
}

// a rounded distance for a maxWidth bar, ratio is the bar's share of it
export function scaleFor(maxMeters: number, unit: Unit): { distance: number; unit: string; ratio: number } {
  let max = maxMeters
  let name = 'm'
  if (unit === 'imperial') {
    const feet = maxMeters * 3.2808
    ;[max, name] = feet > 5280 ? [feet / 5280, 'mi'] : [feet, 'ft']
  } else if (unit === 'nautical') {
    ;[max, name] = [maxMeters / 1852, 'nm']
  } else if (maxMeters >= 1000) {
    ;[max, name] = [maxMeters / 1000, 'km']
  }
  const distance = roundNum(max)
  return { distance, unit: name, ratio: distance / max }
}

const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

// classic is MapLibre's own look. index.css .kit-scale-* draws the others
function row(style: Style, width: number, distance: number, unit: string): string {
  const label = `${num(distance)} ${unit}`
  const w = `width:${width.toFixed(1)}px`
  if (style === 'classic') return `<div class="maplibregl-ctrl maplibregl-ctrl-scale kit-scale-classic" style="${w}">${label}</div>`
  if (style === 'pill') return `<div class="kit-scale-pill"><span>${label}</span><span class="kit-scale-line" style="${w}"></span></div>`
  if (style === 'alternating') {
    return `<div class="kit-scale-alt"><div class="kit-scale-bar" style="${w}"><div class="kit-scale-segments"><span></span><span></span><span></span><span></span></div><div class="kit-scale-ticks"><span>0</span><span>${num(distance / 2)}</span></div></div><span class="kit-scale-full">${label}</span></div>`
  }
  return `<div class="kit-scale-minimal"><span>${label}</span><span class="kit-scale-line" style="${w}"></span></div>`
}

// MapLibre's ScaleControl restyled, with four looks and both units at once
export class ScaleBarControl implements IControl {
  private el = document.createElement('div')
  private map: MapLibreMap | undefined
  private readonly style: Style
  private readonly units: Unit[]
  private readonly maxWidth: number

  constructor({ style = 'classic', unit = 'metric', maxWidth = 100 }: Pick<ScaleControlConfig, 'style' | 'unit' | 'maxWidth'>) {
    this.style = style
    this.units = unit === 'both' ? ['metric', 'imperial'] : [unit]
    this.maxWidth = maxWidth
  }

  private update = () => {
    const map = this.map
    if (!map) return
    const { clientWidth, clientHeight } = map.getContainer()
    const y = clientHeight / 2
    const x = Math.max(0, clientWidth / 2 - this.maxWidth / 2)
    const meters = map.unproject([x, y]).distanceTo(map.unproject([x + this.maxWidth, y]))
    this.el.innerHTML = this.units
      .map((u) => {
        const { distance, unit, ratio } = scaleFor(meters, u)
        return row(this.style, this.maxWidth * ratio, distance, unit)
      })
      .join('')
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map
    this.el.className = `maplibregl-ctrl kit-scale kit-scale-${this.style}`
    this.el.setAttribute('aria-label', 'Map scale')
    map.on('move', this.update)
    this.update()
    return this.el
  }

  onRemove(): void {
    this.map?.off('move', this.update)
    this.el.remove()
    this.map = undefined
  }
}
