import { describe, expect, it } from 'vitest'
import {
  SWIPE_PEEK_PX,
  SWIPE_THRESHOLD_PX,
  clampSwipeOffset,
  releaseSwipe,
  swipeArmed,
  swipeFeedbackMs,
} from '../lib/swipe'

describe('RTL physical swipe map (finger right = delete, left = edit)', () => {
  it('arms delete when the finger moves right past the threshold', () => {
    expect(swipeArmed(SWIPE_THRESHOLD_PX, true, true)).toBe('delete')
    expect(swipeArmed(SWIPE_THRESHOLD_PX + 40, true, true)).toBe('delete')
    expect(releaseSwipe(90, true, true)).toEqual({ action: 'delete', holdPx: SWIPE_PEEK_PX })
  })

  it('arms edit when the finger moves left past the threshold', () => {
    expect(swipeArmed(-SWIPE_THRESHOLD_PX, true, true)).toBe('edit')
    expect(swipeArmed(-SWIPE_THRESHOLD_PX - 40, true, true)).toBe('edit')
    expect(releaseSwipe(-90, true, true)).toEqual({ action: 'edit', holdPx: -SWIPE_PEEK_PX })
  })

  it('snaps closed with no action below the threshold', () => {
    expect(swipeArmed(SWIPE_THRESHOLD_PX - 1, true, true)).toBeNull()
    expect(swipeArmed(-(SWIPE_THRESHOLD_PX - 1), true, true)).toBeNull()
    expect(releaseSwipe(40, true, true)).toEqual({ action: null, holdPx: 0 })
    expect(releaseSwipe(-40, true, true)).toEqual({ action: null, holdPx: 0 })
    expect(releaseSwipe(0, true, true)).toEqual({ action: null, holdPx: 0 })
  })

  it('never returns a persistent sticky-open offset', () => {
    for (const dx of [-200, -88, -72, -40, 0, 40, 72, 88, 200]) {
      const result = releaseSwipe(dx, true, true)
      if (!result.action) expect(result.holdPx).toBe(0)
      else expect(Math.abs(result.holdPx)).toBe(SWIPE_PEEK_PX)
    }
  })

  it('does not arm an action that is not available', () => {
    expect(swipeArmed(90, true, false)).toBeNull()
    expect(swipeArmed(-90, false, true)).toBeNull()
    expect(releaseSwipe(90, true, false)).toEqual({ action: null, holdPx: 0 })
    expect(releaseSwipe(-90, false, true)).toEqual({ action: null, holdPx: 0 })
  })

  it('clamps drag to the enabled side only', () => {
    expect(clampSwipeOffset(200, true, true)).toBe(132)
    expect(clampSwipeOffset(-200, true, true)).toBe(-132)
    expect(clampSwipeOffset(80, false, true)).toBe(80)
    expect(clampSwipeOffset(-80, false, true)).toBe(0)
    expect(clampSwipeOffset(80, true, false)).toBe(0)
    expect(clampSwipeOffset(-80, true, false)).toBe(-80)
  })

  it('treats a fast short flick as a commit so mobile gestures still fire', () => {
    expect(releaseSwipe(32, true, true, 0.6)).toEqual({ action: 'delete', holdPx: SWIPE_PEEK_PX })
    expect(releaseSwipe(-32, true, true, -0.6)).toEqual({ action: 'edit', holdPx: -SWIPE_PEEK_PX })
    expect(releaseSwipe(32, true, true, 0.1)).toEqual({ action: null, holdPx: 0 })
  })

  it('skips the peek delay when reduced motion is requested', () => {
    expect(swipeFeedbackMs(false)).toBe(220)
    expect(swipeFeedbackMs(true)).toBe(0)
  })
})
