import { useEffect, useMemo, useState } from 'react'
import { settings } from '@user/settings'
import { validateThemeConfig } from '@/core/theme/theme'
import { applyUiVars } from '@/core/theme/uiVars'
import { resolveLayout, validateLayout } from '@/core/widgets/layout'
import { validateSearchConfig } from '@/core/search/providers'
import { validateLayerFilters } from '@/core/filters/validate'
import { isInfoDismissed } from '@/core/infoDismiss'
import { useStore } from '@/core/store'
import { useMobileBreakpoint } from '@/core/useMediaQuery'
import { MapView } from './MapView'
import { TopBar } from './TopBar'
import { SidePanel } from './SidePanel'
import { RightPanel } from './RightPanel'
import { FloatingSlots } from './FloatingSlots'
import { InfoModal } from './InfoModal'
import { LoadingOverlay } from './LoadingOverlay'
import { PopupHost } from './PopupHost'
import { ContextMenu } from './ContextMenu'
import { MobileTopBar } from './MobileTopBar'
import { MobileSheet } from './MobileSheet'
import { MobileWidgetBar } from './MobileWidgetBar'

// at module load, so config conflicts throw at boot, not later
validateLayout(settings)
validateSearchConfig(settings)
validateLayerFilters(settings)
validateThemeConfig(settings)
// at startup only, whether the info modal opens on load
const bootLayout = resolveLayout(settings)

const infoConfig = settings.ui?.info
const infoAutoOpen = Boolean(infoConfig?.autoOpen)
const infoAllowDismiss = infoConfig?.allowDismiss ?? true

const infoOpenInitial =
  bootLayout.showInfo &&
  infoAutoOpen &&
  !(infoAllowDismiss && isInfoDismissed())

export function AppShell() {
  const [infoOpen, setInfoOpen] = useState(infoOpenInitial)
  useMobileBreakpoint()
  const isMobile = useStore((s) => s.isMobile)
  // the editor's live changes redraw the whole shell from the refilled settings
  const settingsVersion = useStore((s) => s.settingsVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => resolveLayout(settings), [settingsVersion])

  // control sizes track the breakpoint
  useEffect(() => {
    applyUiVars(settings.ui, isMobile)
  }, [isMobile])

  // one tree for both layouts, so the map isn't rebuilt at the breakpoint
  const sideRail = <SidePanel key="rail" side={layout.sideRailSide} />
  const topBarPanel = <RightPanel key="panel" side={layout.topBarPanelSide} />
  // a hidden bar takes its widgets with it, on desktop only
  const rail = layout.showSideRail ? sideRail : null
  const panel = layout.showTopBar ? topBarPanel : null
  const leftSlot = isMobile
    ? null
    : [layout.sideRailSide === 'left' ? rail : null, layout.topBarPanelSide === 'left' ? panel : null]
  const rightSlot = isMobile
    ? null
    : [layout.topBarPanelSide === 'right' ? panel : null, layout.sideRailSide === 'right' ? rail : null]

  return (
    <div className="flex h-dvh flex-col">
      {isMobile ? (
        <MobileTopBar onInfoClick={() => setInfoOpen(true)} layout={layout} />
      ) : (
        layout.showTopBar && <TopBar onInfoClick={() => setInfoOpen(true)} layout={layout} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {leftSlot}

        <main className={'relative flex-1' + (isMobile ? ' overflow-hidden' : '')}>
          <MapView />
          {/* a hidden bar or rail takes its shadow with it */}
          {(isMobile || layout.showTopBar) && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10"
              style={{
                height: 'var(--top-bar-shadow-height, 0px)',
                background:
                  'linear-gradient(to bottom, rgb(0 0 0 / var(--top-bar-shadow-opacity, 0)), rgb(0 0 0 / 0))',
              }}
            />
          )}
          {!isMobile && layout.showSideRail && settings.sidePanelWidgets.length > 0 && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 z-10 ${layout.sideRailSide === 'right' ? 'right-0' : 'left-0'}`}
              style={{
                width: 'var(--side-rail-shadow-width, 0px)',
                background: `linear-gradient(to ${layout.sideRailSide === 'right' ? 'left' : 'right'}, rgb(0 0 0 / var(--side-rail-shadow-opacity, 0)), rgb(0 0 0 / 0))`,
              }}
            />
          )}
          <FloatingSlots />
          {isMobile ? (
            <MobileSheet />
          ) : (
            <>
              <PopupHost />
              <ContextMenu />
            </>
          )}
        </main>

        {rightSlot}
      </div>

      {/* a sibling of the map row, so the map, sheet and corner buttons end above it */}
      {isMobile && settings.ui?.layout?.mobileWidgetBar === 'bottom' && <MobileWidgetBar />}

      <LoadingOverlay />

      <InfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        // read while drawing, so the editor's live changes show
        showDismiss={infoAutoOpen && (settings.ui?.info?.allowDismiss ?? true)}
      />
    </div>
  )
}
