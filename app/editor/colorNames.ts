// each becomes var(--color-<name>), so anything else silently blanks it
const HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const PALETTE = new RegExp(`^(${HUES.join('|')})-(50|100|200|300|400|500|600|700|800|900|950)$`)
const PLAIN = new Set(['white', 'black', 'transparent', 'primaryDarker'])

// names are case-sensitive, 'Text' isn't 'text'
export function isColorName(value: string, tokens: string[]): boolean {
  return PALETTE.test(value) || PLAIN.has(value) || tokens.includes(value)
}
