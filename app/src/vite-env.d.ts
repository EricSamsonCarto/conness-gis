/// <reference types="vite/client" />

// all widgets in dev, only placed ones in a build (widget-configs-plugin.ts)
declare module 'virtual:widget-configs' {
  const modules: Record<string, { manifest: import('@/core/widget-types').WidgetManifest }>
  export default modules
}
