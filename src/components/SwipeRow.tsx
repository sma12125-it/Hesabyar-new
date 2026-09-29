/**
 * Gesture swipe (not sticky Mail buttons). Physical map: right → delete, left → edit.
 * See `src/lib/swipe.ts`. After commit/cancel the row always snaps to translateX(0).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  SWIPE_AXIS_LOCK_PX,
  SWIPE_SNAP_MS,
  clampSwipeOffset,
  prefersReducedMotion,
  releaseSwipe,
  swipeArmed,
  swipeFeedbackMs,
} from '../lib/swipe'

export function SwipeRow({
  children,
  onEdit,
  onDelete,
}: {
  children: ReactNode
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [x, setX] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'dragging' | 'feedback'>('idle')
  const xRef = useRef(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const axis = useRef<'undecided' | 'h' | 'v'>('undecided')
  const dragging = useRef(false)
  const pointerId = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const phaseRef = useRef(phase)
  const timerRef = useRef<number>(0)
  const frontRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`swipe_${Math.random().toString(36).slice(2)}`)
  const canEdit = Boolean(onEdit)
  const canDelete = Boolean(onDelete)
  const armed = swipeArmed(x, canEdit, canDelete)

  phaseRef.current = phase

  useEffect(() => {
    const close = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail !== idRef.current && xRef.current !== 0 && phaseRef.current !== 'feedback') {
        xRef.current = 0
        setX(0)
        setPhase('idle')
      }
    }
    window.addEventListener('hy-swipe', close)
    return () => window.removeEventListener('hy-swipe', close)
  }, [])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useEffect(() => {
    const el = frontRef.current
    if (!el || (!onEdit && !onDelete)) return
    const onMove = (event: PointerEvent) => {
      if (!dragging.current || phaseRef.current === 'feedback') return
      if (pointerId.current != null && event.pointerId !== pointerId.current) return
      const dx = event.clientX - startX.current
      const dy = event.clientY - startY.current
      if (axis.current === 'undecided') {
        if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) return
        axis.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
        if (axis.current === 'v') {
          dragging.current = false
          if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
          return
        }
        try {
          el.setPointerCapture(event.pointerId)
        } catch {
          /* pointer already gone */
        }
        window.dispatchEvent(new CustomEvent('hy-swipe', { detail: idRef.current }))
        setPhase('dragging')
      }
      if (axis.current !== 'h') return
      event.preventDefault()
      const now = event.timeStamp
      const dt = now - lastT.current
      if (dt > 0) velocity.current = (event.clientX - lastX.current) / dt
      lastX.current = event.clientX
      lastT.current = now
      const next = clampSwipeOffset(dx, Boolean(onEdit), Boolean(onDelete))
      xRef.current = next
      setX(next)
    }
    el.addEventListener('pointermove', onMove, { passive: false })
    return () => el.removeEventListener('pointermove', onMove)
  }, [onEdit, onDelete])

  if (!onEdit && !onDelete) return children

  function commit(next: number) {
    xRef.current = next
    setX(next)
  }

  function finish(action: 'edit' | 'delete' | null, holdPx: number) {
    dragging.current = false
    axis.current = 'undecided'
    pointerId.current = null
    if (!action) {
      setPhase('idle')
      commit(0)
      return
    }
    const delay = swipeFeedbackMs(prefersReducedMotion())
    commit(holdPx)
    setPhase('feedback')
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      commit(0)
      setPhase('idle')
      if (action === 'delete') onDelete?.()
      else onEdit?.()
    }, delay)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (phaseRef.current === 'feedback') return
    startX.current = event.clientX
    startY.current = event.clientY
    lastX.current = event.clientX
    lastT.current = event.timeStamp
    velocity.current = 0
    axis.current = 'undecided'
    dragging.current = true
    pointerId.current = event.pointerId
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current && axis.current !== 'h') return
    if (pointerId.current != null && event.pointerId !== pointerId.current) return
    const wasHorizontal = axis.current === 'h'
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (wasHorizontal) {
      suppressClick.current = true
      const { action, holdPx } = releaseSwipe(xRef.current, canEdit, canDelete, velocity.current)
      finish(action, holdPx)
      return
    }
    axis.current = 'undecided'
    pointerId.current = null
    setPhase('idle')
  }

  function onClickCapture(event: { preventDefault: () => void; stopPropagation: () => void }) {
    if (suppressClick.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = false
    }
  }

  return (
    <div
      className={`swipe-wrap${armed ? ` swipe-armed-${armed}` : ''}`}
      data-swipe-phase={phase}
    >
      <div className="swipe-bg" dir="ltr" aria-hidden="true">
        {canDelete ? (
          <div className={`swipe-peek delete${armed === 'delete' ? ' armed' : ''}`} style={{ width: Math.max(0, x) }}>
            <span>حذف</span>
          </div>
        ) : null}
        {canEdit ? (
          <div className={`swipe-peek edit${armed === 'edit' ? ' armed' : ''}`} style={{ width: Math.max(0, -x) }}>
            <span>ویرایش</span>
          </div>
        ) : null}
      </div>
      <div
        ref={frontRef}
        className={`swipe-front${phase === 'dragging' ? ' dragging' : ''}`}
        style={{
          transform: `translate3d(${x}px, 0, 0)`,
          transition: phase === 'dragging' ? 'none' : `transform ${SWIPE_SNAP_MS}ms ease-out`,
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  )
}
