// in a union, the data at that point picks the variant
// no imports, so tests run it under plain node

export type Node = {
  description?: string
  default?: unknown
  defaultText?: string
  see?: string
  type?: string
  enum?: string[]
  const?: unknown
  minimum?: number
  maximum?: number
  required?: string[]
  properties?: Record<string, Node>
  items?: Node | Node[]
  anyOf?: Node[]
  oneOf?: Node[]
  allOf?: Node[]
}

// shared schemas sit once under definitions, so put each back in place
export function inlineRefs(root: Node): Node {
  const { definitions, $defs } = root as { definitions?: Record<string, unknown>; $defs?: Record<string, unknown> }
  const defs = definitions ?? $defs ?? {}
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') return value
    const { $ref, ...rest } = value as Record<string, unknown>
    const { allOf, ...out } = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, visit(v)]))
    // draft-7 wraps a ref that has its own description in a one-item allOf
    if (Array.isArray(allOf) && allOf.length === 1 && rest.allOf && (rest.allOf as { $ref?: unknown }[])[0].$ref) {
      return { ...(allOf[0] as object), ...out }
    }
    if (allOf) out.allOf = allOf
    return typeof $ref === 'string' ? { ...(visit(defs[$ref.split('/').pop()!]) as object), ...out } : out
  }
  return visit(root) as Node
}

const unionOf = (node: Node) => [...(node.anyOf ?? []), ...(node.oneOf ?? [])]

// a variant fits when its fixed fields match, a missing one counts
// when the variant doesn't require it
function fits(variant: Node, data: unknown): boolean {
  const union = unionOf(variant)
  if (union.length > 0) return union.some((v) => fits(v, data))
  if (!data || typeof data !== 'object') return true
  for (const [key, prop] of Object.entries(variant.properties ?? {})) {
    if (!('const' in prop)) continue
    const value = (data as Record<string, unknown>)[key]
    if (value === undefined ? variant.required?.includes(key) : value !== prop.const) return false
  }
  return true
}

// on a list an index is the item, any other key a field of every item
function child(node: Node, key: string, data: unknown): Node | undefined {
  if (node.properties?.[key]) return node.properties[key]
  if (node.items && !Array.isArray(node.items)) return /^\d+$/.test(key) ? node.items : child(node.items, key, data)
  const variants = [...unionOf(node), ...(node.allOf ?? [])]
  const ordered = data === undefined ? variants : [...variants.filter((v) => fits(v, data)), ...variants.filter((v) => !fits(v, data))]
  for (const variant of ordered) {
    const found = child(variant, key, data)
    if (found) return found
  }
}

// without `data`, the first variant with the key wins
export function walk(root: Node, keys: string[], data: unknown): Node | undefined {
  let node: Node | undefined = root
  let at = data
  for (const key of keys) {
    node = node && child(node, key, at)
    at = at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined
  }
  return node
}

// the variant that describes `data`, through nested unions
export function resolve(node: Node, data: unknown): Node {
  const match = unionOf(node).find((v) => fits(v, data))
  return match ? resolve(match, data) : node
}
