import { useMemo } from 'react'
import { logoSize, settings } from '@user/settings'
import { iconForSurface, resolveWidget } from '@/core/widgets/registry'
import { useSettingsVersion, useStore } from '@/core/store'
import { DEFAULT_LOGO_SIZE_PX, DEFAULT_TOP_BAR_HEIGHT_PX, DEFAULT_TOP_BAR_TITLE_SIZE_PX, rem } from '@/core/theme/uiVars'
import type { ResolvedWidgetConfig } from '@/core/widget-types'
import type { ResolvedLayout } from '@/core/widgets/layout'
import { WidgetIcon } from './WidgetIcon'

interface TopBarProps {
  onInfoClick: () => void
  layout: ResolvedLayout
}

export function TopBar({ onInfoClick, layout }: TopBarProps) {
  const openWidgetId = useStore((s) => s.openWidgetId)
  const setOpenWidget = useStore((s) => s.setOpenWidget)

  const settingsVersion = useSettingsVersion()
  const resolved = useMemo<ResolvedWidgetConfig[]>(
    () =>
      settings.topBarWidgets.map((placement) =>
        resolveWidget(placement, 'top-bar'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsVersion],
  )

  const toggle = (id: string) => {
    setOpenWidget(openWidgetId === id ? null : id)
  }

  const branding = (
    <>
      {settings.branding.logo && (
        <img
          src={settings.branding.logo}
          alt=""
          width={logoSize?.width}
          height={logoSize?.height}
          className="shrink-0"
          style={{
            height: rem(settings.ui?.topBar?.logoSize ?? DEFAULT_LOGO_SIZE_PX),
            width: 'auto',
            // an emoji logo renders low, % scales with logoSize
            transform: 'translateY(-8%)',
          }}
        />
      )}
      {/* only the title gives way on narrow windows */}
      {/* pulled 3px toward the logo, an emoji has some air on its right */}
      <h1
        className={`min-w-0 -translate-y-px truncate font-semibold leading-none ${settings.branding.logo ? '-ml-[3px]' : ''}`}
        style={{ fontSize: rem(settings.ui?.topBar?.titleSize ?? DEFAULT_TOP_BAR_TITLE_SIZE_PX) }}
        title={settings.branding.title}
      >
        {settings.branding.title}
      </h1>
    </>
  )

  const info = (
    <button
      type="button"
      onClick={onInfoClick}
      aria-label="About this app"
      style={{ width: 'calc(var(--top-bar-icon-size) + 0.75rem)', height: 'calc(var(--top-bar-icon-size) + 0.75rem)' }}
      // -ml-1.5 cancels padding so the gap matches logo→title
      className={
        'inline-flex shrink-0 items-center justify-center rounded-full text-topBarWidget/90 transition-colors hover:bg-topBarWidget/15 hover:text-topBarWidget' +
        (layout.showBranding ? ' -ml-1.5' : '')
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: 'var(--top-bar-icon-size)', height: 'var(--top-bar-icon-size)' }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    </button>
  )

  const brandingGroup = (
    <div className="flex min-w-0 items-center gap-3">
      {layout.showBranding && branding}
      {layout.showInfo && info}
    </div>
  )

  const widgetGroup = (
    <div className="flex shrink-0 items-center gap-1">
      {resolved.map(({ manifest }) => {
        const active = manifest.id === openWidgetId
        return (
          <button
            key={manifest.id}
            type="button"
            onClick={() => toggle(manifest.id)}
            aria-pressed={active}
            aria-label={manifest.description ?? manifest.label}
            title={manifest.description ?? manifest.label}
            style={{
              width: 'var(--top-bar-button-size)',
              height: 'var(--top-bar-button-size)',
            }}
            className={
              'inline-flex items-center justify-center rounded transition-colors ' +
              (active ? 'bg-topBarWidget/25' : 'hover:bg-topBarWidget/15')
            }
          >
            <WidgetIcon
              src={iconForSurface(manifest, 'top-bar')}
              color="var(--color-topBarWidget)"
              style={{
                width: 'var(--top-bar-icon-size)',
                height: 'var(--top-bar-icon-size)',
              }}
            />
          </button>
        )
      })}
    </div>
  )

  const brandingOnLeft = layout.brandingSide === 'left'
  const leftGroup = brandingOnLeft ? brandingGroup : widgetGroup
  const rightGroup = brandingOnLeft ? widgetGroup : brandingGroup

  return (
    <header
      className="flex shrink-0 items-center px-4 text-titleText"
      style={{
        backgroundColor: 'var(--color-topBarBg)',
        height: rem(settings.ui?.topBar?.height ?? DEFAULT_TOP_BAR_HEIGHT_PX),
      }}
    >
      {leftGroup}
      <div className={'ml-auto flex items-center ' + (brandingOnLeft ? 'shrink-0' : 'min-w-0')}>
        {rightGroup}
      </div>
    </header>
  )
}
