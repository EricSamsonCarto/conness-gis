import { useEffect, useRef, useState } from 'react'

// `copied`: key of the last successful copy, tells buttons apart
export function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async (text: string, key = 'copied') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), 1200)
    } catch {
      // fails outside secure contexts (plain http)
    }
  }

  return { copied, copy }
}
