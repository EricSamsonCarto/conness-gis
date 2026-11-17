import { logoSize, settings } from '@user/settings'
import {
  DEFAULT_MOBILE_LOGO_SIZE_PX,
  DEFAULT_MOBILE_TOP_BAR_TITLE_SIZE_PX,
  mobileTopBarHeight,
  rem,
} from '@/core/theme/uiVars'
import type { ResolvedLayout } from '@/core/widgets/layout'
import { MobileWidgetCarousel } from './MobileWidgetBar'

interface MobileTopBarProps {
  onInfoClick: () => void
  layout: ResolvedLayout
}

export function MobileTopBar({ onInfoClick, layout }: MobileTopBarProps) {
  // sides are desktop-only, show/hide still applies
  const { showInfo, showBranding } = layout
  const widgetsHere = settings.ui?.layout?.mobileWidgetBar !== 'bottom'

  return (
    <header
      className="flex shrink-0 items-center gap-2 px-3 text-titleText"
      style={{
        backgroundColor: 'var(--color-topBarBg)',
        height: rem(mobileTopBarHeight(settings.ui)),
      }}
    >
      {showBranding && settings.branding.logo && (
        <img
          src={settings.branding.logo}
          alt=""
          width={logoSize?.width}
          height={logoSize?.height}
          className="shrink-0"
          style={{
            height: rem(
              settings.ui?.topBar?.mobileLogoSize ??
                settings.ui?.topBar?.logoSize ??
                DEFAULT_MOBILE_LOGO_SIZE_PX,
            ),
            width: 'auto',
            transform: 'translateY(-8%)',
          }}
        />
      )}
      {showBranding && (
        // only the title gives way on narrow phones (down to 320 px)
        <h1
          className={`min-w-0 truncate font-semibold leading-tight ${settings.branding.logo ? '-ml-[3px]' : ''}`}
          style={{ fontSize: rem(settings.ui?.topBar?.mobileTitleSize ?? DEFAULT_MOBILE_TOP_BAR_TITLE_SIZE_PX) }}
        >
          {settings.branding.title}
        </h1>
      )}
      {showInfo && (
        <button
          type="button"
          onClick={onInfoClick}
          aria-label="About this app"
          style={{ width: 'calc(var(--top-bar-icon-size) + 0.75rem)', height: 'calc(var(--top-bar-icon-size) + 0.75rem)' }}
          className={
            'inline-flex shrink-0 items-center justify-center rounded-full text-topBarWidget/90 hover:bg-topBarWidget/15 hover:text-topBarWidget' +
            (showBranding ? ' -ml-1.5' : '')
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
      )}

      {widgetsHere && <MobileWidgetCarousel />}
    </header>
  )
}
