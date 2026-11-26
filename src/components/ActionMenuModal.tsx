import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface ActionMenuItem {
  id: string
  title: string
  desc: string
  icon: string
  color: string
  badge?: string
  onClick: () => void
}

interface ActionMenuModalProps {
  isOpen: boolean
  onClose: () => void
  items: ActionMenuItem[]
}

export function ActionMenuModal({ isOpen, onClose, items }: ActionMenuModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="action-menu-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="منوی دسترسی سریع ثبت">
      <div className="action-menu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="action-menu-header">
          <div className="action-menu-handle" />
          <div className="action-menu-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="action-menu-sparkle">✨</span>
              <div>
                <h2 className="action-menu-title">ثبت سریع و ابزارها</h2>
                <p className="action-menu-sub">گزینه مورد نظر را انتخاب کنید</p>
              </div>
            </div>
            <button type="button" className="action-menu-close" onClick={onClose} aria-label="بستن منو">
              ✕
            </button>
          </div>
        </div>

        <div className="action-menu-grid">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="action-menu-card"
              onClick={() => {
                onClose()
                item.onClick()
              }}
              style={{ '--action-color': item.color } as React.CSSProperties}
            >
              <div
                className="action-menu-icon-wrap"
                style={{ background: `${item.color}22`, border: `1px solid ${item.color}55` }}
              >
                <span className="action-menu-icon">{item.icon}</span>
              </div>
              <div className="action-menu-card-text">
                <div className="action-menu-card-title">
                  <span>{item.title}</span>
                  {item.badge ? <span className="action-menu-badge">{item.badge}</span> : null}
                </div>
                <div className="action-menu-card-desc">{item.desc}</div>
              </div>
              <span className="action-menu-chevron" aria-hidden="true">‹</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
