import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { projectsApi } from './scripts/projects-api-plugin.ts'

// npm start runs the editor, dev-only and never built
export default defineConfig({
  root: fileURLToPath(new URL('./editor', import.meta.url)),
  plugins: [react(), tailwindcss(), projectsApi()],
  resolve: {
    alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
  },
  server: { open: true },
})
