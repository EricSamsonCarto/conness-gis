import { z } from 'zod'
import { labelFor, type DependsOn, type Entry, type Section } from './settingsMap.ts'
import { inlineRefs, type Node as SchemaNode } from './schemaNodes.ts'

// a new widget gets its block with no editor code
// no Vite-only code, the editor and tests both call it
type Node = {
  type?: string
  properties?: Record<string, Node>
  label?: string
  advanced?: boolean
  dependsOn?: { path: string; equals?: unknown }
  editor?: string
  popout?: boolean
}

const at = (id: string, path: string) => `settings:widgets.${id}.${path}`

export function widgetSection(id: string, label: string, schema: z.ZodType): Section {
  const root = inlineRefs(z.toJSONSchema(schema, { target: 'draft-7', io: 'input', unrepresentable: 'any' }) as SchemaNode) as Node
  const walk = (node: Node, trail: string[], advanced: boolean, settings: Entry[]) => {
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      const path = [...trail, key].join('.')
      const isAdvanced = advanced || child.advanced === true
      if (child.editor) {
        const name = child.label ?? key
        settings.push({
          panel: child.editor,
          label: name,
          screen: child.editor as Extract<Entry, { panel: string }>['screen'],
          advanced: isAdvanced || undefined,
          param: at(id, path),
          sections: [{ settings: [{ path: at(id, path), list: true }] }],
        })
      } else if (child.type === 'object' && child.properties && child.popout) {
        const inner: Entry[] = []
        walk(child, [...trail, key], false, inner)
        settings.push({
          panel: `${id}-${path}`,
          label: child.label ?? labelFor({ path: at(id, path) }),
          advanced: isAdvanced || undefined,
          sections: [{ settings: inner }],
        })
      } else if (child.type === 'object' && child.properties) {
        walk(child, [...trail, key], isAdvanced, settings)
      } else {
        const dependsOn: DependsOn | undefined = child.dependsOn && {
          path: at(id, child.dependsOn.path),
          ...('equals' in child.dependsOn ? { equals: child.dependsOn.equals } : {}),
        }
        settings.push({
          path: at(id, path),
          ...(child.label ? { label: child.label } : {}),
          ...(isAdvanced ? { advanced: true } : {}),
          ...(dependsOn ? { dependsOn } : {}),
        })
      }
    }
  }
  const settings: Entry[] = []
  walk(root, [], false, settings)
  return { name: label, widget: id, settings }
}

// every widget with settings, in the order given
export function widgetSections(widgets: { id: string; label: string; schema: z.ZodType }[]): Section[] {
  return widgets.map((w) => widgetSection(w.id, w.label, w.schema))
}
