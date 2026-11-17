import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import type { ProjectConfigApi } from './project-config-plugin.ts'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// `preview` serves the unsaved edits, `saved` only the files on disk
export type Slot = 'preview' | 'saved'
type Running = { id: string; server: ViteDevServer; url: string }

const running: Partial<Record<Slot, Running>> = {}
// one at a time, vite.config.ts reads CONNESS_PROJECT as the server starts
let queue: Promise<unknown> = Promise.resolve()

export function startAppServer(slot: Slot, id: string): Promise<Running> {
  const next = queue.then(async () => {
    const current = running[slot]
    if (current?.id === id) return current
    await current?.server.close()
    delete running[slot]

    process.env.CONNESS_PROJECT = id
    const server = await createServer({
      root: appDir,
      configFile: path.join(appDir, 'vite.config.ts'),
      server: { port: 5180, strictPort: false, open: false },
    })
    await server.listen()
    const url = server.resolvedUrls?.local[0]
    if (!url) throw new Error(`[conness-gis] the ${slot} server for "${id}" didn't report a URL`)
    running[slot] = { id, server, url }
    return running[slot]
  })
  queue = next.catch(() => {})
  return next
}

export function setDraft(server: ViteDevServer, files: Parameters<ProjectConfigApi['setDraft']>[0], live = false): void {
  const plugin = server.config.plugins.find((p) => p.name === 'conness-project-config')
  ;(plugin?.api as ProjectConfigApi | undefined)?.setDraft(files, live)
}

export async function closeAppServers(): Promise<void> {
  await Promise.all(Object.values(running).map((r) => r.server.close()))
}

// this project's preview server if it's running, Save clears its draft
export function runningPreview(id: string): ViteDevServer | undefined {
  return running.preview?.id === id ? running.preview.server : undefined
}
