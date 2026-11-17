import { escapeXml, geometryKml, kmlColor, kmlDocument, POINT_ICON } from '@/core/export/writeKML'
import { DEFAULT_FONT_SIZE, DEFAULT_STYLE, DEFAULT_TEXT, type DrawingSetPayload } from './DrawController'

// KML has no shadows or halos, text is a labeled point with no icon
export function drawingsToKML(payload: DrawingSetPayload, documentName: string): string {
  const placemarks = payload.features.map((sf, i) => {
    const s = { ...DEFAULT_STYLE, ...sf.meta.style }
    const kind = sf.meta.kind
    let style: string
    let name = sf.meta.name
    if (kind === 'line') {
      style = `<LineStyle><color>${kmlColor(s.color)}</color><width>${s.width}</width></LineStyle>`
    } else if (kind === 'polygon') {
      style =
        `<LineStyle><color>${kmlColor(s.boundaryColor ?? s.color, s.boundaryOpacity)}</color><width>${s.width}</width></LineStyle>` +
        `<PolyStyle><color>${kmlColor(s.color, s.fillOpacity)}</color><fill>1</fill><outline>1</outline></PolyStyle>`
    } else if (kind === 'text') {
      name = s.text ?? DEFAULT_TEXT
      style =
        `<IconStyle><scale>0</scale></IconStyle>` +
        `<LabelStyle><color>${kmlColor(s.color)}</color><scale>${((s.fontSize ?? DEFAULT_FONT_SIZE) / 16).toFixed(2)}</scale></LabelStyle>`
    } else {
      style =
        `<IconStyle><color>${kmlColor(s.color)}</color><scale>${(s.radius / 8).toFixed(2)}</scale>` +
        `<Icon><href>${POINT_ICON}</href></Icon></IconStyle><LabelStyle><scale>0</scale></LabelStyle>`
    }
    return (
      `<Placemark><name>${escapeXml(name)}</name><Style>${style}</Style>` +
      `<ExtendedData><Data name="id"><value>${i + 1}</value></Data>` +
      `<Data name="name"><value>${escapeXml(sf.meta.name)}</value></Data>` +
      `<Data name="shape_type"><value>${kind}</value></Data></ExtendedData>` +
      geometryKml(sf.geometry) +
      `</Placemark>`
    )
  })
  return kmlDocument(documentName, placemarks.join('\n'))
}
