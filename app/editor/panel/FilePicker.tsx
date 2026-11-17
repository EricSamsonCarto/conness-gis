import { useCallback, useEffect, useRef, useState } from 'react'
import { api, cleanFileName } from '../project/api'
import { useEditor } from '../edits/editorContext'
import { Modal } from '../Modal'
import { ContentSelect, InlineButton } from './controls'

type Folder = { files: string[]; extensions: string[] }
type Pending = { name: string; file: File }
// a read-only choice from outside the folder, with its own preview URL
export type ExtraFile = { name: string; label: string; url: string }

// `asUrl` stores the URL the app serves it at, else the plain name
// a taken name asks to replace it
export function FilePicker({
  folder,
  value,
  onChange,
  asUrl = false,
  extra = [],
  emptyLabel = 'None',
  defaultFile,
  preview = true,
  labelledBy,
}: {
  folder: string
  value: unknown
  onChange: (v: string) => void
  asUrl?: boolean
  extra?: ExtraFile[]
  // what an empty choice means, given the files to name the default
  emptyLabel?: string | ((files: string[]) => string)
  // images get a thumbnail beside the dropdown, data files don't
  preview?: boolean
  // the file used while none is picked, previewed (dimmed) in its place
  defaultFile?: (files: string[]) => string | undefined
  labelledBy: string
}) {
  const { project } = useEditor()
  const [list, setList] = useState<Folder | null>(null)
  const [listError, setListError] = useState<string>()
  const [problem, setProblem] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<Pending | null>(null)
  const [uploading, setUploading] = useState(false)
  // bumped after an upload, so a replaced image's preview reloads
  const [version, setVersion] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const at = `/${encodeURIComponent(project)}/folder/${folder}`

  const refresh = useCallback(
    () =>
      api<Folder>(at).then(
        (next) => setList(next),
        (err: Error) => setListError(err.message),
      ),
    [at],
  )
  useEffect(() => {
    refresh()
  }, [refresh])

  const write = (name: string) => onChange(asUrl ? `/${name}` : name)

  async function upload({ name, file }: Pending, replace = false) {
    setUploading(true)
    try {
      await api(`${at}?name=${encodeURIComponent(name)}${replace ? '&replace=1' : ''}`, 'POST', file)
      setVersion((v) => v + 1)
      await refresh()
      write(name)
    } catch (err) {
      if ((err as { status?: number }).status === 409) setReplacing({ name, file })
      else setProblem((err instanceof Error ? err.message : String(err)).replace(/^\[conness-gis\] /, ''))
    } finally {
      setUploading(false)
    }
  }

  function choose(file: File | undefined) {
    if (file) upload({ name: cleanFileName(file.name), file })
  }

  const files = list?.files ?? []
  const current = typeof value === 'string' && value ? value.replace(/^\//, '') : undefined
  const previewed = current ?? defaultFile?.(files)
  const previewUrl =
    preview && previewed
      ? files.includes(previewed)
        ? `/api/projects${at}/${encodeURIComponent(previewed)}?v=${version}`
        : extra.find((e) => e.name === previewed)?.url
      : undefined

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          // the dropdown's height (controls.tsx), so the two line up
          className={`h-[calc(1.5em+0.75rem+2px)] w-auto max-w-12 shrink-0 rounded border border-line bg-white/5 object-contain p-0.5 ${current ? '' : 'opacity-55'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <ContentSelect
          labelledBy={labelledBy}
          value={current}
          options={[
            ...files.map((f) => ({ value: f, label: f })),
            ...extra.filter((e) => !files.includes(e.name)).map((e) => ({ value: e.name, label: e.label })),
          ]}
          missingLabel={(f) => `${f} (not found)`}
          loading={list === null && !listError}
          error={list === null ? listError : undefined}
          emptyLabel={typeof emptyLabel === 'function' ? emptyLabel(files) : emptyLabel}
          onChange={write}
        />
      </div>
      <InlineButton
        disabled={uploading}
        onClick={() => input.current?.click()}
        title={`Copies a file into ${folder}/ right away. Picking it is saved with Save`}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </InlineButton>
      <input
        ref={input}
        type="file"
        hidden
        accept={list?.extensions.join(',')}
        onChange={(e) => {
          choose(e.target.files?.[0])
          // the same file can be chosen again after a Cancel
          e.target.value = ''
        }}
      />
      <Modal
        open={replacing !== null}
        title={`${replacing?.name} already exists`}
        submitLabel="Replace"
        danger
        onClose={() => setReplacing(null)}
        onSubmit={() => {
          const pending = replacing
          setReplacing(null)
          if (pending) upload(pending, true)
        }}
      >
        Replace the file in {folder}/ with the one you chose? The old one can&apos;t be brought back.
      </Modal>
      <Modal
        open={problem !== null}
        title="Couldn't upload that file"
        submitLabel="OK"
        cancelLabel={null}
        onClose={() => setProblem(null)}
        onSubmit={() => setProblem(null)}
      >
        {problem}
      </Modal>
    </div>
  )
}
