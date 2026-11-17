import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  default: 'text-text hover:bg-text/15 hover:text-strongText',
  danger: 'text-danger hover:bg-danger/15',
  primary: 'text-primary hover:bg-primary/10',
}

// `label` is the aria-label and tooltip, children an icon from `@/ui/icons`
export function IconButton({
  label,
  variant = 'default',
  className = '',
  ...props
}: {
  label: string
  variant?: keyof typeof VARIANTS
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded p-1 transition-colors ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
