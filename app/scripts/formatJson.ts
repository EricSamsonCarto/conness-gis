// a container stays on one line when it fits, else one entry per line
// the same for new projects, Save and re-saved hand edits
export function formatJson(value: unknown, maxLength = 100): string {
  return format(value, '', 0) + '\n'

  // `used`: columns already taken on this line before the value (indent, key)
  function format(v: unknown, indent: string, used: number): string {
    const line = oneLine(v)
    // +1 for a trailing comma
    if (typeof v !== 'object' || v === null || used + line.length + 1 <= maxLength) return line
    const inner = indent + '  '
    const rows = Array.isArray(v)
      ? v.map((item) => inner + format(item ?? null, inner, inner.length))
      : Object.entries(v)
          .filter(([, val]) => val !== undefined)
          .map(([key, val]) => {
            const head = `${inner}${JSON.stringify(key)}: `
            return head + format(val, inner, head.length)
          })
    if (rows.length === 0) return line
    const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}']
    return `${open}\n${rows.join(',\n')}\n${indent}${close}`
  }

  function oneLine(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map((item) => oneLine(item ?? null)).join(', ')}]`
    if (typeof v === 'object' && v !== null) {
      const entries = Object.entries(v).filter(([, val]) => val !== undefined)
      if (entries.length === 0) return '{}'
      return `{ ${entries.map(([key, val]) => `${JSON.stringify(key)}: ${oneLine(val)}`).join(', ')} }`
    }
    return JSON.stringify(v)
  }
}
