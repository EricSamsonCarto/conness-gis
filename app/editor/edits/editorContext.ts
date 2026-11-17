import { createContext, useContext, useEffect, useState } from 'react'
import type { SearchResult } from '../settings/searchIndex'
import type { PanelEntry, SettingEntry } from '../settings/settingsMap'
import { schemaInfo } from '../settings/schemaInfo'

export type Files = Record<string, Record<string, unknown>>
// the preview's camera, for "Use current view"
export type View = { center: [number, number]; zoom: number; bearing: number; pitch: number; bounds: [[number, number], [number, number]] }

// answers are matched by id and cached per session
// a failed one isn't kept, so the next ask tries again
const answerCache = new Map<string, Promise<unknown>>()
let nextAsk = 0
export function askPreview<T>(
  question: string,
  details: Record<string, unknown> = {},
  { cache = false, timeout = 20000 } = {},
): Promise<T> {
  const key = `${question}:${JSON.stringify(details)}`
  const cached = cache && answerCache.get(key)
  if (cached) return cached as Promise<T>
  const promise = new Promise<T>((resolve, reject) => {
    const pane = document.querySelector<HTMLIFrameElement>('iframe[title="The Preview Pane"]')?.contentWindow
    if (!pane) return reject(new Error("The Preview Pane isn't open."))
    const id = ++nextAsk
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.source !== pane || e.data?.type !== 'conness:answer' || e.data.id !== id) return
      done()
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.value as T)
    }
    const timer = setTimeout(() => {
      done()
      reject(new Error("The preview didn't answer."))
    }, timeout)
    window.addEventListener('message', onMessage)
    pane.postMessage({ type: 'conness:ask', id, question, ...details }, '*')
  })
  if (cache) {
    promise.catch(() => answerCache.delete(key))
    answerCache.set(key, promise)
  }
  return promise
}

// the preview's answer as state, nothing is asked while `details` is null
export function usePreviewAnswer<T>(
  question: string,
  details: Record<string, unknown> | null,
): { loading: boolean; value?: T; error?: string } {
  const key = details && JSON.stringify(details)
  const [state, setState] = useState<{ key?: string | null; value?: T; error?: string }>({})
  useEffect(() => {
    if (key === null) return
    let live = true
    askPreview<T>(question, JSON.parse(key), { cache: true }).then(
      (value) => live && setState({ key, value }),
      (err: Error) => live && setState({ key, error: err.message }),
    )
    return () => {
      live = false
    }
  }, [question, key])
  const current = state.key === key ? state : {}
  return { loading: key !== null && current.value === undefined && !current.error, value: current.value, error: current.error }
}

// the preview's camera for Use current view, null if it doesn't answer
export function getView(): Promise<View | null> {
  return askPreview<View>('view', {}, { timeout: 2000 }).catch(() => null)
}

// read by the preview from the layer's data, a big file takes a while
export function useColumns(layerId: string | undefined): { loading: boolean; columns: string[]; error?: string } {
  const { loading, value, error } = usePreviewAnswer<string[]>('columns', layerId ? { layerId } : null)
  return { loading, columns: value ?? [], error }
}

// any layer's columns, a vector tile source layer's given its name
export function useLayerColumns(
  layerId: string | undefined,
  sourceLayer?: string,
): { loading: boolean; columns: string[]; error?: string } {
  const { loading, value, error } = usePreviewAnswer<string[]>(
    'layer-columns',
    layerId ? { layerId, ...(sourceLayer ? { sourceLayer } : {}) } : null,
  )
  return { loading, columns: value ?? [], error }
}

export type Edit = (file: string, change: (json: Record<string, unknown>) => void) => void

export type EditorState = {
  // the project's folder id, for API calls a control makes itself
  project: string
  files: Files
  edit: Edit
  // the pop-out's screens, bottom first, empty when it's closed
  panel: PanelEntry[]
  openPanel: (entry: PanelEntry) => void
  pushPanel: (entry: PanelEntry) => void
  backPanel: () => void
  closePanel: () => void
  // the one open settings group ('' when all are collapsed)
  openGroup: string
  setOpenGroup: (group: string) => void
  // opens a search result's group and pop-outs, then flashes its row
  reveal: (result: SearchResult) => void
  // one setting by '<file>:<dotted path>', undefined means reset
  setValue: (path: string, value: unknown) => void
  // removes the key, so the default applies again
  resetValue: (path: string) => void
  // Refresh Settings once the edits made alongside have landed
  refreshSoon: () => void
  // a removed layer's file in layers/, moved to _trash on the next Save
  trashOnSave: (file: string) => void
  // validation problems shown under a row, and counted on its group's header
  problemsAt: (path: string) => string[]
  groupProblems: (group: string) => number
}

export const EditorContext = createContext<EditorState | null>(null)

export function useEditor(): EditorState {
  const state = useContext(EditorContext)
  if (!state) throw new Error('useEditor needs an EditorContext provider')
  return state
}

export function valueAt(files: Files, path: string): unknown {
  const [file, dotted] = path.split(':')
  const keys = dotted.replace(/\.\*$/, '').split('.').filter(Boolean)
  return keys.reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], files[file])
}

export function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (Array.isArray(value)) return value.join(', ')
  if (value !== null && typeof value === 'object') return 'Custom'
  return String(value)
}

// a setting's value as text, or its default shown dimmed
export function describe(entry: SettingEntry, files: Files): { text: string; isDefault: boolean } {
  const value = valueAt(files, entry.path)
  if (value === undefined) {
    const info = schemaInfo(entry.path, files)
    if (info.default !== undefined) return { text: `${formatValue(info.default)} (default)`, isDefault: true }
    if (info.defaultText) return { text: info.defaultText.replace(/`/g, ''), isDefault: true }
    return { text: entry.list ? 'None' : 'Not set', isDefault: true }
  }
  if (entry.list) {
    const n = Array.isArray(value) ? value.length : Object.keys(value as object).length
    return { text: n === 0 ? 'None' : `${n} ${n === 1 ? 'item' : 'items'}`, isDefault: false }
  }
  if (entry.path.endsWith('.*')) return { text: `${Object.keys(value as object).length} set`, isDefault: false }
  if (entry.path === 'settings:map.style') {
    // a style URL means little to a reader, so name its basemap
    const basemaps = (files.basemaps?.basemaps ?? []) as { id: string; name: string; style: unknown }[]
    const match = basemaps.find((b) => JSON.stringify(b.style) === JSON.stringify(value))
    return { text: match ? match.name : typeof value === 'string' ? 'Custom style URL' : 'Custom style', isDefault: false }
  }
  return { text: formatValue(value), isDefault: false }
}
