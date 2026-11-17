import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolveProject } from './scripts/project.mjs'
import { widgetConfigs } from './scripts/widget-configs-plugin.ts'
import { projectConfig } from './scripts/project-config-plugin.ts'

const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Apache 2.0's notice travels with every build, LICENSE.md beside the app
const license = (): Plugin => ({
  name: 'conness-license',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'LICENSE.md', source: fs.readFileSync(new URL('../LICENSE.md', import.meta.url)) })
  },
})

export default defineConfig(() => {
  // set by scripts/run.mjs, plain `vite` uses the only project
  const project = resolveProject(process.env.CONNESS_PROJECT)
  const schemaDir = fileURLToPath(new URL('./schema', import.meta.url))

  return {
    plugins: [react(), tailwindcss(), projectConfig(project.dir, schemaDir), widgetConfigs(project.dir), license()],
    assetsInclude: ['**/*.geojson', '**/*.pmtiles', '**/*.fgb', '**/*.parquet', '**/*.geoparquet'],
    resolve: {
      // ordered, the project's JSON comes from project-config-plugin first
      alias: [
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        { find: /^@user\/settings$/, replacement: 'virtual:conness-settings' },
        { find: /^@user\/symbology$/, replacement: 'virtual:conness-symbology' },
        // only the files the project uses, so a build doesn't carry the rest
        { find: /^@user\/layer-files$/, replacement: 'virtual:conness-layer-files' },
        { find: /^@user\/basemap-thumbnails$/, replacement: 'virtual:conness-basemap-thumbnails' },
        { find: /^@user\/info$/, replacement: 'virtual:conness-info' },
        { find: '@user', replacement: project.dir },
      ],
    },
    publicDir: path.join(project.dir, 'public'),
    build: {
      outDir: `dist/${project.id}`,
      emptyOutDir: true,
      // startup chunk about 1,340 kB, MapLibre 960. set just above it to
      // catch a new heavy static import, use import() for those
      chunkSizeWarningLimit: 1500,
      // every bundled license in full, MIT and BSD ask for their notice
      license: { fileName: 'third-party-licenses.txt' },
      rolldownOptions: {
        // added after minifying, so it's never stripped
        output: { postBanner: (chunk) => (chunk.isEntry ? `/*! Conness GIS ${version} | Apache-2.0 | conness-gis.com */` : '') },
      },
    },
  }
})
