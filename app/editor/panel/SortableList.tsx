import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ListItem, Subtitle } from './parts'

// `span` is how many rows after this one move with it
// sectionTarget decides whether a row may land in another section
export type SortableRow = {
  key: string
  title: string
  detail?: string
  onClick?: () => void
  header?: true
  span?: number
  indent?: true
  group?: true
  groupKey?: string
  slot?: true
}

// what the caller says a drag would do, shown live
export type Landing = (from: number, to: number, out: boolean) => { indent: boolean; group?: string }

const OUT_PX = 16

// `to` counts the rows left without the dragged block
type Drag = {
  from: number
  span: number
  to: number
  dy: number
  dx: number
  startX: number
  startY: number
  mid: number
  mids: number[]
  height: number
}

// rows only shift visually while dragging, so pointer capture holds over
// the preview iframe. the move commits once, on drop
export function SortableList({
  rows,
  onMove,
  landing,
}: {
  rows: SortableRow[]
  onMove: (from: number, to: number, out: boolean) => void
  landing?: Landing
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const refs = useRef<(HTMLElement | null)[]>([])
  // the scrolling pop-out body, its start scrollTop, and the scroll loop
  const auto = useRef({ el: null as HTMLElement | null, start: 0, x: 0, y: 0, frame: 0 })
  useEffect(() => () => cancelAnimationFrame(auto.current.frame), [])

  // the pointer plus however far the list has scrolled since the drag began
  const follow = () =>
    setDrag((d) => {
      if (!d) return d
      const a = auto.current
      const dy = a.y - d.startY + (a.el ? a.el.scrollTop - a.start : 0)
      return { ...d, dy, dx: a.x - d.startX, to: targetOf(d, dy) }
    })
  const tick = () => {
    const a = auto.current
    if (a.el) {
      const box = a.el.getBoundingClientRect()
      const edge = 40
      const into = a.y < box.top + edge ? a.y - (box.top + edge) : a.y > box.bottom - edge ? a.y - (box.bottom - edge) : 0
      if (into !== 0) {
        a.el.scrollTop += Math.max(-16, Math.min(16, into / 3))
        follow()
      }
    }
    a.frame = requestAnimationFrame(tick)
  }
  const stopScrolling = () => cancelAnimationFrame(auto.current.frame)

  const inBlock = (i: number, d: Drag) => i >= d.from && i <= d.from + d.span
  // dragged left by about an indent
  const isOut = (d: Drag) => d.dx < -OUT_PX && (!!landing || !!rows[d.from].indent)

  // past every row whose middle is above the block's middle
  const targetOf = (d: Drag, dy: number) => {
    const middle = d.mid + dy
    return d.mids.filter((mid, i) => !inBlock(i, d) && mid < middle).length
  }

  // how far a row shifts while another is dragged over it
  const offset = (i: number, d: Drag) => {
    if (inBlock(i, d)) return d.dy
    const rest = i < d.from ? i : i - d.span - 1
    if (d.from < d.to && rest >= d.from && rest < d.to) return -d.height
    if (d.to < d.from && rest >= d.to && rest < d.from) return d.height
    return 0
  }

  const handleFor = (index: number, row: SortableRow) => ({
    'aria-label': `Move ${row.title}`,
    title: row.indent
      ? 'Drag to reorder, or left to take it out of the group (Alt+↑ / Alt+↓ / Alt+←)'
      : 'Drag to reorder (Alt+↑ / Alt+↓)',
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
      const boxes = refs.current.slice(0, rows.length).map((el) => el?.getBoundingClientRect())
      const el = scrollParent(e.currentTarget)
      auto.current = { el, start: el?.scrollTop ?? 0, x: e.clientX, y: e.clientY, frame: requestAnimationFrame(tick) }
      const span = row.span ?? 0
      // a layer over most of a group's header goes into the group, not above it
      const lineOf = (b: DOMRect, j: number) => b.top + (landing && span === 0 && rows[j].group ? b.height / 4 : b.height / 2)
      const top = boxes[index]?.top ?? 0
      const bottom = boxes[index + span]?.bottom ?? top
      setDrag({
        from: index,
        span,
        to: index,
        dy: 0,
        dx: 0,
        startX: e.clientX,
        startY: e.clientY,
        mid: (top + bottom) / 2,
        mids: boxes.map((b, j) => (b ? lineOf(b, j) : 0)),
        height: bottom - top,
      })
    },
    onPointerMove(e: PointerEvent<HTMLButtonElement>) {
      if (!drag) return
      auto.current.x = e.clientX
      auto.current.y = e.clientY
      follow()
    },
    onPointerUp() {
      stopScrolling()
      const out = drag ? isOut(drag) : false
      if (drag && (drag.from !== drag.to || out)) onMove(drag.from, drag.to, out)
      setDrag(null)
    },
    onPointerCancel() {
      stopScrolling()
      setDrag(null)
    },
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
      if (!e.altKey) return
      if (e.key === 'ArrowLeft' && row.indent) {
        e.preventDefault()
        return onMove(index, index, true)
      }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const to = index + (e.key === 'ArrowUp' ? -1 : 1)
      if (to >= 0 && to < rows.length - (row.span ?? 0)) onMove(index, to, false)
    },
  })

  const preview = drag && landing ? landing(drag.from, drag.to, isOut(drag)) : null

  return (
    // room above and below, so it isn't flush against a note or button
    <div className="divide-y divide-line-soft py-1.5">
      {rows.map((row, i) => {
        const dragged = drag ? inBlock(i, drag) : false
        const indent = dragged && i === drag!.from && preview ? preview.indent : !!row.indent
        const target = !!preview?.group && row.groupKey === preview.group && !dragged
        const shiftX = dragged && !landing ? Math.max(-OUT_PX, Math.min(0, drag!.dx)) : 0
        return (
          <div
            key={row.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            className={dragged ? 'relative z-10' : drag ? 'transition-transform duration-150' : ''}
            style={
              drag
                ? { transform: `translate(${shiftX}px, ${offset(i, drag)}px)` }
                : undefined
            }
          >
            {row.header ? (
              <div className="px-4 pt-3 pb-1.5">
                <Subtitle>{row.title}</Subtitle>
              </div>
            ) : row.slot ? (
              <div className="ml-5 border-l border-line py-1.5 pr-4 pl-3">
                <div
                  className={`rounded-md border border-dashed px-3 py-1.5 text-[11px] transition-colors duration-150 ${
                    target ? 'border-glacier-light bg-glacier/15 text-fg' : 'border-line text-fg-subtle'
                  }`}
                >
                  {row.title}
                </div>
              </div>
            ) : (
              <div
                className={`transition-[margin,background-color] duration-150 ${indent ? 'ml-5 border-l border-line' : ''} ${
                  target ? 'bg-glacier/15' : row.group ? 'bg-field' : ''
                }`}
              >
                <ListItem
                  title={row.title}
                  detail={row.detail}
                  onClick={row.onClick}
                  handle={handleFor(i, row)}
                  lifted={dragged}
                  strong={row.group}
                  icon={row.group ? <FolderIcon /> : undefined}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// the nearest ancestor that scrolls vertically
function scrollParent(from: HTMLElement): HTMLElement | null {
  for (let el = from.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el
  }
  return null
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-fg-subtle" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 4.5c0-.6.4-1 1-1h3.2l1.5 1.5H13c.6 0 1 .4 1 1V12c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V4.5Z" strokeLinejoin="round" />
    </svg>
  )
}
