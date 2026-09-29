import type { ReactNode } from 'react'

export function PickerSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{title}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>
        <div className="option-list" style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </>
  )
}
