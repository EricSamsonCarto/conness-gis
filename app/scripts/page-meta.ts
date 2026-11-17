import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import type { HtmlTagDescriptor } from 'vite'
import type { Settings } from '../src/core/types.ts'

export type ImageSize = { width: number; height: number }

const isUrl = (value: string) => /^[a-z]+:/i.test(value) || value.startsWith('//')

// a size in %, em and the like gives nothing
function svgLength(tag: string, name: string): number | undefined {
  const value = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`))?.[1]
  return value ? Number(value) : undefined
}

// an SVG's width and height (else its viewBox) or a PNG's header size
export function imageSize(bytes: Buffer, ext: string): ImageSize | undefined {
  let size: ImageSize | undefined
  if (ext === '.png') {
    if (bytes.length < 24 || bytes.toString('latin1', 1, 4) !== 'PNG') return
    size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  } else if (ext === '.svg') {
    const tag = bytes.toString('utf8').match(/<svg\b[^>]*>/i)?.[0]
    if (!tag) return
    const width = svgLength(tag, 'width')
    const height = svgLength(tag, 'height')
    const box = tag.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number)
    if (width && height) size = { width, height }
    else if (box?.length === 4) size = { width: box[2], height: box[3] }
  }
  if (!size || !(size.width > 0) || !(size.height > 0)) return
  // html size attributes are whole numbers
  return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) }
}

// the logo's own size when it's a file in public/, a URL gives nothing
export function logoSize(projectDir: string, logo: string | undefined): ImageSize | undefined {
  if (!logo || isUrl(logo)) return
  const file = path.join(projectDir, 'public', logo.replace(/^\.?\//, ''))
  if (!fs.existsSync(file)) return
  return imageSize(fs.readFileSync(file), path.extname(file).toLowerCase())
}

const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const withTitle = (html: string, title: string) =>
  html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(title)}</title>`)

// in the html so crawlers and link previews see them without running JS
export function headTags(settings: Settings): HtmlTagDescriptor[] {
  const { title, description } = settings.branding
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' })
  const tags: HtmlTagDescriptor[] = []
  if (description) tags.push(meta({ name: 'description', content: description }))
  tags.push(meta({ property: 'og:title', content: title }), meta({ property: 'og:type', content: 'website' }))
  if (description) tags.push(meta({ property: 'og:description', content: description }))
  const style = settings.map.style
  // no crossorigin, with it Chrome left the connection unused (Lighthouse)
  if (typeof style === 'string' && /^https?:\/\//i.test(style) && URL.canParse(style)) {
    tags.push({ tag: 'link', attrs: { rel: 'preconnect', href: new URL(style).origin }, injectTo: 'head' })
  }
  return tags
}

// lighthouse wants an h1, over 50 characters and a markdown link
export function llmsTxt(settings: Settings): string {
  const { title, description } = settings.branding
  const lines = [`# ${title}`, '']
  if (description) lines.push(`> ${description}`, '')
  lines.push('An interactive web map made with [Conness GIS](https://conness-gis.com).', '')
  const layers = settings.layers.map((l) => l.name ?? l.id)
  if (layers.length) lines.push('## Layers', '', ...layers.map((name) => `- ${name}`), '')
  return lines.join('\n')
}

export const ROBOTS_TXT = 'User-agent: *\nAllow: /\n'

// info.md as html, so the app ships no markdown renderer
// and the card shows on its first render
export function infoModule(markdown: string): string {
  const heading = markdown.match(/^\s*#[ \t]+(.+)\r?\n?/)
  const body = heading ? markdown.slice(heading[0].length) : markdown
  const html = renderToStaticMarkup(createElement(Markdown, null, body))
  return `export const title = ${JSON.stringify(heading?.[1].trim() ?? '')}\nexport const html = ${JSON.stringify(html)}\n`
}
