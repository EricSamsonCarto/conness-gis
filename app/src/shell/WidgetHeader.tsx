import type { ResolvedWidgetHeaderConfig } from '@/core/widget-types'

interface WidgetHeaderProps {
  label: string
  config: ResolvedWidgetHeaderConfig
  onClose: () => void
  closeAriaLabel?: string
}

export function WidgetHeader({
  label,
  config,
  onClose,
  closeAriaLabel = 'Close',
}: WidgetHeaderProps) {
  const { showTitle, showDivider, titleColor } = config

  return (
    <div
      className={
        'flex shrink-0 items-center justify-between px-3 py-2 ' +
        (showDivider ? 'border-b border-panelBorder' : '')
      }
    >
      {showTitle ? (
        <span
          className="text-title font-medium"
          style={{ color: `var(--color-${titleColor})` }}
        >
          {label}
        </span>
      ) : (
        <span aria-hidden />
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeAriaLabel}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-text hover:bg-text/10 hover:text-strongText"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
