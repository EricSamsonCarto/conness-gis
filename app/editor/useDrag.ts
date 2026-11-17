import { useRef, type PointerEvent } from 'react'

// pointer capture keeps moves coming over the preview iframe
export function useDrag<T>(begin: () => T, move: (start: T, dx: number, dy: number) => void) {
  const drag = useRef<{ x: number; y: number; start: T } | null>(null)
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0 || (e.target as Element).closest('button')) return
      drag.current = { x: e.clientX, y: e.clientY, start: begin() }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current
      if (d) move(d.start, e.clientX - d.x, e.clientY - d.y)
    },
    onPointerUp() {
      drag.current = null
    },
  }
}

// storage can be blocked, so it falls back quietly
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // not remembered this time
  }
}
