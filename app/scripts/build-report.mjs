// after a build, splits the size into layer data and app code
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { resolveProject } from './project.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(appDir, 'dist', resolveProject(process.env.CONNESS_PROJECT).id)

if (!fs.existsSync(distDir)) {
  process.exit(0)
}

const LAYER_RE = /\.(geojson|json|pmtiles|fgb|parquet|geoparquet)$/i
const CODE_RE = /\.(js|css)$/i

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

let layers = 0
let code = 0
let codeGzip = 0
let other = 0
for (const file of walk(distDir)) {
  const size = fs.statSync(file).size
  if (LAYER_RE.test(file)) layers += size
  else if (CODE_RE.test(file)) {
    code += size
    codeGzip += zlib.gzipSync(fs.readFileSync(file)).length
  } else other += size
}

const total = layers + code + other
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const pct = (bytes) => `${Math.round((100 * bytes) / total)}%`

console.log(`
Build size: ${mb(total)}
   Your layer files    ${mb(layers).padStart(9)}   ${pct(layers)} of the build
   App code (JS, CSS)  ${mb(code).padStart(9)}   ${(codeGzip / 1024).toFixed(0)} kB gzipped
   Other (images, …)   ${mb(other).padStart(9)}
`)
