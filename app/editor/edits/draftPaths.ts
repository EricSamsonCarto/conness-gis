// one setting in a project file's JSON, by dotted path
type Json = Record<string, unknown>

const keysOf = (dotted: string) => dotted.split('.').filter(Boolean)

// creates the parent objects it needs
export function setAt(json: Json, dotted: string, value: unknown): void {
  const keys = keysOf(dotted)
  let node = json
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {}
    node = node[key] as Json
  }
  node[keys.at(-1)!] = value
}

// removes any parent it left empty, so Reset never leaves an empty {}
export function removeAt(json: Json, dotted: string): void {
  const keys = keysOf(dotted)
  const chain: Json[] = [json]
  for (const key of keys.slice(0, -1)) {
    const next = chain.at(-1)![key]
    if (!next || typeof next !== 'object') return
    chain.push(next as Json)
  }
  delete chain.at(-1)![keys.at(-1)!]
  for (let i = chain.length - 1; i > 0; i--) {
    if (Object.keys(chain[i]).length > 0) break
    delete chain[i - 1][keys[i - 1]]
  }
}

// the setting's own row, else the closest row above it
export function nearestEntry(problemPath: string, entryPaths: string[]): string | undefined {
  const rows = new Set(entryPaths.map((p) => p.replace(/\.\*$/, '')))
  const [file, dotted] = problemPath.split(':')
  const keys = keysOf(dotted)
  for (let n = keys.length; n >= 0; n--) {
    const candidate = `${file}:${keys.slice(0, n).join('.')}`
    if (rows.has(candidate)) return entryPaths.find((p) => p.replace(/\.\*$/, '') === candidate)
  }
  return undefined
}
