import type { CSSProperties } from 'react'

interface WidgetIconProps {
  src: string
  color: string
  className?: string
  style?: CSSProperties
}

// a mask, not <img>, so one SVG is tinted per surface
export function WidgetIcon({ src, color, className, style }: WidgetIconProps) {
  // quotes required, Vite's inlined SVG data URIs contain single quotes
  const mask = `url("${src}")`
  return (
    <span
      aria-hidden="true"
      // block, inline adds descender space and off-centers it
      className={'block shrink-0 ' + (className ?? '')}
      style={{
        backgroundColor: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
    />
  )
}
