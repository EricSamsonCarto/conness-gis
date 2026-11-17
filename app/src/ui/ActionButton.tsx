import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  danger: 'bg-danger text-white enabled:hover:bg-dangerHover',
  save: 'bg-save text-white enabled:hover:bg-saveHover',
  success: 'bg-success text-white enabled:hover:bg-successHover',
  neutral:
    'border border-panelBorder bg-panelBg text-text enabled:hover:border-text enabled:hover:bg-text/10',
}

// optional icon from `@/ui/icons` goes before the text
export function ActionButton({
  variant,
  className = '',
  ...props
}: {
  variant: keyof typeof VARIANTS
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-button font-medium transition-colors disabled:cursor-not-allowed disabled:border-disabledBg disabled:bg-disabledBg disabled:text-disabledText ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
