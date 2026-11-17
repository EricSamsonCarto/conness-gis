// shared class strings for the editor's few control styles
const shape =
  'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const base = `${shape} px-3.5 py-2 text-sm`
const small = `${shape} px-1.5 py-1.5 text-xs`
// smaller buttons below 1000px, so the top bar stays on one line
const compact = 'max-[1000px]:px-2.5 max-[1000px]:py-1.5 max-[1000px]:text-xs'

export const button = {
  primary: `${base} bg-glacier text-white hover:bg-glacier-deep focus-visible:outline-glacier`,
  quiet: `${base} border border-hairline bg-sheet text-ink hover:bg-hairline focus-visible:outline-glacier`,
  danger: `${base} bg-alarm text-white hover:bg-alarm-deep focus-visible:outline-alarm`,
  // on the ink header band
  onInk: `${base} ${compact} bg-white text-ink hover:bg-granite focus-visible:outline-white`,
  primaryOnInk: `${base} ${compact} bg-glacier text-white hover:bg-glacier-deep focus-visible:outline-white`,
  quietOnInk: `${base} ${compact} border border-white/25 text-white hover:border-white/60 focus-visible:outline-white`,
  // always outlined so it reads as a button, filled while on
  pillOnInk:
    'inline-flex h-8 shrink-0 items-center rounded-full border border-white/40 px-3.5 text-sm font-medium max-[1000px]:h-7 max-[1000px]:px-2.5 max-[1000px]:text-xs whitespace-nowrap text-white/85 transition-colors hover:border-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:border-glacier aria-pressed:bg-glacier aria-pressed:text-white',
  // same height and edge as pillOnInk, so gaps run between visible edges
  groupOnInk: 'flex h-8 items-center gap-1 rounded-full border border-white/40 px-2 max-[1000px]:h-7',
  // round buttons inside a groupOnInk, aria-pressed marks the active one
  iconOnInk:
    'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-white/15 aria-pressed:text-white',
}

// the sidebar's pair, one row, the same size
export const smallButton = {
  primary: `${small} bg-glacier text-white hover:bg-glacier-deep focus-visible:outline-glacier`,
  quietOnInk: `${small} border border-white/25 text-white hover:border-white/60 focus-visible:outline-white`,
}
