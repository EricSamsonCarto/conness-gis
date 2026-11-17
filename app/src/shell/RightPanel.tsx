import { useMemo } from 'react'
import { settings } from '@user/settings'
import { resolveWidget } from '@/core/widgets/registry'
import { useSettingsVersion, useStore } from '@/core/store'
import { WidgetHeader } from './WidgetHeader'
import type { ShellSide } from '@/core/types'
import { WidgetBoundary } from './WidgetBoundary'

export function RightPanel({ side = 'right' }: { side?: ShellSide }) {
  const openWidgetId = useStore((s) => s.openWidgetId)
  const setOpenWidget = useStore((s) => s.setOpenWidget)

  const settingsVersion = useSettingsVersion()
  const resolvedByName = useMemo(() => {
    const map: Record<string, ReturnType<typeof resolveWidget>> = {}
    for (const placement of settings.topBarWidgets) {
      map[placement.widgetName] = resolveWidget(placement, 'top-bar')
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsVersion])

  if (!openWidgetId) {
    return <aside aria-hidden className="w-0 shrink-0" />
  }

  const resolved = resolvedByName[openWidgetId]
  if (!resolved) return <aside aria-hidden className="w-0 shrink-0" />

  const Widget = resolved.manifest.component

  return (
    <aside
      className={
        'flex shrink-0 flex-col border-t border-panelBorder bg-panelBg ' +
        (side === 'right' ? 'border-l' : 'border-r')
      }
      style={{ width: resolved.panelWidth }}
    >
      <WidgetHeader
        label={resolved.manifest.label}
        config={resolved.header}
        onClose={() => setOpenWidget(null)}
        closeAriaLabel="Close panel"
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <WidgetBoundary key={openWidgetId} id={resolved.manifest.id}>
          <Widget />
        </WidgetBoundary>
      </div>
    </aside>
  )
}
