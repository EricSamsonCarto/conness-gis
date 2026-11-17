import { useEffect, useRef } from 'react'
import { DEVICES, type Device } from './devices'

export function PreviewCanvas({
  src,
  device,
  scale,
  mapZoom,
  onFit,
  onLoad,
}: {
  src: string
  device: Device
  scale: number
  // the editor's Map zoom toggle, sent into the pane
  mapZoom: boolean
  onFit: (fit: number) => void
  onLoad: () => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const { width, height } = DEVICES[device]

  useEffect(() => {
    const el = area.current
    if (!el) return
    // contentRect is inside the 40px padding, Fit never enlarges past 100%
    const observer = new ResizeObserver(([entry]) =>
      onFit(Math.min(entry.contentRect.width / width, entry.contentRect.height / height, 1)),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [width, height, onFit])

  // on change, and whenever the pane says it's ready (after every reload)
  useEffect(() => {
    const send = () => frame.current?.contentWindow?.postMessage({ type: 'conness:map-zoom', on: mapZoom }, '*')
    send()
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === 'conness:ready') send()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [mapZoom])

  return (
    // grid and auto margins center a small canvas, a large one scrolls
    <div ref={area} className="grid size-full overflow-auto bg-granite p-10">
      {scale > 0 && (
        // floored, a fraction of a pixel larger showed white slivers
        <div
          className="m-auto overflow-hidden shadow-[0_2px_6px_rgb(29_43_51/0.12),0_24px_60px_-12px_rgb(29_43_51/0.35)] ring-1 ring-ink/10"
          style={{ width: Math.floor(width * scale), height: Math.floor(height * scale), borderRadius: 6 }}
        >
          <iframe
            ref={frame}
            title="The Preview Pane"
            src={src}
            onLoad={onLoad}
            className="block border-0"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
          />
        </div>
      )}
    </div>
  )
}
