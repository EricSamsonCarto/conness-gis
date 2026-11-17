import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { strFromU8, unzipSync } from 'fflate'
import { api, type ProjectSummary, type Upgraded } from './api'
import { MountainBand } from './MountainBand'
import { Modal, modalInput } from '../Modal'
import { ProjectMenu } from './ProjectMenu'
import { UpgradedNotice } from './UpgradedNotice'
import { button } from '../ui'
import { version } from '../../package.json'

type Action = 'new' | 'import' | 'title' | 'duplicate' | 'folder' | 'delete'
type Dialog = { action: Action; project?: ProjectSummary }

const name = (p: ProjectSummary) => p.title ?? p.id

// the zip's title, else its name without a backup's date
async function zipTitle(file: File): Promise<string> {
  try {
    const found = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => /^([^/]+\/)?settings\.json$/.test(f.name) && !f.name.startsWith('__MACOSX'),
    })
    const title = JSON.parse(strFromU8(Object.values(found)[0]))?.branding?.title
    if (typeof title === 'string' && title.trim()) return title
  } catch {
    // not readable here, the server says why on import
  }
  return file.name.replace(/\.zip$/i, '').replace(/_\d{8}(-\d+)?$/, '')
}

const thisYear = new Date().getFullYear()
function edited(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === thisYear ? undefined : 'numeric',
  })
}

function details(p: ProjectSummary): string[] {
  return [
    `app/projects/${p.id}`,
    p.layers === null ? "layers.json can't be read" : `${p.layers} ${p.layers === 1 ? 'layer' : 'layers'}`,
    p.title === null ? "settings.json can't be read" : p.problems ? 'has config problems' : '',
    p.modified ? `edited ${edited(p.modified)}` : '',
  ].filter(Boolean)
}

