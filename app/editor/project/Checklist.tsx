import { useState } from 'react'
import { Modal, modalInput } from '../Modal'

// `fixed` items show checked and greyed, already chosen elsewhere
export function Checklist({
  items,
  picked,
  onChange,
  fixed = [],
  fixedNote,
}: {
  items: string[]
  picked: string[]
  onChange: (picked: string[]) => void
  fixed?: string[]
  fixedNote?: string
}) {
  const free = items.filter((item) => !fixed.includes(item))
  const allPicked = free.length > 0 && free.every((item) => picked.includes(item))
  return (
    <>
      <button
        type="button"
        onClick={() => onChange(allPicked ? [] : free)}
        className="mb-2 text-sm font-medium text-glacier hover:underline"
      >
        {allPicked ? 'Deselect all' : 'Select all'}
      </button>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-hairline px-3 py-2">
        {items.map((item) => {
          const done = fixed.includes(item)
          return (
            <label key={item} className={`flex items-center gap-2 ${done ? 'text-lichen/60' : 'text-ink'}`}>
              <input
                type="checkbox"
                disabled={done}
                checked={done || picked.includes(item)}
                onChange={(e) => onChange(e.target.checked ? [...picked, item] : picked.filter((p) => p !== item))}
                className="accent-glacier"
              />
              {item}
              {done && fixedNote && <span className="text-xs">({fixedNote})</span>}
            </label>
          )
        })}
      </div>
    </>
  )
}

// a shown item missing from `items` stays, so it can be unchecked
// `typed` is a field for one name when the list can't be read
export function ChooseDialog({
  open,
  title,
  items,
  shown,
  loading,
  loadingText,
  error,
  noneNote,
  typed,
  onUpdate,
  onClose,
}: {
  open: boolean
  title: string
  items: string[]
  shown: string[]
  loading: boolean
  loadingText: string
  error?: string
  noneNote: string
  typed?: { label: string; hint: string }
  onUpdate: (chosen: string[]) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState(shown)
  const [name, setName] = useState('')
  const all = [...items, ...shown.filter((s) => !items.includes(s))]
  return (
    <Modal
      open={open}
      title={title}
      submitLabel="Update"
      onClose={onClose}
      onSubmit={() => {
        const chosen = all.filter((item) => picked.includes(item))
        onUpdate(error && typed && name.trim() && !chosen.includes(name.trim()) ? [...chosen, name.trim()] : chosen)
        onClose()
      }}
    >
      {loading && <p>{loadingText}</p>}
      {error && !typed && <p className="text-alarm">{error}</p>}
      {error && typed && (
        <label className="block">
          <span className="font-medium text-ink">{typed.label}</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={modalInput} />
          <span className="mt-1.5 block">
            {error}. {typed.hint}
          </span>
        </label>
      )}
      {!loading && !error && (
        <>
          <Checklist items={all} picked={picked} onChange={setPicked} />
          {picked.length === 0 && <p className="mt-2">{noneNote}</p>}
        </>
      )}
    </Modal>
  )
}
