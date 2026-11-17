import { layerFiles } from '@user/layer-files'

// only the files layers.json points at, keyed as ./layers/x
const layerUrls: Record<string, string> = layerFiles

// a file from the project's layers/ folder, built into the app
export function isBundledLayerFile(url: string): boolean {
  return Object.values(layerUrls).includes(url)
}

function isAbsoluteUrl(path: string): boolean {
  return /^[a-z]+:\/\//i.test(path) || path.startsWith('//')
}

export function resolveLayerUrl(userPath: string): string {
  if (isAbsoluteUrl(userPath)) return userPath

  const key = './' + userPath.replace(/^\.?\//, '')
  const url = layerUrls[key]
  if (!url) {
    const known = Object.keys(layerUrls).sort().join(', ') || "(none, check your project's layers/ folder)"
    throw new Error(
      `Layer file not found at "${userPath}". Drop the file in your project's layers/ folder (app/projects/<name>/layers/) and reference it as e.g. "./layers/parks.geojson". Found: ${known}`,
    )
  }
  return url
}
