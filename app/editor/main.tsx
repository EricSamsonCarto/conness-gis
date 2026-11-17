import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './editor.css'
import { Home } from './project/Home'
import { EditorShell } from './EditorShell'

// Vite serves index.html for every path, so /edit/<id> lands here too
const editing = location.pathname.match(/^\/edit\/([^/]+)/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{editing ? <EditorShell id={decodeURIComponent(editing[1])} /> : <Home />}</StrictMode>,
)
