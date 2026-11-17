import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { api, type Upgraded } from './project/api'
import { UpgradedNotice } from './project/UpgradedNotice'
import { Modal } from './Modal'
import { DEVICES, type Device } from './preview/devices'
import { PreviewCanvas } from './preview/PreviewCanvas'
import { SettingsPanel } from './settings/SettingsPanel'
import { ResetAll } from './settings/ResetAll'
import { SettingsSearch } from './settings/SettingsSearch'
import { EditorContext, valueAt, type Files } from './edits/editorContext'
import { PopoutPanel } from './panel/PopoutPanel'
import { SETTINGS_MAP, allSections, isPanel, type PanelEntry } from './settings/settingsMap'
import { buildIndex, type SearchResult } from './settings/searchIndex'
import { nearestEntry, removeAt, setAt } from './edits/draftPaths'
import { validateDraft, type Problem } from './edits/validate'
import { loadPref, savePref, useDrag } from './useDrag'
import { button, smallButton } from './ui'
import { WIDGET_SECTIONS } from './settings/widgetSchemas'
import { BuildDialog } from './project/BuildDialog'
import { changedPaths, isLive, liveChanges } from './preview/liveAreas'

type Settings = { branding: { title: string } }

// settings inside custom screens aren't rows, so their problems show
// at the top of the sidebar instead
const EVERY_SECTION = [...allSections(), ...allSections(WIDGET_SECTIONS)]
const IN_SCREENS = new Set(
  EVERY_SECTION.flatMap((s) => s.settings)
    .flatMap((e) => (isPanel(e) && e.screen ? allSections(e.sections).flatMap((s) => s.settings) : []))
    .flatMap((e) => (isPanel(e) ? [] : [e.path])),
)
const ROW_PATHS = EVERY_SECTION.flatMap((s) => s.settings.flatMap((e) => (isPanel(e) ? [] : [e.path])))
  .filter((path) => !IN_SCREENS.has(path))
// blocks that are on while their key exists, a reset inside one keeps it
const ON_OFF_BLOCKS = [
  ...allSections().flatMap((s) => (s.toggle ? [s.toggle] : [])),
  ...allSections().flatMap((s) => s.settings.flatMap((e) => (!isPanel(e) && e.presence ? [e.path] : []))),
]
// which group each row belongs to, for the problem count on its header
const GROUP_OF = new Map([
  ...SETTINGS_MAP.flatMap((g) =>
    allSections(g.sections).flatMap((s) => s.settings.flatMap((e) => (isPanel(e) ? [] : [[e.path, g.name] as const]))),
  ),
  ...allSections(WIDGET_SECTIONS).flatMap((s) => s.settings.flatMap((e) => (isPanel(e) ? [] : [[e.path, 'Widgets'] as const]))),
])

function placeProblems(problems: Problem[]) {
  const byRow = new Map<string, string[]>()
  const byGroup = new Map<string, number>()
  const loose: Problem[] = []
  for (const problem of problems) {
    const row = nearestEntry(problem.path, ROW_PATHS)
    if (!row) {
      loose.push(problem)
      continue
    }
    byRow.set(row, [...(byRow.get(row) ?? []), problem.message])
    const group = GROUP_OF.get(row)
    if (group) byGroup.set(group, (byGroup.get(group) ?? 0) + 1)
  }
  return { byRow, byGroup, loose }
}

// the sticky top bar's height changes with its width, and the group
// headers stick below it at --settings-top
function measureTopBar(bar: HTMLDivElement | null) {
  if (!bar) return
  const sidebar = bar.parentElement!
  const observer = new ResizeObserver(() => sidebar.style.setProperty('--settings-top', `${bar.offsetHeight}px`))
  observer.observe(bar)
  return () => observer.disconnect()
}

// the pane keeps its camera per page id, so reloading the editor resets it
const EDITOR_PAGE_ID = crypto.randomUUID()

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]
// v2 is wider, since controls sit beside their labels
const SIDEBAR = { key: 'conness-editor:sidebar-v3', min: 280, max: 560, default: 400 }

// a new tab opened before the await, so the browser doesn't block it as a popup
async function openInTab(url: () => Promise<string>) {
  const tab = window.open('', '_blank')
  try {
    const target = await url()
    if (tab) tab.location.href = target
  } catch (err) {
    tab?.close()
    alert(err instanceof Error ? err.message : String(err))
  }
}

