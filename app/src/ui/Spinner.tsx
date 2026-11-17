// decorative, pair it with text or an aria-busy parent
export function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`kit-spinner ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
