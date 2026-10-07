import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/glass-v2.css'
import './styles/app.css'
import './styles/themes.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
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
