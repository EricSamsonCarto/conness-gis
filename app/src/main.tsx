import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { settings } from '@user/settings'
import { applyTheme } from './core/theme/theme'
import { applyUiVars } from './core/theme/uiVars'
import './index.css'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { BootError } from './shell/BootError'

// before first render, else the @theme boot defaults flash
applyTheme(settings.theme ?? {})
applyUiVars(settings.ui)
document.title = settings.branding.title
document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href = settings.branding.favicon ?? '/favicon.svg'

const root = createRoot(document.getElementById('root')!)

// dynamic, config errors thrown at module eval can't be caught statically
async function boot() {
  try {
    const { AppShell } = await import('./shell/AppShell')
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (error) {
    root.render(<BootError error={error} />)
  }
}

boot()
