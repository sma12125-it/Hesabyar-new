import { useEffect } from 'react'

/** Keep the focused field comfortably inside the scrollable container after virtual keyboard appears */
export function useScrollFocusedIntoView(rootSelector = '.sheet-body-scroll, .app-scroll') {
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const scrollParent = target.closest(rootSelector)
      if (!scrollParent) return
      
      // Prevent browser default window jump by keeping window scroll at 0
      window.scrollTo(0, 0)

      window.setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }, 280)
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [rootSelector])
}
