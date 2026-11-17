import type {
  PopupLayer,
  PopupTrigger,
  PopupUiConfig,
  ResolvedPopupConfig,
} from '../types'

const SHELL_DEFAULT_TRIGGER: PopupTrigger = 'click'
const SHELL_DEFAULT_DISPLAY_TYPE = 'standard'
const SHELL_DEFAULT_ZOOM_TO_FEATURE = true
const SHELL_DEFAULT_COPY_COORDINATES = false
const SHELL_DEFAULT_VIEW_IN_GOOGLE_MAPS = false
const SHELL_DEFAULT_HIGHLIGHT = true

export function resolvePopup(
  layer: PopupLayer,
  uiPopups: PopupUiConfig | undefined,
): ResolvedPopupConfig | null {
  const layerPopup = layer.popup
  if (layerPopup === undefined) return null
  if (layerPopup === false) return null
  if (layerPopup.enabled === false) return null

  const trigger =
    layerPopup?.trigger ?? uiPopups?.trigger ?? SHELL_DEFAULT_TRIGGER
  const displayType =
    layerPopup?.displayType ?? uiPopups?.displayType ?? SHELL_DEFAULT_DISPLAY_TYPE
  const position = layerPopup?.position ?? uiPopups?.position ?? 'bottom-left'
  const zoomToFeature =
    layerPopup?.zoomToFeature ?? uiPopups?.zoomToFeature ?? SHELL_DEFAULT_ZOOM_TO_FEATURE
  const copyCoordinates =
    layerPopup?.copyCoordinates ?? uiPopups?.copyCoordinates ?? SHELL_DEFAULT_COPY_COORDINATES
  const viewInGoogleMaps =
    layerPopup?.viewInGoogleMaps ??
    uiPopups?.viewInGoogleMaps ??
    SHELL_DEFAULT_VIEW_IN_GOOGLE_MAPS
  const highlight = layerPopup?.highlight ?? uiPopups?.highlight ?? SHELL_DEFAULT_HIGHLIGHT

  return {
    trigger,
    position,
    displayType,
    title: layerPopup?.title,
    fields: layerPopup?.fields ?? null,
    header: layerPopup?.header,
    group: layer.group,
    zoomToFeature,
    copyCoordinates,
    viewInGoogleMaps,
    highlight,
  }
}
