import { useEffect, useState } from 'react'

export function CloudLamp() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return (
    <span className={`net-lamp${online ? ' is-on' : ' is-off'}`} title={online ? 'آنلاین' : 'آفلاین'} aria-label={online ? 'آنلاین' : 'آفلاین'} />
  )
}
