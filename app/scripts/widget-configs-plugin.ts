import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { configError } from '../src/core/configError.ts'
import { placedWidgetIds } from '../src/core/widgets/placedWidgets.ts'
import { loadProject } from './project-config-plugin.ts'

const MODULE_ID = 'virtual:widget-configs'
const RESOLVED_ID = '\0' + MODULE_ID

// folders starting with _ are skipped (widgets/_template)
function widgetFolders(widgetsDir: string): string[] {
  return fs
    .readdirSync(widgetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .filter((d) => fs.existsSync(path.join(widgetsDir, d.name, 'widget.config.ts')))
    .map((d) => d.name)
    .sort()
}

// every widget in dev, only the placed ones in a build
export function widgetConfigs(projectDir: string): Plugin {
  let config: ResolvedConfig
  // worked out once in buildStart, so the log prints before the progress line
  let placedInBuild: string[] | undefined

  async function ids(widgetsDir: string): Promise<string[]> {
    const folders = widgetFolders(widgetsDir)
    if (config.command !== 'build') return folders
    const placed = placedWidgetIds(loadProject(projectDir, config.env).settings)
    for (const id of placed) {
      if (!folders.includes(id)) {
        throw configError({
          where: `Widget "${id}" in ${path.relative(config.root, path.join(projectDir, 'settings.json'))}`,
          why: 'has no folder in app/widgets/',
          fix: `known widgets: ${folders.join(', ') || '(none)'}. Check the name, or add the widget folder`,
        })
      }
    }
    const left = folders.filter((f) => !placed.includes(f))
    config.logger.info(`widgets: bundling ${placed.join(', ') || '(none)'} · left out: ${left.join(', ') || '(none)'}`)
    return placed
  }

  return {
    name: 'conness-widget-configs',
    configResolved(resolved) {
      config = resolved
    },
    async buildStart() {
      if (config.command === 'build') placedInBuild = await ids(path.join(config.root, 'widgets'))
    },
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : undefined
    },
    async load(id) {
      if (id !== RESOLVED_ID) return
      const widgetsDir = path.join(config.root, 'widgets')
      const list = placedInBuild ?? (await ids(widgetsDir))
      const imports = list.map(
        (w, i) => `import * as w${i} from ${JSON.stringify(path.join(widgetsDir, w, 'widget.config.ts'))}`,
      )
      const entries = list.map((w, i) => `  ${JSON.stringify(`/widgets/${w}/widget.config.ts`)}: w${i},`)
      return `${imports.join('\n')}\nexport default {\n${entries.join('\n')}\n}\n`
    },
    configureServer(server) {
      // a widget folder added or removed in dev rebuilds the list
      const widgetsDir = path.join(config.root, 'widgets')
      const refresh = (file: string) => {
        if (path.dirname(path.dirname(file)) !== widgetsDir || !file.endsWith('widget.config.ts')) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}
