import { Fragment } from 'react'
import type { PopupTemplate, PopupTemplates } from '@/core/types'

function fieldEntries(
  fields: Record<string, string> | null,
  properties: Record<string, unknown>,
): Array<[key: string, label: string]> {
  return fields ? Object.entries(fields) : Object.keys(properties).map((k) => [k, k])
}

function fieldRows(
  fields: Record<string, string> | null,
  properties: Record<string, unknown>,
) {
  return fieldEntries(fields, properties).map(([key, label], index) => ({
    key,
    label,
    value: String(properties[key] ?? ''),
    stripedClass: index % 2 === 0 ? 'bg-panelBg' : 'bg-surface',
  }))
}

// basic, a key and value table
const BasicPopup: PopupTemplate = ({ title, fields, feature }) => {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const rows = fieldRows(fields, props)

  return (
    <div className="p-3 text-popupBody text-strongText">
      {title && <h3 className="mb-2 text-popupTitle font-semibold">{title}</h3>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(({ key, label, value }) => (
          <Fragment key={key}>
            <dt className="max-w-40 break-words font-medium text-text">{label}</dt>
            <dd className="break-words">{value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

// standard, a striped key and value table
const StandardPopup: PopupTemplate = ({ title, fields, feature }) => {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const rows = fieldRows(fields, props)

  return (
    <div>
      <div className="p-3">
        {title && (
          <h3 className="mb-2 text-center text-popupTitle font-bold text-primary">{title}</h3>
        )}
        <div className="overflow-hidden rounded border border-panelBorder">
          <table className="w-full border-collapse text-popupBody">
            <tbody>
              {rows.map(({ key, label, value, stripedClass }) => (
                <tr key={key} className={stripedClass}>
                  <th
                    scope="row"
                    className="w-1 border-r border-panelBorder px-3 py-2 text-left font-medium text-text"
                  >
                    <span className="block w-max max-w-40 break-words">{label}</span>
                  </th>
                  <td className="w-full break-words px-3 py-2 text-strongText">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// featureHighlights, the first field large, the rest in a table
const FeatureHighlightPopup: PopupTemplate = ({ title, fields, feature }) => {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const rows = fieldRows(fields, props)
  // the rows under the highlight box start plain, so they don't match it
  const [primaryRow, ...secondaryRows] = rows.map((row, i) => ({
    ...row,
    stripedClass: i % 2 === 1 ? 'bg-panelBg' : 'bg-surface',
  }))

  return (
    <div className="p-3 text-strongText">
      {title && (
        <h3 className="mb-3 text-center text-popupTitle font-bold text-primary">
          {title}
        </h3>
      )}

      {primaryRow && (
        <div className="mb-3 rounded border border-panelBorder bg-surface px-3 py-2">
          <div className="text-medium font-medium uppercase tracking-wide text-text">
            {primaryRow.label}
          </div>
          <div className="mt-1 break-words text-popupTitle font-semibold text-strongText">
            {primaryRow.value}
          </div>
        </div>
      )}

      {secondaryRows.length > 0 && (
        <div className="overflow-hidden rounded border border-panelBorder">
          <table className="w-full border-collapse text-popupBody">
            <tbody>
              {secondaryRows.map(({ key, label, value, stripedClass }) => (
                <tr key={key} className={stripedClass}>
                  <th
                    scope="row"
                    className="w-1 border-r border-panelBorder px-3 py-2 text-left font-medium text-text"
                  >
                    <span className="block w-max max-w-40 break-words">{label}</span>
                  </th>
                  <td className="w-full break-words px-3 py-2 text-strongText">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// reference these keys as popup.displayType in layers.json
// the names these show as in the editor's Popup Template list
BasicPopup.displayName = 'Basic'
StandardPopup.displayName = 'Standard'
FeatureHighlightPopup.displayName = 'Feature Highlight'

export const popupTemplates: PopupTemplates = {
  basic: BasicPopup,
  standard: StandardPopup,
  featureHighlights: FeatureHighlightPopup,
}