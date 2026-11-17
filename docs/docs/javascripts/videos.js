// autoplaying videos (the Dedicated page and the homepage). iOS can skip the autoplay attribute on videos the docs'
// instant navigation swaps in, so each one is started from here as it appears. iOS checks the muted
// and playsInline properties, not only the attributes. when it refuses anyway (Low Power Mode),
// the video gets controls so a tap plays it
function start(video) {
  if (video.dataset.started) return
  video.dataset.started = 'true'
  // the autoplay attribute may already have started it
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.pause()
    video.controls = true
    return
  }
  video.muted = true
  video.playsInline = true
  setTimeout(() => {
    const playing = video.play()
    // only a real refusal, not a play() interrupted while the video loads
    if (playing) playing.catch((e) => e.name === 'NotAllowedError' && (video.controls = true))
  }, Number(video.dataset.autoplayAfter) || 0)
}

const AUTOPLAY = 'video[autoplay], video[data-autoplay-after]'

function scan(root) {
  if (root.matches?.(AUTOPLAY)) start(root)
  root.querySelectorAll?.(AUTOPLAY).forEach(start)
}

function watch() {
  scan(document)
  new MutationObserver((changes) => {
    for (const change of changes) for (const node of change.addedNodes) if (node.nodeType === 1) scan(node)
  }).observe(document.body, { childList: true, subtree: true })
}

// the script may run before the page body exists
if (document.body) watch()
else document.addEventListener('DOMContentLoaded', watch)
