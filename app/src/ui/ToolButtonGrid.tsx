import type { ReactNode } from 'react'

export interface Tool<T extends string> {
  id: T
  label: string
  // a shorter name for the one-row layout, when `label` is too long for it
  shortLabel?: string
  // 16px, colored via currentColor
  icon: ReactNode
}

// `row` puts every tool on one line, and a row too narrow for them wraps
// so the labels stay readable on 320 px phones
export function ToolButtonGrid<T extends string>({
  tools,
  active,
  onPick,
  row = false,
}: {
  tools: Tool<T>[]
  active: T | null
  onPick: (id: T) => void
  row?: boolean
}) {
  return (
    <div className={'shrink-0 ' + (row ? 'flex flex-wrap gap-1' : 'grid grid-cols-2 gap-1.5')}>
      {tools.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            aria-pressed={on}
            title={t.label}
            className={
              'flex items-center justify-center rounded border text-button font-medium transition-colors [&>svg]:shrink-0 ' +
              (row ? 'flex-auto gap-0.5 whitespace-nowrap px-1.5 py-1.5 ' : 'gap-1 p-2 ') +
              (on
                ? 'border-actionActive bg-actionActive text-white hover:border-actionActiveHover hover:bg-actionActiveHover'
                : 'border-panelBorder bg-actionNotActive text-text hover:border-text hover:bg-actionNotActiveHover')
            }
          >
            {t.icon}
            <span>{(row && t.shortLabel) || t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