export function EditorShell({ id }: { id: string }) {
  const [saved, setSaved] = useState<Files | null>(null)
  const [draft, setDraft] = useState<Files | null>(null)
  const [version, setVersion] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgraded, setUpgraded] = useState<Upgraded | null>(null)
  const [conflict, setConflict] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmBuild, setConfirmBuild] = useState(false)
  // a new number starts a build in BuildDialog
  const [buildRun, setBuildRun] = useState(0)
  const [building, setBuilding] = useState(false)
  // files Remove layer asked to delete, the server skips any still in use
  const [trash, setTrash] = useState<string[]>([])
  // what the pane shows, so Refresh Settings lights up only when needed
  const [applied, setApplied] = useState('')
  const [device, setDevice] = useState<Device>('desktop')
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [fit, setFit] = useState(0)
  // off by default, so scrolling around the canvas doesn't move the map
  const [mapZoom, setMapZoom] = useState(false)
  const [panel, setPanel] = useState<PanelEntry[]>([])
  // all collapsed to start, one open at a time keeps the sidebar short
  const [openGroup, setOpenGroup] = useState('')
  // a row to flash once it renders, n lets the same result flash twice
  const [revealing, setRevealing] = useState<{ target: string; n: number } | null>(null)
  const closePanel = useCallback(() => setPanel([]), [])
  const [sidebarWidth, setSidebarWidth] = useState(() => loadPref(SIDEBAR.key, { width: SIDEBAR.default }).width)
  useEffect(() => savePref(SIDEBAR.key, { width: sidebarWidth }), [sidebarWidth])
  const resizeSidebar = useDrag(
    () => sidebarWidth,
    (start, dx) => setSidebarWidth(Math.max(SIDEBAR.min, Math.min(SIDEBAR.max, start + dx))),
  )

  const at = `/${encodeURIComponent(id)}`
  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(draft)
  // a live change can make it differ from the draft only in key order
  const shown = useMemo(() => (applied ? (JSON.parse(applied) as Files) : null), [applied])
  const stale = draft !== null && (shown === null || changedPaths(shown, draft).length > 0)

  // problems show under the row that holds the setting
  const problems = useMemo(() => (draft ? validateDraft(draft) : []), [draft])
  const { byRow, byGroup, loose } = useMemo(() => placeProblems(problems), [problems])
  const invalid = problems.length > 0
  // the pane can take every change without a reload
  const live = draft !== null && stale && !invalid && shown !== null && isLive(shown, draft)
  // sent after a short pause, even while others wait for Refresh Settings
  const livePart = useMemo(
    () => (draft !== null && stale && !invalid && shown !== null ? liveChanges(shown, draft) : null),
    [draft, stale, invalid, shown],
  )
  const blockedWhy = invalid ? `Fix the ${problems.length === 1 ? 'problem' : `${problems.length} problems`} first` : undefined
  const scale = zoom === 'fit' ? fit : zoom
  // the 0.005 slack keeps the current scale from counting as the next step
  const zoomIn = ZOOM_STEPS.find((s) => s > scale + 0.005)
  const zoomOut = ZOOM_STEPS.findLast((s) => s < scale - 0.005)
  const onFit = useCallback((value: number) => setFit(value), [])

  useEffect(() => {
    api<{ files: Files; version: string; upgraded: Upgraded | null }>(`${at}/files`)
      .then(({ files, version, upgraded }) => {
        setUpgraded(upgraded)
        setSaved(files)
        setDraft(files)
        setVersion(version)
        setApplied(JSON.stringify(files))
        return api<{ url: string }>(`${at}/preview`, 'POST', { files: null })
      })
      .then(({ url }) => setPreviewUrl(url))
      .catch((err) => {
        setRefreshing(false)
        setError(err.message)
      })
  }, [at])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setValue = (path: string, value: unknown) => {
    const [file, dotted] = path.split(':')
    edit(file, (json) => setAt(json, dotted, value))
  }
  const resetValue = (path: string) => {
    const [file, dotted] = path.split(':')
    edit(file, (json) => {
      // removeAt prunes empty parents, but an on/off block survives its
      // last option's reset. resetting the block itself turns it off
      const on = ON_OFF_BLOCKS.filter((p) => path.startsWith(`${p}.`) && valueAt({ [file]: json }, p) !== undefined)
      removeAt(json, dotted)
      for (const block of on) {
        if (valueAt({ [file]: json }, block) === undefined) setAt(json, block.split(':')[1], {})
      }
    })
  }

  function revealFirstProblem() {
    const row = problems.map((p) => nearestEntry(p.path, ROW_PATHS)).find(Boolean)
    const result = row && buildIndex([], WIDGET_SECTIONS).find((e) => e.target === row)
    if (result) reveal({ ...result, notPlaced: false })
  }

  const edit = (file: string, change: (json: Record<string, unknown>) => void) =>
    setDraft((current) => {
      const next = structuredClone(current!)
      change(next[file])
      return next
    })

  // `files`: what to show instead of the whole draft (its live part)
  async function sendDraft(asLive = false, files?: Files) {
    const result = await api<{ url: string }>(`${at}/preview`, 'POST', { files: files ?? (dirty ? draft : null), live: asLive })
    setApplied(JSON.stringify(files ?? draft))
    return result
  }

  function reveal(result: SearchResult) {
    // an unplaced widget's settings are hidden, so show its block
    const block = SETTINGS_MAP.flatMap((g) => g.sections).find((s) => s.widget === result.widget)
    const to = result.notPlaced ? { group: 'Widgets', panels: [], target: `section:${block?.name}` } : result
    setOpenGroup(to.group)
    setPanel(to.panels)
    setRevealing((r) => ({ target: to.target, n: (r?.n ?? 0) + 1 }))
  }

  useEffect(() => {
    if (!revealing) return
    // after the group and pop-out have rendered
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-reveal="${CSS.escape(revealing.target)}"]`)
      if (!row) return
      const fold = row.closest('details')
      if (fold) fold.open = true
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })
      row.classList.remove('reveal-flash')
      void row.offsetWidth // restart the animation
      row.classList.add('reveal-flash')
    })
    return () => cancelAnimationFrame(frame)
  }, [revealing])

  const pickDevice = (next: Device) => {
    setDevice(next)
    setZoom('fit')
  }

  const sendLive = useEffectEvent(() => {
    if (livePart) sendDraft(true, livePart as Files).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  })
  useEffect(() => {
    if (!livePart) return
    const timer = setTimeout(sendLive, 250)
    return () => clearTimeout(timer)
  }, [livePart])

  // bumped by Reset all, the refresh runs after the render with its edits
  const [refreshAsked, setRefreshAsked] = useState(0)
  const refreshNow = useEffectEvent(() => void refresh())
  useEffect(() => {
    if (refreshAsked > 0) refreshNow()
  }, [refreshAsked])

  // a live change ends the spinner when the pane says it's applied
  useEffect(() => {
    const onMessage = (e: MessageEvent) => e.data?.type === 'conness:applied' && setRefreshing(false)
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  async function refresh() {
    setRefreshing(true)
    setError(null)
    try {
      // a reload or a live change in place, either ends the spinner
      await sendDraft(live)
    } catch (err) {
      setRefreshing(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // true once the files on disk hold the draft (Save & Build only builds then)
  async function save(force = false): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ version: string }>(`${at}/save`, 'POST', { files: draft, version, force, trash })
      setVersion(result.version)
      setTrash([])
      setSaved(draft)
      setConflict(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/changed on disk/.test(message)) setConflict(true)
      else setError(message)
      return false
    } finally {
      setBusy(false)
    }
  }

  // Build builds the saved project, so unsaved changes are saved first
  const startBuild = () => {
    setBuilding(true)
    setBuildRun((n) => n + 1)
  }
  const finishBuild = useCallback(() => setBuilding(false), [])

  const title = (saved?.settings as Settings | undefined)?.branding.title ?? id

  return (
    <div className="flex h-screen flex-col">
      {/* one line from 800px, a long project title truncates rather than wrap */}
      <header className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2 bg-ink px-5 py-3 text-white shadow-[0_6px_20px_-6px_rgb(29_43_51/0.45)] min-[800px]:flex-nowrap max-[1180px]:gap-x-3 max-[1180px]:px-4">
        <a
          href="/"
          className="shrink-0 text-sm text-white/70 hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ←<span className="max-[1180px]:sr-only"> Projects</span>
        </a>
        <h1 className="min-w-0 truncate font-display text-xl font-bold font-stretch-semi-expanded max-[1000px]:text-lg">{title}</h1>
        {dirty && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-white/80 max-[1000px]:text-xs">
            <span className="size-2 rounded-full bg-white" aria-hidden="true" />
            Unsaved changes
          </span>
        )}

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 min-[800px]:flex-nowrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-pressed={mapZoom}
              title="Whether the mouse wheel zooms the map in the preview"
              onClick={() => setMapZoom((on) => !on)}
              className={button.pillOnInk}
            >
              {mapZoom ? 'Map Zoom Enabled' : 'Map Zoom Disabled'}
            </button>
            <div className={button.groupOnInk} role="group" aria-label="Preview device">
              {(Object.keys(DEVICES) as Device[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={DEVICES[d].label}
                  title={DEVICES[d].label}
                  aria-pressed={device === d}
                  onClick={() => pickDevice(d)}
                  className={button.iconOnInk}
                >
                  <span
                    aria-hidden="true"
                    className={`block rounded-[2px] border-[1.5px] border-current ${d === 'desktop' ? 'h-2.5 w-4' : 'h-4 w-2.5'}`}
                  />
                </button>
              ))}
            </div>
            <div className={button.groupOnInk} role="group" aria-label="Preview zoom">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={!zoomOut}
                onClick={() => zoomOut && setZoom(zoomOut)}
                className={button.iconOnInk}
              >
                −
              </button>
              <button
                type="button"
                title="Back to Fit"
                aria-label={`Zoom ${Math.round(scale * 100)}%${zoom === 'fit' ? ', fit' : ''}. Back to Fit`}
                onClick={() => setZoom('fit')}
                className={`${button.iconOnInk} w-auto min-w-12 px-1.5 tabular-nums`}
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={!zoomIn}
                onClick={() => zoomIn && setZoom(zoomIn)}
                className={button.iconOnInk}
              >
                +
              </button>
            </div>
          </div>
          <span className="mx-1 h-6 w-px bg-white/25" aria-hidden="true" />
          {invalid && (
            <button
              type="button"
              onClick={revealFirstProblem}
              className="inline-flex h-8 shrink-0 items-center rounded-full bg-alarm px-3.5 text-sm font-medium text-white hover:bg-alarm-deep max-[1000px]:h-7 max-[1000px]:px-2.5 max-[1000px]:text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
            </button>
          )}
          <button
            type="button"
            className={button.onInk}
            disabled={!dirty || busy || invalid}
            title={blockedWhy}
            onClick={() => setConfirmSave(true)}
          >
            Save
          </button>
          <button
            type="button"
            className={button.quietOnInk}
            onClick={() => openInTab(async () => (await api<{ url: string }>(`${at}/saved`, 'POST')).url)}
          >
            View Saved App
          </button>
          <button
            type="button"
            className={button.primaryOnInk}
            disabled={building || busy || invalid}
            title={blockedWhy}
            onClick={() => (dirty ? setConfirmBuild(true) : startBuild())}
          >
            {building ? 'Building…' : 'Build'}
          </button>
        </div>
      </header>

      <EditorContext.Provider
        value={
          draft && {
            project: id,
            files: draft,
            edit,
            panel,
            openPanel: (entry) => setPanel([entry]),
            pushPanel: (entry) => setPanel((stack) => [...stack, entry]),
            backPanel: () => setPanel((stack) => stack.slice(0, -1)),
            closePanel,
            openGroup,
            setOpenGroup,
            reveal,
            setValue,
            resetValue,
            refreshSoon: () => setRefreshAsked((n) => n + 1),
            trashOnSave: (file) => setTrash((list) => (list.includes(file) ? list : [...list, file])),
            // a list item's row takes its own problems
            problemsAt: (path) => byRow.get(path) ?? problems.filter((p) => p.path === path).map((p) => p.message),
            groupProblems: (group) => byGroup.get(group) ?? 0,
          }
        }
      >
        <div className="flex min-h-0 flex-1">
          <div className="relative z-10 shrink-0 shadow-[6px_0_24px_-8px_rgb(29_43_51/0.45)]" style={{ width: sidebarWidth }}>
            <aside className="scroll-visible h-full overflow-y-auto border-t border-white bg-surface text-fg-muted [color-scheme:dark]">
              {/* the buttons stop at 220px, so a wide sidebar doesn't stretch them */}
              <div ref={measureTopBar} className="sticky top-0 z-10 grid grid-cols-[repeat(2,minmax(0,220px))] justify-center gap-x-1 gap-y-3 border-b border-line bg-surface px-3 py-3">
                <button type="button" className={smallButton.primary} disabled={!stale || refreshing || invalid} title={blockedWhy} onClick={refresh}>
                  {refreshing ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="mr-1.5 size-3 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin"
                      />
                      Refreshing
                    </>
                  ) : (
                    'Refresh Settings'
                  )}
                </button>
                <button
                  type="button"
                  className={smallButton.quietOnInk}
                  disabled={!dirty || invalid}
                  title={blockedWhy}
                  onClick={() => openInTab(async () => (await sendDraft()).url)}
                >
                  Preview Changes
                </button>
                {draft && <ResetAll />}
                {draft && <SettingsSearch />}
              </div>
              {error && (
                <p role="alert" className="m-4 rounded-md bg-alarm/15 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              {loose.length > 0 && (
                <ul role="alert" className="m-3 space-y-1 rounded-md bg-alarm/15 px-3 py-2 text-[11px] text-problem">
                  {loose.map((p) => (
                    <li key={`${p.path}:${p.message}`}>
                      {p.path.replace(':', '.json → ')}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
              {draft && <SettingsPanel />}
            </aside>
            {draft && <PopoutPanel />}
            {/* outside the scrolling aside, so it spans the full height */}
            <div
              {...resizeSidebar}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize settings"
              className="group/grip absolute top-0 -right-1 z-50 flex h-full w-2 cursor-col-resize touch-none items-center justify-center transition-colors hover:bg-white/25"
            >
              {/* always shown, so the edge reads as draggable before it's hovered */}
              <span
                aria-hidden="true"
                className="flex h-8 w-1.5 flex-col items-center justify-center gap-1 rounded-full bg-white/30 transition-colors group-hover/grip:bg-white/70"
              >
                <span className="size-0.5 rounded-full bg-ink" />
                <span className="size-0.5 rounded-full bg-ink" />
                <span className="size-0.5 rounded-full bg-ink" />
              </span>
            </div>
          </div>

          <main className="relative min-w-0 flex-1 bg-granite">
            {previewUrl ? (
              <PreviewCanvas
                // per project too, so one project's view never opens another
                src={`${previewUrl}?conness-preview=${EDITOR_PAGE_ID}-${id}`}
                device={device}
                scale={scale}
                mapZoom={mapZoom}
                onFit={onFit}
                onLoad={() => setRefreshing(false)}
              />
            ) : (
              !error && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-lichen">
                  Starting the preview…
                </p>
              )
            )}
          </main>
        </div>
      </EditorContext.Provider>

      <Modal
        open={confirmBuild}
        title="Save and build?"
        submitLabel="Save & Build"
        onSubmit={async () => {
          setConfirmBuild(false)
          if (await save()) startBuild()
        }}
        onClose={() => setConfirmBuild(false)}
      >
        Build uses the saved project. Save your changes and build?
      </Modal>
      <BuildDialog project={id} run={buildRun} onFinished={finishBuild} />
      <UpgradedNotice upgraded={upgraded} onClose={() => setUpgraded(null)} />
      <Modal
        open={confirmSave}
        title="Save your changes?"
        submitLabel="Save"
        onSubmit={() => {
          setConfirmSave(false)
          save()
        }}
        onClose={() => setConfirmSave(false)}
      >
        Saving writes your changes to the project&apos;s files. Before you save, review the app in a new tab with the
        Preview Changes button.
      </Modal>
      <Modal
        open={conflict}
        title="Files changed on disk"
        submitLabel="Overwrite"
        danger
        onSubmit={() => save(true)}
        onClose={() => setConflict(false)}
      >
        These files changed on disk since you opened the project, probably by a hand edit. Overwrite them with your
        changes, or cancel and reload the page to pick up the edit (your unsaved changes here would be lost).
      </Modal>
    </div>
  )
}
