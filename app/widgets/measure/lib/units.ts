import { widgetSettings } from '@/core/widgetSettings'
import type { MeasureSettings } from '../settings'

export type LinearUnit = 'miles' | 'kilometers' | 'meters' | 'feet' | 'yards'
export type AreaUnit =
  | 'acres'
  | 'square-miles'
  | 'square-kilometers'
  | 'square-meters'
  | 'square-feet'
  | 'hectares'

export const LINEAR_UNITS: { value: LinearUnit; label: string }[] = [
  { value: 'miles', label: 'Miles' },
  { value: 'kilometers', label: 'Kilometers' },
  { value: 'meters', label: 'Meters' },
  { value: 'feet', label: 'Feet' },
  { value: 'yards', label: 'Yards' },
]

export const AREA_UNITS: { value: AreaUnit; label: string }[] = [
  { value: 'acres', label: 'Acres' },
  { value: 'square-miles', label: 'Square Miles' },
  { value: 'square-kilometers', label: 'Square Kilometers' },
  { value: 'square-meters', label: 'Square Meters' },
  { value: 'square-feet', label: 'Square Feet' },
  { value: 'hectares', label: 'Hectares' },
]

const METERS_PER: Record<LinearUnit, number> = {
  miles: 1609.344,
  kilometers: 1000,
  meters: 1,
  feet: 0.3048,
  yards: 0.9144,
}

const SQM_PER: Record<AreaUnit, number> = {
  acres: 4046.8564224,
  'square-miles': 2589988.110336,
  'square-kilometers': 1_000_000,
  'square-meters': 1,
  'square-feet': 0.09290304,
  hectares: 10_000,
}

const LINEAR_SUFFIX: Record<LinearUnit, string> = {
  miles: 'mi',
  kilometers: 'km',
  meters: 'm',
  feet: 'ft',
  yards: 'yd',
}

const AREA_SUFFIX: Record<AreaUnit, string> = {
  acres: 'ac',
  'square-miles': 'mi²',
  'square-kilometers': 'km²',
  'square-meters': 'm²',
  'square-feet': 'ft²',
  hectares: 'ha',
}

export function metersToLinear(meters: number, unit: LinearUnit): number {
  return meters / METERS_PER[unit]
}

export function sqMetersToArea(sqMeters: number, unit: AreaUnit): number {
  return sqMeters / SQM_PER[unit]
}

// read each time, so the editor's live changes show
const precision = () => Math.max(0, Math.min(10, widgetSettings<MeasureSettings>('measure')?.precision ?? 2))

function round(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: precision(),
    maximumFractionDigits: precision(),
  })
}

export function formatLinear(meters: number, unit: LinearUnit): string {
  return `${round(metersToLinear(meters, unit))} ${LINEAR_SUFFIX[unit]}`
}

export function formatArea(sqMeters: number, unit: AreaUnit): string {
  return `${round(sqMetersToArea(sqMeters, unit))} ${AREA_SUFFIX[unit]}`
}
