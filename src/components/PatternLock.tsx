import { useRef, type PointerEvent } from 'react'

/** Drag across dots. A dot is accepted when the pointer passes over it, not on a separate click. */
export function PatternLock({
  value,
  onChange,
  onRelease,
}: {
  value: number[]
  onChange: (next: number[]) => void
  onRelease?: (next: number[]) => void
}) {
  const board = useRef<HTMLDivElement>(null)
  const path = useRef<number[]>([])
  const drawing = useRef(false)

  function dotAt(clientX: number, clientY: number): number | null {
    const nodes = board.current?.querySelectorAll<HTMLElement>('[data-dot]')
    if (!nodes) return null
    for (const node of nodes) {
      const box = node.getBoundingClientRect()
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const dx = clientX - cx
      const dy = clientY - cy
      if (dx * dx + dy * dy <= (box.width / 2) ** 2) return Number(node.dataset.dot)
    }
    return null
  }

  function pushDot(index: number | null) {
    if (index == null || path.current.includes(index)) return
    path.current = [...path.current, index]
    onChange(path.current)
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    drawing.current = true
    path.current = []
    onChange([])
    event.currentTarget.setPointerCapture(event.pointerId)
    pushDot(dotAt(event.clientX, event.clientY))
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drawing.current) return
    pushDot(dotAt(event.clientX, event.clientY))
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    onRelease?.(path.current)
  }

  return (
    <div
      ref={board}
      className="pattern-grid"
      aria-label="الگوی ورود"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} data-dot={index} className={`pattern-dot${value.includes(index) ? ' on' : ''}`} />
      ))}
    </div>
  )
}
