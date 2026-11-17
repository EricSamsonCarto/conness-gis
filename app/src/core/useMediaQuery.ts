import { useEffect } from 'react'
import { useStore } from './store'
import { carryOpenWidget } from './widgets/carryAcross'

// only portrait phones are mobile, widest about 430px, big Androids 480
// index.css's input rule mirrors it
export const MOBILE_BREAKPOINT_PX = 500

// mount once (AppShell)
export function useMobileBreakpoint(): void {
  const setIsMobile = useStore((s) => s.setIsMobile)

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`)
    const sync = () => {
      if (query.matches !== useStore.getState().isMobile) carryOpenWidget(query.matches)
      setIsMobile(query.matches)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [setIsMobile])
}

// seeds the store before the effect, so there's no desktop flash
export function initialIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`).matches
}
