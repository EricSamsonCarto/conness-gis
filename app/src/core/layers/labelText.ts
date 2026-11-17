import type { ExpressionSpecification } from 'maplibre-gl'

// a label's `text` template as an expression, a missing column shows nothing
export function labelTextExpression(template: string): ExpressionSpecification | string {
  const parts = template.split(/\{([^{}]+)\}/)
  if (parts.length === 1) return template
  const pieces = parts
    .map((part, i) => (i % 2 === 1 ? ['coalesce', ['to-string', ['get', part.trim()]], ''] : part))
    .filter((piece) => piece !== '')
  return ['concat', ...pieces] as ExpressionSpecification
}
