import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { applyTheme, getCurrentTheme } from './lib/theme'
import './styles/glass-v2.css'
import './styles/app.css'
import './styles/themes.css'

applyTheme(getCurrentTheme())

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return
    if (sessionStorage.getItem('hy-sw-reloaded') === '1') return
    refreshing = true
    sessionStorage.setItem('hy-sw-reloaded', '1')
    window.location.reload()
  })
  window.addEventListener('load', () => {
    sessionStorage.removeItem('hy-sw-reloaded')
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .catch(() => {
        // Ignore service worker registration errors in embedded environments
      })
  })
}

function getBasename(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (base) return base
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      return `/${segments[0]}`
    }
  }
  return '/'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={getBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
