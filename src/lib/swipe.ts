/**
 * Swipe gesture mapping for HesabYar list rows.
 *
 * The app is `dir="rtl"`, but pointer `clientX` and `translateX` are **physical
 * screen** coordinates (they do not flip with RTL). Keep this map:
 *
 * | Finger (physical) | Row translate | Peek color / label | Action |
 * | ----------------- | ------------- | ------------------ | ------ |
 * | Right (+dx)       | slides right  | Red **حذف** on the left  | Delete (confirm) |
 * | Left (−dx)        | slides left   | Teal **ویرایش** on the right | Edit |
 *
 * This is the same RTL trailing-edge convention as the previous iOS-Mail
 * reveal (trailing = left in RTL). The gesture now **fires** the action
 * instead of leaving buttons stuck open. Below threshold → snap closed, no action.
 */

export const SWIPE_THRESHOLD_PX = 56
export const SWIPE_FLICK_PX = 28
export const SWIPE_FLICK_VELOCITY = 0.45
export const SWIPE_PEEK_PX = 88
export const SWIPE_MAX_PX = 132
export const SWIPE_FEEDBACK_MS = 220
export const SWIPE_AXIS_LOCK_PX = 10
export const SWIPE_SNAP_MS = 180

export type SwipeKind = 'edit' | 'delete'
export type SwipeArmed = SwipeKind | null

export function clampSwipeOffset(dx: number, canEdit: boolean, canDelete: boolean): number {
  const min = canEdit ? -SWIPE_MAX_PX : 0
  const max = canDelete ? SWIPE_MAX_PX : 0
  return Math.max(min, Math.min(max, dx))
}

/** Which action is armed while dragging (same threshold as release). */
export function swipeArmed(dx: number, canEdit: boolean, canDelete: boolean): SwipeArmed {
  if (canDelete && dx >= SWIPE_THRESHOLD_PX) return 'delete'
  if (canEdit && dx <= -SWIPE_THRESHOLD_PX) return 'edit'
  return null
}

/**
 * Decide the action on pointer-up.
 * `holdPx` is a brief peek (150–300ms) before the row **must** snap to 0.
 * There is no persistent open offset.
 */
export function releaseSwipe(
  dx: number,
  canEdit: boolean,
  canDelete: boolean,
  velocity = 0,
): { action: SwipeArmed; holdPx: number } {
  const action = swipeArmed(dx, canEdit, canDelete)
  if (action === 'delete') return { action, holdPx: SWIPE_PEEK_PX }
  if (action === 'edit') return { action, holdPx: -SWIPE_PEEK_PX }
  const flick = Math.abs(dx) >= SWIPE_FLICK_PX && Math.abs(velocity) >= SWIPE_FLICK_VELOCITY
  if (flick && dx > 0 && canDelete) return { action: 'delete', holdPx: SWIPE_PEEK_PX }
  if (flick && dx < 0 && canEdit) return { action: 'edit', holdPx: -SWIPE_PEEK_PX }
  return { action: null, holdPx: 0 }
}

export function swipeFeedbackMs(reducedMotion = false): number {
  return reducedMotion ? 0 : SWIPE_FEEDBACK_MS
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
