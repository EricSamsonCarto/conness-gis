// the Releases page: every GitHub release, newest first, read from the public API (no token: a
// public repo's releases need none, 60 requests an hour per visitor). html+json returns the notes
// as HTML, so there's no Markdown to render here
// one page of 100 releases, page through the API if it ever passes that
const API = 'https://api.github.com/repos/ericsamsoncarto/conness-gis/releases?per_page=100'
const GITHUB = 'https://github.com/ericsamsoncarto/conness-gis/releases'

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

function message(root, text) {
  root.replaceChildren(el('p', {}, text, ' See ', el('a', { href: GITHUB }, "GitHub's releases page"), '.'))
}

function row(release) {
  const zip = release.assets.find((a) => a.name.endsWith('.zip'))
  const date = new Date(release.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const actions = el('p', { className: 'releases__actions' })
  if (zip) actions.append(el('a', { className: 'md-button md-button--primary', href: zip.browser_download_url }, 'Download'))
  if (release.body_html?.trim()) {
    const dialog = el('dialog', { className: 'releases__notes' })
    dialog.innerHTML = release.body_html
    dialog.prepend(el('h2', {}, `${release.name || release.tag_name} changelog`))
    const close = el('button', { type: 'button', className: 'md-button' }, 'Close')
    close.addEventListener('click', () => dialog.close())
    dialog.append(el('form', { method: 'dialog' }, close))
    const open = el('button', { type: 'button', className: 'md-button' }, 'Changelog')
    open.addEventListener('click', () => dialog.showModal())
    actions.append(open, dialog)
  }
  return el('section', { className: 'releases__item' }, el('h2', {}, release.name || release.tag_name), el('p', {}, date), actions)
}

async function load(root) {
  root.dataset.loaded = 'true'
  try {
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github.html+json' } })
    if (!res.ok) throw new Error(String(res.status))
    const releases = (await res.json()).filter((r) => !r.draft && !r.prerelease)
    if (releases.length === 0) return message(root, 'No releases yet.')
    const total = releases.reduce((sum, r) => sum + (r.assets.find((a) => a.name.endsWith('.zip'))?.download_count ?? 0), 0)
    root.replaceChildren(el('p', { className: 'releases__total' }, `Total Downloads: ${total.toLocaleString()}`), ...releases.map(row))
  } catch {
    message(root, "Couldn't load the releases.")
  }
}

// instant navigation swaps pages in without a reload, so the list is found as it appears
function scan() {
  const root = document.getElementById('releases')
  if (root && !root.dataset.loaded) load(root)
}

function watch() {
  scan()
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
}

if (document.body) watch()
else document.addEventListener('DOMContentLoaded', watch)
