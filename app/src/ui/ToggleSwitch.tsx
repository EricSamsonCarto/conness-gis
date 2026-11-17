export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  // required, there's no visible text
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <label className="relative inline-block h-[1.375rem] w-10 shrink-0">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="peer absolute inset-0 z-[1] m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={
          'absolute inset-0 rounded-full bg-text/35 transition-colors duration-300 ' +
          'peer-checked:bg-slider peer-disabled:opacity-50 ' +
          "before:absolute before:left-[0.125rem] before:top-1/2 before:h-[1.125rem] before:w-[1.125rem] before:-translate-y-1/2 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgba(0,0,0,0.2)] before:transition-[left] before:duration-300 before:content-[''] " +
          'peer-checked:before:left-[calc(100%-1.25rem)]'
        }
      />
    </label>
  )
}