export function Home() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [zip, setZip] = useState<File | null>(null)
  const [imported, setImported] = useState<{ id: string; problems: string | null; upgraded: Upgraded | null } | null>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    api<ProjectSummary[]>('').then(
      (list) => {
        setProjects(list)
        setLoadError(null)
      },
      (err) => setLoadError(err.message),
    )
  }, [])
  useEffect(refresh, [refresh])

  const open = (action: Action, project?: ProjectSummary, initial = '') => {
    setDialog({ action, project })
    setValue(initial)
    setError(null)
  }
  const close = useCallback(() => setDialog(null), [])

  async function submit() {
    if (!dialog) return
    const at = dialog.project ? `/${encodeURIComponent(dialog.project.id)}` : ''
    try {
      if (dialog.action === 'new') await api('', 'POST', { name: value })
      if (dialog.action === 'import' && zip) {
        const done = await api<{ id: string; problems: string | null; upgraded: Upgraded | null }>(
          `/import?name=${encodeURIComponent(value)}`,
          'POST',
          zip,
        )
        if (done.problems || done.upgraded) setImported(done)
      }
      if (dialog.action === 'title') await api(`${at}/title`, 'POST', { title: value })
      if (dialog.action === 'duplicate') await api(`${at}/duplicate`, 'POST', { name: value })
      if (dialog.action === 'folder') await api(`${at}/rename`, 'POST', { to: value })
      if (dialog.action === 'delete') await api(at, 'DELETE')
      setDialog(null)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const p = dialog?.project
  const field = (label: string, hint: string) => (
    <label className="block">
      <span className="font-medium text-ink">{label}</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={modalInput}
      />
      <span className="mt-1.5 block">{hint}</span>
    </label>
  )

  const dialogs: Record<Action, { title: string; submit: string; body: ReactNode }> = {
    new: {
      title: 'New project',
      submit: 'Create project',
      body: field(
        'Name',
        'Shown in the app’s top bar. It also sets the project ID, its folder in app/projects. You can change either one later: Rename for the name, Rename project ID (folder) for the folder.',
      ),
    },
    import: {
      title: 'Import project',
      submit: 'Import',
      body: field(
        'Name',
        `From ${zip?.name ?? 'the zip'}, which should be a project backup from app/projects/_project-backups/ (every Build writes one there), not a build from _builds/. The name also sets the project ID, its folder in app/projects (-2 is added if that's taken). The zip itself isn't changed.`,
      ),
    },
    title: {
      title: 'Rename project',
      submit: 'Rename',
      body: field('Name', `Shown in the app’s top bar. The folder stays app/projects/${p?.id}.`),
    },
    duplicate: {
      title: `Duplicate ${p ? name(p) : ''}`,
      submit: 'Duplicate',
      body: field('Name of the copy', 'The copy gets its own folder, including all its data files.'),
    },
    folder: {
      title: 'Rename project ID',
      submit: 'Rename project ID',
      body: field(
        'Project ID (folder name)',
        'Lowercase letters, numbers and dashes. Commands use it, as in npm run dev <folder>. The name in the top bar doesn’t change.',
      ),
    },
    delete: {
      title: `Delete ${p ? name(p) : ''}?`,
      submit: 'Delete project',
      body: (
        <p>
          Its folder moves to <span className="font-medium text-ink">app/projects/_trash/</span>. To get it back, move
          the folder back into app/projects/.
        </p>
      ),
    },
  }
  const current = dialog ? dialogs[dialog.action] : null

  return (
    <div className="min-h-screen">
      <MountainBand>
        <h1 className="font-display text-4xl font-bold font-stretch-semi-expanded sm:text-5xl">Conness GIS</h1>
        <p className="mt-1 text-sm text-white/70">Release {version}</p>
      </MountainBand>

      <main className="mx-auto max-w-[880px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-6 border-b border-hairline pb-4">
          <p className="text-lichen">
            {projects
              ? `${projects.length} map ${projects.length === 1 ? 'project' : 'projects'} in app/projects`
              : 'Map projects in app/projects'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={button.quiet}
              title="Pick a project backup zip from app/projects/_project-backups/ (every Build writes one)"
              onClick={() => zipInput.current?.click()}
            >
              Import
            </button>
            <input
              ref={zipInput}
              type="file"
              hidden
              accept=".zip,application/zip"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                // the same zip can be chosen again after a Cancel
                e.target.value = ''
                if (!file) return
                setZip(file)
                open('import', undefined, await zipTitle(file))
              }}
            />
            <button type="button" className={button.primary} onClick={() => open('new')}>
              New project
            </button>
          </div>
        </div>
        {loadError && (
          <p role="alert" className="mb-6 rounded-md bg-alarm/8 px-4 py-3 text-sm text-alarm">
            Couldn’t load the projects: {loadError}
          </p>
        )}

        {projects?.length === 0 && (
          <div className="py-12">
            <h2 className="font-display text-2xl font-bold">No projects yet</h2>
            <p className="mt-2 max-w-[60ch] text-lichen">
              A project is one map app: its settings, layers and data files, in a folder of its own.
            </p>
            <button type="button" className={`${button.primary} mt-5`} onClick={() => open('new')}>
              New project
            </button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-sheet">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <div className="min-w-0 flex-1">
                  {/* same target as Open, so one tab stop per row */}
                  <a
                    href={`/edit/${encodeURIComponent(project.id)}`}
                    tabIndex={-1}
                    className="block truncate font-display text-xl font-bold text-ink hover:text-glacier"
                  >
                    {name(project)}
                  </a>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-lichen">
                    {details(project).map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </p>
                </div>
                <a href={`/edit/${encodeURIComponent(project.id)}`} className={button.primary}>
                  Open
                </a>
                <ProjectMenu
                  label={`More actions for ${name(project)}`}
                  items={[
                    { label: 'Rename', onSelect: () => open('title', project, project.title ?? '') },
                    { label: 'Duplicate', onSelect: () => open('duplicate', project, `${name(project)} copy`) },
                    { label: 'Rename project ID (folder)', onSelect: () => open('folder', project, project.id) },
                    { label: 'Delete', onSelect: () => open('delete', project), danger: true },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Modal
        open={current !== null}
        title={current?.title ?? ''}
        submitLabel={current?.submit ?? ''}
        danger={dialog?.action === 'delete'}
        error={error}
        onSubmit={submit}
        onClose={close}
      >
        {current?.body}
      </Modal>
      <Modal
        open={!!imported?.problems}
        title="Imported with config problems"
        submitLabel="Open it to fix them"
        cancelLabel="Close"
        onSubmit={() => imported && window.location.assign(`/edit/${encodeURIComponent(imported.id)}`)}
        onClose={() => setImported(null)}
      >
        <p>
          It&apos;s in <span className="font-medium text-ink">app/projects/{imported?.id}</span>. It can&apos;t be
          built until these are fixed:
        </p>
        <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-ink px-3 py-2 font-mono text-xs whitespace-pre-wrap text-white/85">
          {imported?.problems}
        </pre>
      </Modal>
      <UpgradedNotice upgraded={imported?.problems ? null : (imported?.upgraded ?? null)} onClose={() => setImported(null)} />
    </div>
  )
}
