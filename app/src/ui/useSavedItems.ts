import { useState } from 'react'
import { loadStored, saveStored } from '@/core/storageKey'

type Fields<T> = Omit<T, 'id' | 'name'>

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// callers check findByName and own the overwrite/delete prompts
export function useSavedItems<T extends { id: string; name: string }>(
  kind: string,
  // at the cap add refuses, never dropping an older item. 0 means no cap
  opts: { maxCount?: number } = {},
) {
  const [items, setItems] = useState<T[]>(() => {
    const stored = loadStored<unknown>(kind, [])
    return Array.isArray(stored) ? (stored as T[]) : []
  })
  // storage full or blocked, callers show a warning
  const [saveFailed, setSaveFailed] = useState(false)

  // read storage first so other tabs' saves survive
  const latest = (): T[] => {
    const stored = loadStored<unknown>(kind, items)
    return Array.isArray(stored) ? (stored as T[]) : items
  }

  const commit = (next: T[]) => {
    setItems(next)
    setSaveFailed(!saveStored(kind, next))
  }

  const max = opts.maxCount ?? 0
  return {
    items,
    saveFailed,
    // callers warn and offer no new save while true, replacing still works
    full: max > 0 && items.length >= max,
    findByName: (name: string) => items.find((i) => sameName(i.name, name)),
    // false when the list is at its cap, nothing is saved then
    add: (name: string, fields: Fields<T>): boolean => {
      const current = latest()
      if (max > 0 && current.length >= max) return false
      const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      commit([...current, { ...fields, id, name } as T])
      return true
    },
    replace: (name: string, fields: Fields<T>) =>
      commit(latest().map((i) => (sameName(i.name, name) ? { ...i, ...fields } : i))),
    rename: (id: string, name: string) =>
      commit(latest().map((i) => (i.id === id ? { ...i, name } : i))),
    remove: (id: string) => commit(latest().filter((i) => i.id !== id)),
  }
}
