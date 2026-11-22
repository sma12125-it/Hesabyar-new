import { useState } from 'react'
import { notifyUser } from '../lib/sync'

export function ConfirmSheet({
  title,
  message,
  confirmLabel = 'حذف',
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'انجام نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet confirm-sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{title}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>
        <p className="sheet-sub" style={{ textAlign: 'right', marginTop: 0 }}>
          {message}
        </p>
        {error ? (
          <div className="banner error">
            <span className="bico">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}
        <div className="confirm-actions">
          <div className="row">
            <button className="btn-secondary-glass" type="button" onClick={onClose} disabled={saving}>
              انصراف
            </button>
            <button className="btn-ghost-danger" type="button" onClick={() => void go()} disabled={saving}>
              {saving ? '…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
