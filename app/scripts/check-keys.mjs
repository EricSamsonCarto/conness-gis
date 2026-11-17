// scans the build for API keys shipped to visitors. warns, never fails
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProject } from './project.mjs'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = resolveProject(process.env.CONNESS_PROJECT)
const distDir = path.join(appDir, 'dist', project.id)

if (!fs.existsSync(distDir)) {
  process.exit(0)
}

// keys in layer/basemap URLs
const URL_PARAM_RE =
  /[?&](key|token|apikey|api[_-]?key|access[_-]?token|client[_-]?secret)=([^&"'\\\s]{6,})/gi

// keys in config objects, maybe quoted, since project JSON stays JSON
const CONFIG_FIELD_RE = /\b(apiKey|clientSecret)["']?\s*:\s*["']([^"']{6,})["']/g

const PLACEHOLDER_RE = /^(undefined|null|true|false)$|your[_-]?|xxxx/i
// code, not a key, like an esri-gl placeholder or `options.token`
const CODE_RE = /^\$\{|^[A-Za-z_$][\w$]*(\.[\w$]+)+$/

function isPlaceholder(value) {
  return PLACEHOLDER_RE.test(value) || CODE_RE.test(value)
}

const mask = (v) => (v.length > 6 ? `${v.slice(0, 4)}…` : v)

// a value in none of these most likely belongs to a dependency
function userFiles() {
  const files = ['settings.json', 'layers.json', 'basemaps.json', 'theme.json'].map((name) => path.join(project.dir, name))
  for (const entry of fs.readdirSync(appDir)) if (entry.startsWith('.env')) files.push(path.join(appDir, entry))
  return files
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile())
}

function userLocation(value, files) {
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const i = lines.findIndex((line) => line.includes(value))
    if (i !== -1) return `${path.relative(appDir, file)}:${i + 1}`
  }
  return null
}

// masks a wider slice first so a key cut by the window edge can't leak
function snippet({ text, index, length }, values) {
  const pad = 40 + Math.max(...values.map((v) => v.length))
  const from = Math.max(0, index - pad)
  const before = maskAll(text.slice(from, index), values)
  const match = maskAll(text.slice(index, index + length), values)
  const after = maskAll(text.slice(index + length, index + length + pad), values)
  return (before.slice(-40) + match + after.slice(0, 40)).replace(/\s+/g, ' ').trim()
}

function maskAll(s, values) {
  for (const v of values) s = s.replaceAll(v, mask(v))
  return s
}

function walk(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.name.endsWith('.js')) files.push(full)
  }
  return files
}

const findings = []
const seen = new Set()
const sources = userFiles()

for (const file of walk(distDir)) {
  const text = fs.readFileSync(file, 'utf8')
  const relFile = path.relative(distDir, file)

  for (const re of [URL_PARAM_RE, CONFIG_FIELD_RE]) {
    for (const match of text.matchAll(re)) {
      const [text0, name, value] = match
      if (isPlaceholder(value)) continue
      const dedupeKey = `${relFile}:${name}:${value}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      findings.push({
        file: relFile,
        name,
        value,
        from: userLocation(value, sources),
        at: { text, index: match.index, length: text0.length },
      })
    }
  }
}

if (findings.length > 0) {
  // user config keys first
  findings.sort((a, b) => Number(!a.from) - Number(!b.from))
  const values = findings.map((f) => f.value)
  const list = findings
    .map(({ file, name, value, from, at }) =>
      [
        `   ${name}=${mask(value)}`,
        from
          ? `     from your config: ${from}`
          : `     not in your config files. Probably a dependency's code (${file})`,
        `     …${snippet(at, values)}…`,
      ].join('\n'),
    )
    .join('\n\n')

  console.warn(`
! Possible API key(s) found in the built app (app/dist/${project.id}):

${list}

   This is a static, client-side app: anyone who opens your deployed site
   can read these values in the network tab or view-source. Moving a key
   into .env doesn't change that. Vite inlines it into this same bundle.

   To reduce the risk:
     1. Restrict the key to your domain in the provider's dashboard (HTTP
        referrer / domain restriction: MapTiler, Mapbox, Esri, Google, etc.),
        so a scraped key can't be reused elsewhere.
     2. For a key that must stay fully secret (billing-sensitive, write
        access, no domain-restriction option), proxy the request through a
        server/edge function so it never reaches the browser.

   Conness GIS doesn't manage or secure your API keys. Protecting them
   once deployed is your responsibility.
`)
}

process.exit(0)
