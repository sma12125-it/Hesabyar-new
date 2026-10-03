import { useState, useRef, useEffect, type ReactNode } from 'react'

interface WindowPopupProps {
  title: string
  subtitle?: string
  icon?: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  defaultWidth?: number
  defaultHeight?: number
  allowTableViewToggle?: boolean
  isTableView?: boolean
  onToggleTableView?: () => void
}

export function WindowPopup({
  title,
  subtitle,
  icon = '📄',
  isOpen,
  onClose,
  children,
  footer,
  defaultWidth = 640,
  defaultHeight = 600,
  allowTableViewToggle = false,
  isTableView = false,
  onToggleTableView,
}: WindowPopupProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)

  const isDragging = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const windowStartPos = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Dragging logic for desktop
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDesktop || isMaximized || isMinimized) return
    if (e.button !== 0) return

    // Don't drag if clicking buttons, inputs, etc.
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('.no-drag')) return

    isDragging.current = true
    dragStartPos.current = { x: e.clientX, y: e.clientY }

    const rect = windowRef.current?.getBoundingClientRect()
    windowStartPos.current = rect ? { x: rect.left, y: rect.top } : { x: 0, y: 0 }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return
      const dx = moveEvent.clientX - dragStartPos.current.x
      const dy = moveEvent.clientY - dragStartPos.current.y

      const currentW = rect?.width ?? defaultWidth
      const currentH = rect?.height ?? defaultHeight

      // Constrain within screen boundaries
      const newX = Math.max(10, Math.min(window.innerWidth - currentW - 10, windowStartPos.current.x + dx))
      const newY = Math.max(10, Math.min(window.innerHeight - currentH - 10, windowStartPos.current.y + dy))

      setPosition({ x: newX, y: newY })
    }

    const onPointerUp = () => {
      isDragging.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  if (!isOpen) return null

  // If minimized on desktop, show docked taskbar pill at bottom right
  if (isDesktop && isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer',
          animation: 'popIn 0.2s ease',
        }}
        title="کلیک برای بازگشت پنجره"
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#38bdf8', marginRight: 4 }}>🗖 باز کردن</span>
      </div>
    )
  }

  // Desktop positioning logic:
  // When maximized, cover the exact viewport safely (top: 0, right: 0, bottom: 0, left: 0, width: 100vw, height: 100vh)
  // When normal, center nicely or use user dragged position without transform conflicts
  let desktopStyle: React.CSSProperties = {}
  if (isDesktop) {
    if (isMaximized) {
      desktopStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        margin: 0,
        transform: 'none',
        borderRadius: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
      }
    } else if (position) {
      desktopStyle = {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
        transform: 'none',
        width: `min(${defaultWidth}px, 94vw)`,
        height: `min(${defaultHeight}px, 90vh)`,
        borderRadius: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.25)',
      }
    } else {
      desktopStyle = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
        width: `min(${defaultWidth}px, 94vw)`,
        height: `min(${defaultHeight}px, 90vh)`,
        borderRadius: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.25)',
      }
    }
  }

  return (
    <>
      <div
        className="sheet-scrim"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{ zIndex: 999 }}
      />
      <div
        ref={windowRef}
        className={`glass-sheet window-popup ${isMaximized ? 'is-maximized' : ''}`}
        role="dialog"
        aria-label={title}
        onClick={(e) => {
          // CRITICAL: Stop propagation so clicks inside the window or on rows/buttons don't bubble to scrim!
          e.stopPropagation()
        }}
        style={{
          ...desktopStyle,
          overflow: 'hidden',
          transition: isDragging.current ? 'none' : 'border-radius 0.2s ease, width 0.2s ease, height 0.2s ease',
        }}
      >
        {/* Mobile handle */}
        {!isDesktop ? <div className="sheet-handle" /> : null}

        {/* Window TitleBar (Movable in Windows/Desktop) */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={() => {
            if (isDesktop) setIsMaximized((prev) => !prev)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: isDesktop && !isMaximized ? 'move' : 'default',
            userSelect: 'none',
            flexShrink: 0,
            background: isDesktop ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          }}
        >
          {/* Title and info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--hy-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                {isDesktop && !isMaximized ? (
                  <span style={{ fontSize: 10, color: 'var(--hy-muted)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}>
                    جابجایی ✥
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <div style={{ fontSize: 11, color: 'var(--hy-subtext)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          {/* Window Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {allowTableViewToggle ? (
              <button
                type="button"
                className="no-drag"
                onClick={onToggleTableView}
                style={{
                  background: isTableView ? 'var(--hy-teal)' : 'rgba(255, 255, 255, 0.12)',
                  color: isTableView ? '#fff' : 'var(--hy-text)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 10,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={isTableView ? 'تغییر به نمای کارتی' : 'تغییر به نمای جدولی (Table View)'}
              >
                <span>{isTableView ? '🗂️ نمای کارتی' : '📊 نمای جدولی'}</span>
              </button>
            ) : null}

            {isDesktop ? (
              <>
                {/* Minimize Button */}
                <button
                  type="button"
                  className="no-drag"
                  onClick={() => setIsMinimized(true)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--hy-text)',
                    fontSize: 14,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  title="کوچک کردن (Minimize)"
                >
                  ─
                </button>

                {/* Maximize / Restore Button */}
                <button
                  type="button"
                  className="no-drag"
                  onClick={() => setIsMaximized((prev) => !prev)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--hy-text)',
                    fontSize: 13,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                  title={isMaximized ? 'بازگردانی به پنجره' : 'تمام صفحه (Maximize)'}
                >
                  {isMaximized ? '❐' : '□'}
                </button>
              </>
            ) : null}

            {/* Close Button */}
            <button
              type="button"
              className="sheet-close no-drag"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
              }}
              title="بستن پنجره"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Window Content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: isMaximized ? '14px 24px' : '10px 14px',
          }}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer ? (
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </>
  )
}
