import { useState } from 'react'
import { widgetSettings } from '@/core/widgetSettings'
import type { BookmarksSettings } from './settings'
import { useMap, useMapReady } from '@/core/hooks'
import { captureMapState, applyMapState, type MapState } from '@/core/map/mapState'
import { InfoSection } from '@/ui/InfoSection'
import { TrashIcon, EditNameIcon } from '@/ui/icons'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { useSavedItems } from '@/ui/useSavedItems'
import { RenameInput } from '@/ui/RenameInput'
import { IconButton } from '@/ui/IconButton'
import { ActionButton } from '@/ui/ActionButton'
import { EmptyState } from '@/ui/EmptyState'
import { ItemRow, ItemRowLabel } from '@/ui/ItemRow'
import { Spinner } from '@/ui/Spinner'

export interface Bookmark {
  id: string
  name: string
  state: MapState
}

// mobile (Widget.mobile.tsx): no info
export function BookmarksWidget({ mobile = false }: { mobile?: boolean }) {
  const map = useMap()
  const isMapReady = useMapReady()

  // 0 or less means no cap. read while drawing, so live changes show
  const maxBookmarks = widgetSettings<BookmarksSettings>('bookmarks')?.maxCount ?? 35
  const bookmarks = useSavedItems<Bookmark>('bookmarks', { maxCount: maxBookmarks })
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)

  const saveCurrent = () => {
    if (!map || !isMapReady) return
    const trimmed = name.trim()
    if (!trimmed) return
    if (bookmarks.findByName(trimmed)) {
      setPendingOverwrite(trimmed)
      return
    }
    if (!bookmarks.add(trimmed, { state: captureMapState(map) })) {
      setLimitHit(true)
      return
    }
    setLimitHit(false)
    setName('')
  }

  // keeps its id + display name, takes the current view
  const confirmOverwrite = () => {
    if (!map || !isMapReady || !pendingOverwrite) return
    bookmarks.replace(pendingOverwrite, { state: captureMapState(map) })
    setPendingOverwrite(null)
    setName('')
  }

  const restore = (bookmark: Bookmark) => {
    if (!map || !isMapReady) return
    setRestoringId(bookmark.id)
    // two frames, so the spinner paints before the restore blocks the thread
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void applyMapState(map, bookmark.state, bookmark.name).finally(() =>
          setRestoringId((current) => (current === bookmark.id ? null : current)),
        )
      }),
    )
  }

  return (
    // `relative` anchors the ConfirmDialog overlay
    <div className="relative flex h-full flex-col gap-3 p-3 text-large">
      {!mobile && (
        <InfoSection>
          Save the current map view (camera position, layer visibility and opacity,
          and basemap) as a named bookmark. Click a saved bookmark to jump back to
          it. Bookmarks are stored in your browser and persist across reloads.
        </InfoSection>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (pendingOverwrite) setPendingOverwrite(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && saveCurrent()}
          placeholder="Name this view…"
          className="min-w-0 flex-1 rounded border border-panelBorder bg-panelBg px-2 py-1.5 text-large text-text outline-none focus:border-primary"
        />
        <ActionButton variant="save" onClick={saveCurrent} disabled={!name.trim()}>
          Save
        </ActionButton>
      </div>
      {limitHit && bookmarks.full && (
        <p role="alert" className="text-medium text-danger">
          No more bookmarks can be saved: the limit is {maxBookmarks}. Delete one to save another.
        </p>
      )}
      {bookmarks.saveFailed && (
        <p role="alert" className="text-medium text-danger">
          Couldn't save to this browser (storage full or blocked). Bookmarks will be lost on reload.
        </p>
      )}

      {/* min-h-0 lets the list shrink and scroll */}
      {bookmarks.items.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          hint="Pan or zoom, toggle layers, then save the view above."
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {bookmarks.items.map((bookmark) => (
            <ItemRow key={bookmark.id}>
              {renamingId === bookmark.id ? (
                <RenameInput
                  initial={bookmark.name}
                  ariaLabel={`Rename ${bookmark.name}`}
                  onCommit={(n) => {
                    bookmarks.rename(bookmark.id, n)
                    setRenamingId(null)
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <ItemRowLabel
                  onClick={() => restore(bookmark)}
                  title="Restore this view"
                  aria-busy={restoringId === bookmark.id}
                >
                  {restoringId === bookmark.id && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <Spinner size={13} />
                    </span>
                  )}
                  <span className="truncate">{bookmark.name}</span>
                </ItemRowLabel>
              )}
              <IconButton label={`Rename ${bookmark.name}`} onClick={() => setRenamingId(bookmark.id)}>
                <EditNameIcon />
              </IconButton>
              <IconButton
                label={`Delete ${bookmark.name}`}
                variant="danger"
                onClick={() => setPendingDelete(bookmark)}
              >
                <TrashIcon />
              </IconButton>
            </ItemRow>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingOverwrite !== null}
        title="Overwrite bookmark?"
        message={
          <>
            A bookmark named “{pendingOverwrite}” already exists. Saving will
            overwrite it with the current view.
          </>
        }
        confirmLabel="Overwrite"
        onConfirm={confirmOverwrite}
        onCancel={() => setPendingOverwrite(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete bookmark?"
        message={
          <>Delete “{pendingDelete?.name}”? This can't be undone.</>
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) bookmarks.remove(pendingDelete.id)
          if (renamingId === pendingDelete?.id) setRenamingId(null)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
