import type { ProjectFile } from '@/core/schema/settings'
import { PROJECT_SCHEMAS } from '../settings/widgetSchemas'
import { isColorName } from '../colorNames'
import type { Files } from './editorContext'
import { THEME_COLOR_NAMES } from '../settings/settingsMap'

// a problem in the draft, at '<file>:<dotted path>'
export type Problem = { path: string; message: string }

// cross-setting checks like layout collisions aren't here
// they still show in the preview
export function validateDraft(files: Files): Problem[] {
  return [...schemaProblems(files), ...colorNameProblems(files)]
}

// a theme color that isn't a name passes the schema but blanks the color
function colorNameProblems(files: Files): Problem[] {
  const colors = (files.theme?.colors ?? {}) as Record<string, unknown>
  return Object.entries(colors)
    .filter(([, v]) => typeof v === 'string' && !isColorName(v, THEME_COLOR_NAMES))
    .map(([token, v]) => ({
      path: `theme:colors.${token}`,
      message: `'${v}' isn't a color name. Use a palette name (blue-700, white) or another color's name (primary).`,
    }))
}

function schemaProblems(files: Files): Problem[] {
  return (Object.keys(PROJECT_SCHEMAS) as ProjectFile[]).flatMap((file) => {
    if (!files[file]) return []
    const json = { ...files[file] }
    delete json.$schema
    const result = PROJECT_SCHEMAS[file].safeParse(json)
    if (result.success) return []
    return result.error.issues.map((issue) => ({
      path: `${file}:${issue.path.map(String).join('.')}`,
      // Zod's wording for a missing value reads oddly in a form
      message: /received undefined/.test(issue.message) ? 'Required.' : issue.message,
    }))
  })
}
