import { useEffect } from 'react'

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 3600)
    return () => window.clearTimeout(id)
  }, [message, onDone])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
