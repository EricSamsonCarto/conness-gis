// typed here so the engine typechecks with no project present
declare module '@user/settings' {
  export const settings: import('@/core/types').Settings
  // the logo's own size for its <img>, none for a URL logo
  export const logoSize: { width: number; height: number } | null
}
declare module '@user/popups' {
  export const popupTemplates: import('@/core/types').PopupTemplates
}
declare module '@user/symbology' {
  export const symbologies: import('@/core/types').SymbologyRegistry
}
// local data files layers.json points at as URLs, keyed as written
declare module '@user/layer-files' {
  export const layerFiles: Record<string, string>
}
// each basemap's thumbnail URL, the project's own first
declare module '@user/basemap-thumbnails' {
  export const thumbnails: Record<string, string>
}
// info.md as html, built at build time. title is its first # heading
declare module '@user/info' {
  export const title: string
  export const html: string
}
