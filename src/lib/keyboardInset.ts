import { useEffect } from 'react'

/** Keep the focused field inside the sheet after the iPhone keyboard opens. */
export function useScrollFocusedIntoView(rootSelector = '.sheet-sticky-cta') {
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!target.closest(rootSelector)) return
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, 350)
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [rootSelector])
}
