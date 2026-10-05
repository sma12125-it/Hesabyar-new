import { useState, useRef, useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface WindowPopupProps {
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
  onMinimize?: () => void
  isMinimized?: boolean
  onMinimizeChange?: (minimized: boolean) => void
  windowId?: string
}

export interface MinimizedWindowInfo {
  id: string
  title: string
  icon: string
  restore: () => void
  close: () => void
}

// Global registry of all minimized popups
const minimizedRegistry = new Map<string, MinimizedWindowInfo>()
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((l) => l())
}

function subscribeMinimized(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// Global Taskbar Dock for all minimized windows
export function GlobalMinimizedDock() {
  const [, setTick] = useState(0)

  useEffect(() => {
    return subscribeMinimized(() => setTick((t) => t + 1))
  }, [])

  if (typeof document === 'undefined') return null

  const items = Array.from(minimizedRegistry.values())
  if (items.length === 0) return null

  return createPortal(
    <div
      className="desktop-dock"
      style={{
        position: 'fixed',
        bottom: 18,
        right: 20,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'auto',
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="minimized-window-pill"
          onClick={item.restore}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.28)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
            cursor: 'pointer',
            animation: 'popIn 0.2s ease',
            userSelect: 'none',
          }}
          title="کلیک برای بازگردانی پنجره (Restore)"
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              maxWidth: 190,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.title}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              item.restore()
            }}
            style={{
              background: 'rgba(56, 189, 248, 0.16)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="باز کردن پنجره"
          >
            <span>🗖</span>
            <span>باز کردن</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              item.close()
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 2,
            }}
            title="بستن دائمی پنجره"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
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
  onMinimize,
  isMinimized: controlledMinimized,
  onMinimizeChange,
  windowId,
}: WindowPopupProps) {
  const autoId = useId()
  const uniqueId = windowId || autoId

  const [internalMinimized, setInternalMinimized] = useState(false)
  const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized

  const setMinimized = (val: boolean) => {
    if (onMinimizeChange) onMinimizeChange(val)
    else setInternalMinimized(val)
    if (val && onMinimize) onMinimize()
  }

  const [isMaximized, setIsMaximized] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)

  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? Math.min(defaultWidth, window.innerWidth - 32) : defaultWidth,
    height: typeof window !== 'undefined' ? Math.min(defaultHeight, window.innerHeight - 32) : defaultHeight,
  }))

  const calcCenter = () => {
    if (typeof window === 'undefined') return { x: 40, y: 40 }
    const w = Math.min(size?.width ?? defaultWidth, window.innerWidth - 32)
    const h = Math.min(size?.height ?? defaultHeight, window.innerHeight - 32)
    return {
      x: Math.max(16, Math.round((window.innerWidth - w) / 2)),
      y: Math.max(16, Math.round((window.innerHeight - h) / 2)),
    }
  }

  const [position, setPosition] = useState<{ x: number; y: number }>(calcCenter)

  const isDragging = useRef(false)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const windowStartPos = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)

  const resizingRef = useRef<{
    direction: string
    startX: number
    startY: number
    startW: number
    startH: number
    startXPos: number
    startYPos: number
  } | null>(null)

  const handleResizeStart = (direction: string, e: React.PointerEvent) => {
    if (!isDesktop || isMaximized || isMinimized) return
    e.stopPropagation()
    e.preventDefault()
    resizingRef.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
      startXPos: position.x,
      startYPos: position.y,
    }

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!resizingRef.current) return
      const { direction: dir, startX, startY, startW, startH, startXPos, startYPos } = resizingRef.current
      const dx = moveEv.clientX - startX
      const dy = moveEv.clientY - startY

      let newW = startW
      let newH = startH
      let newX = startXPos
      let newY = startYPos

      if (dir.includes('e')) {
        newW = Math.max(340, Math.min(window.innerWidth - startXPos - 12, startW + dx))
      }
      if (dir.includes('s')) {
        newH = Math.max(300, Math.min(window.innerHeight - startYPos - 12, startH + dy))
      }
      if (dir.includes('w')) {
        const potentialW = Math.max(340, startW - dx)
        if (potentialW >= 340 && startXPos + dx >= 10) {
          newW = potentialW
          newX = startXPos + dx
        }
      }
      if (dir.includes('n')) {
        const potentialH = Math.max(300, startH - dy)
        if (potentialH >= 300 && startYPos + dy >= 10) {
          newH = potentialH
          newY = startYPos + dy
        }
      }

      setSize({ width: newW, height: newH })
      setPosition({ x: newX, y: newY })
    }

    const onPointerUp = () => {
      resizingRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Keep window in bounds on resize
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768
      setIsDesktop(desktop)
      if (desktop) {
        setPosition((prev) => {
          const w = Math.min(size.width, window.innerWidth - 32)
          const h = Math.min(size.height, window.innerHeight - 32)
          return {
            x: Math.max(10, Math.min(window.innerWidth - w - 10, prev.x)),
            y: Math.max(10, Math.min(window.innerHeight - h - 10, prev.y)),
          }
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [size.width, size.height])

  // Manage registration in global minimized dock
  useEffect(() => {
    if (isOpen && isMinimized) {
      minimizedRegistry.set(uniqueId, {
        id: uniqueId,
        title,
        icon,
        restore: () => setMinimized(false),
        close: () => {
          setMinimized(false)
          onClose()
        },
      })
      notifyListeners()
    } else {
      if (minimizedRegistry.has(uniqueId)) {
        minimizedRegistry.delete(uniqueId)
        notifyListeners()
      }
    }
    return () => {
      if (minimizedRegistry.has(uniqueId)) {
        minimizedRegistry.delete(uniqueId)
        notifyListeners()
      }
    }
  }, [isOpen, isMinimized, uniqueId, title, icon, onClose])

  // Dragging logic for desktop
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDesktop || isMaximized || isMinimized) return
    if (e.button !== 0) return

    // Don't drag if clicking buttons, inputs, etc.
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('a') ||
      target.closest('.no-drag')
    )
      return

    isDragging.current = true
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    windowStartPos.current = { x: position.x, y: position.y }

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return
      const dx = moveEvent.clientX - dragStartPos.current.x
      const dy = moveEvent.clientY - dragStartPos.current.y

      const rect = windowRef.current?.getBoundingClientRect()
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

  // Desktop positioning logic:
  // When maximized: 0 inset from edges, takes the entire screen, strictly within boundaries.
  // When normal: position.x & position.y with manual size.
  let desktopStyle: React.CSSProperties = {}
  if (isDesktop) {
    if (isMaximized) {
      desktopStyle = {
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        margin: 0,
        transform: 'none',
        borderRadius: 0,
        zIndex: 10000,
        display: isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: 0,
      }
    } else {
      const availW = typeof window !== 'undefined' ? window.innerWidth : 1200
      const availH = typeof window !== 'undefined' ? window.innerHeight : 800
      desktopStyle = {
        position: 'fixed',
        left: position.x,
        top: position.y,
        right: 'auto',
        bottom: 'auto',
        transform: 'none',
        width: Math.min(size.width, availW - 20),
        height: Math.min(size.height, availH - 20),
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 20px)',
        borderRadius: 20,
        zIndex: 1000,
        display: isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.25)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: 0,
      }
    }
  }

  // Mobile styling: anchored bottom-sheet with top gap, zIndex 1000.
  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    top: 'max(16px, env(safe-area-inset-top, 16px))',
    width: '100%',
    height: 'calc(100% - max(16px, env(safe-area-inset-top, 16px)))',
    maxHeight: 'calc(100% - max(16px, env(safe-area-inset-top, 16px)))',
    borderRadius: '24px 24px 0 0',
    zIndex: 1000,
    display: isMinimized ? 'none' : 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 0,
    margin: 0,
    transform: 'none',
    boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.5)',
    boxSizing: 'border-box',
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Background Scrim - only shown when not minimized */}
      {!isMinimized && (
        <div
          className="sheet-scrim"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 998,
            background: 'rgba(0, 0, 0, 0.52)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Main Window Popup Dialog (Kept mounted in DOM when minimized to preserve all state) */}
      <div
        ref={windowRef}
        className={`glass-sheet window-popup ${isMaximized ? 'is-maximized' : ''} ${isMinimized ? 'is-minimized' : ''}`}
        role="dialog"
        aria-label={title}
        onClick={(e) => {
          // CRITICAL: Stop propagation so clicks inside the window or on rows/buttons never bubble to scrim!
          e.stopPropagation()
        }}
        onPointerDown={(e) => {
          // Stop pointer events inside dialog from triggering backdrop handlers
          e.stopPropagation()
        }}
        style={{
          ...(isDesktop ? desktopStyle : mobileStyle),
          transition: isDragging.current || resizingRef.current
            ? 'none'
            : 'border-radius 0.2s ease, width 0.2s ease, height 0.2s ease, top 0.2s ease, left 0.2s ease, right 0.2s ease, bottom 0.2s ease',
        }}
      >
        {/* Resize Handles on Desktop (Drag border or corner to resize manually) */}
        {isDesktop && !isMaximized ? (
          <>
            {/* Right edge */}
            <div
              onPointerDown={(e) => handleResizeStart('e', e)}
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                right: -2,
                width: 10,
                cursor: 'ew-resize',
                zIndex: 30,
              }}
              title="تغییر عرض پنجره"
            />
            {/* Left edge */}
            <div
              onPointerDown={(e) => handleResizeStart('w', e)}
              style={{
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: -2,
                width: 10,
                cursor: 'ew-resize',
                zIndex: 30,
              }}
              title="تغییر عرض پنجره"
            />
            {/* Bottom edge */}
            <div
              onPointerDown={(e) => handleResizeStart('s', e)}
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: -2,
                height: 10,
                cursor: 'ns-resize',
                zIndex: 30,
              }}
              title="تغییر ارتفاع پنجره"
            />
            {/* Bottom-Right corner */}
            <div
              onPointerDown={(e) => handleResizeStart('se', e)}
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                zIndex: 35,
              }}
              title="تغییر سایز پنجره"
            />
            {/* Bottom-Left corner */}
            <div
              onPointerDown={(e) => handleResizeStart('sw', e)}
              style={{
                position: 'absolute',
                left: -2,
                bottom: -2,
                width: 16,
                height: 16,
                cursor: 'nesw-resize',
                zIndex: 35,
              }}
              title="تغییر سایز پنجره"
            />
          </>
        ) : null}

        {/* Mobile top handle */}
        {!isDesktop ? <div className="sheet-handle" style={{ marginTop: 8, marginBottom: 4 }} /> : null}

        {/* Window TitleBar (Draggable on Desktop, with Window Controls) */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={() => {
            if (isDesktop) setIsMaximized((prev) => !prev)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isDesktop ? '10px 14px 12px' : '6px 14px 10px',
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
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--hy-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </span>
                {isDesktop && !isMaximized ? (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--hy-muted)',
                      background: 'rgba(255,255,255,0.08)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    جابجایی ✥
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--hy-subtext)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
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

            {/* Minimize Button - Available everywhere (desktop and mobile) */}
            <button
              type="button"
              className="no-drag"
              onClick={() => setMinimized(true)}
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
              title="کوچک کردن پنجره (Minimize)"
              aria-label="کوچک کردن"
            >
              ─
            </button>

            {/* Maximize / Restore Button on Desktop */}
            {isDesktop ? (
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
                title={isMaximized ? 'بازگردانی به پنجره (Restore)' : 'تمام صفحه در کادر (Maximize)'}
                aria-label="بزرگ کردن"
              >
                {isMaximized ? '❐' : '□'}
              </button>
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
              aria-label="بستن"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Window Content Body */}
        <div
          className="window-popup-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: isDesktop ? (isMaximized ? '14px 24px' : '10px 14px') : '10px 14px 16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>

        {/* Optional Footer (Always pinned at bottom) */}
        {footer ? (
          <div
            className="sheet-footer"
            style={{
              padding: isDesktop ? '10px 16px' : '10px 14px 14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>

      {/* Global Dock rendering all minimized windows */}
      <GlobalMinimizedDock />
    </>,
    document.body,
  )
}
