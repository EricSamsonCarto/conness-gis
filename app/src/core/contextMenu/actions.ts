import type { ContextMenuConfig } from '../types'

export interface ClickLocation {
  lng: number
  lat: number
  zoom: number
}

export interface ContextMenuItem {
  label: string
  url?: string
  action?: 'center'
}

export function fillUrlTemplate(template: string, loc: ClickLocation): string {
  const lat = loc.lat.toFixed(6)
  const lng = loc.lng.toFixed(6)
  return template
    .replaceAll('{lat}', lat)
    .replaceAll('{lng}', lng)
    .replaceAll('{zoom}', loc.zoom.toFixed(2))
}

function googleMapsUrl(loc: ClickLocation): string {
  // GMaps zoom runs ~1.2 tighter than MapLibre
  const zoom = (loc.zoom + 1.2).toFixed(2)
  return `https://www.google.com/maps/@${loc.lat},${loc.lng},${zoom}z`
}
function googleStreetViewUrl(loc: ClickLocation): string {
  return `https://www.google.com/maps?layer=c&cbll=${loc.lat},${loc.lng}`
}
function osmUrl(loc: ClickLocation): string {
  return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=${Math.round(loc.zoom)}/${loc.lat}/${loc.lng}`
}
function appleMapsUrl(loc: ClickLocation): string {
  return `https://maps.apple.com/?ll=${loc.lat},${loc.lng}`
}
function copernicusUrl(loc: ClickLocation): string {
  return `https://browser.dataspace.copernicus.eu/?lat=${loc.lat}&lng=${loc.lng}&zoom=${Math.round(loc.zoom)}`
}

// [] suppresses the menu
export function buildContextMenuItems(
  config: ContextMenuConfig,
  loc: ClickLocation,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = []

  if (config.centerHere) items.push({ label: 'Center here', action: 'center' })
  if (config.googleMaps)
    items.push({ label: 'Open in Google Maps', url: googleMapsUrl(loc) })
  if (config.googleStreetView)
    items.push({ label: 'Open in Street View', url: googleStreetViewUrl(loc) })
  if (config.osm)
    items.push({ label: 'Open in OpenStreetMap', url: osmUrl(loc) })
  if (config.appleMaps)
    items.push({ label: 'Open in Apple Maps', url: appleMapsUrl(loc) })
  if (config.copernicus)
    items.push({ label: 'Open in Copernicus Browser', url: copernicusUrl(loc) })

  for (const custom of config.custom ?? []) {
    items.push({ label: custom.label, url: fillUrlTemplate(custom.url, loc) })
  }

  return items
}
