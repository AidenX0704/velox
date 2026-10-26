import './assets/main.css'
import './app/app.css'
import './ui/ui.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { ModalHost, Toaster } from './ui'

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
        <Toaster />
        <ModalHost />
      </ErrorBoundary>
    </StrictMode>
  )

  // The static skeleton in index.html only has to cover the bundle parse time.
  // Retiring it must not depend on a single frame callback: Chromium throttles
  // requestAnimationFrame while a window is occluded, which would leave the
  // skeleton on screen forever. First of (frame, 400 ms) wins, exactly once.
  let settled = false

  const settleShell = (): void => {
    if (settled) {
      return
    }

    settled = true

    const boot = document.getElementById('boot')

    if (boot) {
      boot.dataset.dismissed = 'true'
      window.setTimeout(() => boot.remove(), 220)
    }

    void window.api.app.reportReady()
  }

  window.requestAnimationFrame(settleShell)
  window.setTimeout(settleShell, 400)
} else {
  console.error('Root container is missing from index.html')
}
