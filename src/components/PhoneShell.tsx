import type { ReactNode } from 'react'
import { useEffect } from 'react'

function useFullBleedClass() {
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    const query = window.matchMedia('(max-width: 520px), (display-mode: standalone), (display-mode: fullscreen)')
    
    let isInputFocused = false

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        isInputFocused = true
      }
    }

    const handleFocusOut = () => {
      isInputFocused = false
      // Reset scroll position on document to prevent stuck offset on iOS
      window.scrollTo(0, 0)
      document.body.scrollTop = 0
    }

    const apply = () => {
      const full = query.matches || nav.standalone === true
      document.documentElement.classList.toggle('hy-fullbleed', full)
      
      const viewport = window.visualViewport
      // On mobile when keyboard opens, window.innerHeight or visualViewport.height shrinks.
      // If an input is focused, set keyboard-open flag and update --hy-keyboard-h
      const visualH = viewport?.height ?? window.innerHeight
      const screenH = window.screen?.height ?? window.innerHeight
      const keyboardOpen = isInputFocused && visualH < screenH * 0.85

      document.documentElement.classList.toggle('hy-keyboard-open', keyboardOpen)

      // Always maintain stable base vh unless not focused
      if (!isInputFocused) {
        document.documentElement.style.setProperty('--hy-vh', `${Math.round(window.innerHeight)}px`)
      }
      document.documentElement.style.setProperty('--hy-viewport-h', `${Math.round(visualH)}px`)
      if (keyboardOpen) {
        const keyboardHeight = Math.max(0, window.innerHeight - visualH)
        document.documentElement.style.setProperty('--hy-keyboard-h', `${Math.round(keyboardHeight)}px`)
      } else {
        document.documentElement.style.setProperty('--hy-keyboard-h', '0px')
      }
    }

    apply()
    query.addEventListener('change', apply)
    window.addEventListener('resize', apply)
    window.visualViewport?.addEventListener('resize', apply)
    window.visualViewport?.addEventListener('scroll', apply)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      query.removeEventListener('change', apply)
      window.removeEventListener('resize', apply)
      window.visualViewport?.removeEventListener('resize', apply)
      window.visualViewport?.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      document.documentElement.classList.remove('hy-fullbleed')
      document.documentElement.classList.remove('hy-keyboard-open')
    }
  }, [])
}

export function PhoneShell({ children }: { children: ReactNode }) {
  useFullBleedClass()
  return (
    <div className="page-stage">
      <div className="device">
        <div className="device-screen">
          <div className="wallpaper" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  )
}
