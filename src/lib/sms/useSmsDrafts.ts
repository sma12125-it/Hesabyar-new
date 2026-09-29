import { useCallback, useEffect, useState } from 'react'
import { loadSmsState, SMS_CHANGED } from './drafts'
import type { DraftState, TransactionDraft } from './types'

export function useSmsDrafts() {
  const [state, setState] = useState<DraftState | null>(null)

  const reload = useCallback(async () => {
    setState(await loadSmsState())
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadSmsState().then((next) => {
      if (!cancelled) setState(next)
    })
    const onChange = () => {
      void loadSmsState().then((next) => {
        if (!cancelled) setState(next)
      })
    }
    window.addEventListener(SMS_CHANGED, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(SMS_CHANGED, onChange)
    }
  }, [])

  const pending: TransactionDraft[] = state?.drafts.filter((draft) => draft.status === 'PENDING') ?? []
  return { state, pending, reload }
}
