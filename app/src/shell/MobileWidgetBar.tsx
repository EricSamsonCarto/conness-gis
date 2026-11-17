import { useMemo, useState } from 'react'
import { settings } from '@user/settings'
import { mobileIconFor, resolveMobileWidgets } from '@/core/widgets/registry'
import { DEFAULT_MOBILE_WIDGET_BAR_HEIGHT_PX, DEFAULT_TOP_BAR_MOBILE_VISIBLE_COUNT, rem } from '@/core/theme/uiVars'
import { useSettingsVersion, useStore } from '@/core/store'
import type { ResolvedWidgetConfig } from '@/core/widget-types'
import { WidgetIcon } from './WidgetIcon'

// a hairline and upward shadow over the sheet, so the two read as layers
export function MobileWidgetBar() {
  return (
    <footer
      // py-1 keeps a button's hover tint inside the bar
      className="relative z-40 flex shrink-0 items-center border-t border-panelBorder px-2 py-1 shadow-[0_-2px_8px_rgba(0,0,0,0.18)]"
      style={{
        backgroundColor: 'var(--color-topBarBg)',
        height: rem(settings.ui?.mobile?.widgetBarHeight ?? DEFAULT_MOBILE_WIDGET_BAR_HEIGHT_PX),
      }}
    >
      <MobileWidgetCarousel spread />
    </footer>
  )
}

// `spread` shares the row's width between the buttons, as tall as the bar
export function MobileWidgetCarousel({ spread = false }: { spread?: boolean }) {
  const activeId = useStore((s) => s.mobileSheetWidgetId)
  const openWidget = useStore((s) => s.openMobileWidget)

  const settingsVersion = useSettingsVersion()
  const resolved = useMemo<ResolvedWidgetConfig[]>(
    () => resolveMobileWidgets(settings.mobileWidgets ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsVersion],
  )

  const visibleCount =
    settings.ui?.topBar?.mobileVisibleCount ??
    DEFAULT_TOP_BAR_MOBILE_VISIBLE_COUNT
  const total = resolved.length
  const needsCarousel = total > visibleCount
  const maxStart = Math.max(0, total - visibleCount)

  const stepBy =
    settings.ui?.topBar?.mobileCarouselMode === 'paged' ? visibleCount : 1

  // leftmost visible widget index
  const [start, setStart] = useState(0)
  const clampedStart = Math.min(start, maxStart)
  const visible = resolved.slice(clampedStart, clampedStart + visibleCount)

  const canPrev = clampedStart > 0
  const canNext = clampedStart < maxStart

  return (
    <div className={'flex shrink-0 items-center gap-1 ' + (spread ? 'h-full flex-1 justify-evenly' : 'ml-auto')}>
      {needsCarousel && (
        <CarouselArrow
          direction="prev"
          disabled={!canPrev}
          onClick={() => setStart((s) => Math.max(0, s - stepBy))}
        />
      )}

      {visible.map(({ manifest }) => {
        const active = manifest.id === activeId
        return (
          <button
            key={manifest.id}
            type="button"
            onClick={() => openWidget(manifest.id)}
            aria-pressed={active}
            aria-label={manifest.description ?? manifest.label}
            title={manifest.description ?? manifest.label}
            style={{
              width: 'var(--top-bar-button-size)',
              height: spread ? undefined : 'var(--top-bar-button-size)',
            }}
            className={
              'inline-flex shrink-0 items-center justify-center rounded transition-colors ' +
              (spread ? 'h-full ' : '') +
              (active ? 'bg-topBarWidget/25' : 'hover:bg-topBarWidget/15')
            }
          >
            <WidgetIcon
              src={mobileIconFor(manifest)}
              color="var(--color-topBarWidget)"
              style={{
                width: 'var(--top-bar-icon-size)',
                height: 'var(--top-bar-icon-size)',
              }}
            />
          </button>
        )
      })}

      {needsCarousel && (
        <CarouselArrow
          direction="next"
          disabled={!canNext}
          onClick={() => setStart((s) => Math.min(maxStart, s + stepBy))}
        />
      )}
    </div>
  )
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const isPrev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? 'Previous widgets' : 'Next widgets'}
      className={
        'inline-flex h-8 w-6 shrink-0 items-center justify-center rounded transition-colors ' +
        (disabled
          ? 'cursor-default text-topBarWidget/30'
          : 'text-topBarWidget/90 hover:bg-topBarWidget/15 hover:text-topBarWidget')
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={isPrev ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  )
}
