import { placedWidgetIds } from '@/core/widgets/placedWidgets'
import type { Settings } from '@/core/types'
import { useEditor } from '../edits/editorContext'
import { Chevron, PanelSection } from '../panel/parts'
import { SETTINGS_MAP } from './settingsMap'
import { WidgetsGroup } from './WidgetsGroup'

export function SettingsPanel() {
  const { files, closePanel, openGroup: open, setOpenGroup: setOpen, groupProblems } = useEditor()
  const placed = placedWidgetIds(files.settings as unknown as Settings)

  return (
    <nav
      aria-label="Settings"
      // any other setting closes the pop-out, descriptions and links keep it
      onPointerDown={(e) => {
        if (!(e.target as Element).closest('[data-panel-link], [data-keep-panel]')) closePanel()
      }}
    >
      {SETTINGS_MAP.map((group) => {
        const isOpen = open === group.name
        const problems = groupProblems(group.name)
        return (
          // scroll-margin, so it sits under the sticky top bar
          <div key={group.name} className="scroll-mt-(--settings-top) border-b border-line">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={(e) => {
                setOpen(isOpen ? '' : group.name)
                // an opened group starts at its top, wherever the last one left the sidebar
                const block = e.currentTarget.parentElement
                if (!isOpen && block) requestAnimationFrame(() => block.scrollIntoView({ block: 'start' }))
              }}
              // sticky within its group, so it can be closed from anywhere
              className="sticky top-(--settings-top) z-[5] flex w-full items-center justify-between bg-surface px-4 py-3 text-left font-display text-base font-bold text-fg hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            >
              <span className="flex items-baseline gap-2">
                {group.name}
                {problems > 0 && (
                  <span className="font-sans text-[11px] font-semibold text-problem">
                    {problems} {problems === 1 ? 'problem' : 'problems'}
                  </span>
                )}
              </span>
              <Chevron open={isOpen} className="text-fg-subtle" />
            </button>
            {isOpen && (
              <div className="divide-y divide-line-soft bg-surface-raised pb-1">
                {group.name === 'Widgets' ? (
                  <WidgetsGroup />
                ) : (
                  group.sections
                    .filter((section) => !section.widget || placed.includes(section.widget))
                    .map((section, i) => <PanelSection key={section.name ?? i} section={section} />)
                )}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
