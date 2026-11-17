import { useEffect, useRef, useState } from 'react'
import { button } from '../ui'

// the server's last line (BUILD_MARK in scripts/projects-api-plugin.ts)
const MARK = '@@conness-build'

type Status = 'building' | 'built' | 'failed'

// streams npm run build's output, and closes only once it has ended
export function BuildDialog({
  project,
  run,
  onFinished,
}: {
  project: string
  // a new number starts a new build, 0 is none
  run: number
  onFinished: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const logBox = useRef<HTMLPreElement>(null)
  // React's dev double-run of effects must not start a second build
  const started = useRef(0)
  const [log, setLog] = useState('')
  const [status, setStatus] = useState<Status>('building')
  const at = `/api/projects/${encodeURIComponent(project)}`

  useEffect(() => {
    if (!run || started.current === run) return
    started.current = run
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
    setLog('')
    setStatus('building')
    const end = (next: Status) => {
      setStatus(next)
      onFinished()
    }
    ;(async () => {
      try {
        const res = await fetch(`${at}/build`, { method: 'POST' })
        if (!res.ok || !res.body) {
          setLog(await res.text())
          return end('failed')
        }
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let text = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          text += value
          setLog(text.split(MARK)[0])
        }
        const result = JSON.parse(text.split(MARK)[1] ?? '{"ok":false}') as { ok: boolean }
        end(result.ok ? 'built' : 'failed')
      } catch (err) {
        setLog((l) => `${l}\n${err instanceof Error ? err.message : String(err)}`)
        end('failed')
      }
    })()
  }, [run, at, onFinished])

  // follow the output as it arrives
  useEffect(() => {
    const box = logBox.current
    if (box) box.scrollTop = box.scrollHeight
  }, [log])

  const finished = status !== 'building'
  // the paths scripts/archive.mjs prints
  const saved = (label: string) => new RegExp(`^${label}: (.+)$`, 'm').exec(log)?.[1]
  const close = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      aria-labelledby="build-title"
      // Escape closes only once the build has ended
      onCancel={(e) => {
        if (!finished) e.preventDefault()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[720px] rounded-xl bg-sheet p-0 text-ink shadow-[0_24px_60px_-20px_rgb(29_43_51/0.5)]"
    >
      <div className="p-6">
        <h2 id="build-title" className="font-display text-xl font-bold">
          Build
        </h2>
        <p role="status" className={`mt-2 text-sm ${status === 'failed' ? 'text-alarm' : 'text-lichen'}`}>
          {status === 'building'
            ? 'Building… this checks the code and bundles the app, which takes a little while.'
            : status === 'built'
              ? 'Built.'
              : 'Build Failure'}
        </p>
        <pre
          ref={logBox}
          className="mt-3 h-80 overflow-auto rounded-md bg-ink px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/85"
        >
          {log || ' '}
        </pre>
        {status === 'built' && (
          <p className="mt-3 text-sm text-lichen">
            The app to host is in <span className="font-medium text-ink">{saved('Build')}</span>, and a backup of the
            project is in <span className="font-medium text-ink">{saved('Backup')}</span>. Read any API key warnings in
            the log before you publish.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={button.primary} disabled={!finished} onClick={close}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}
