import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatPersianDateFull } from '../lib/dates'
import { JalaliCalendarSheet } from './JalaliCalendarSheet'

export function DateField({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string
  value: string
  onChange: (iso: string) => void
  readOnly?: boolean
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const host = btnRef.current?.closest('.device-screen')
    setPortalRoot((host as HTMLElement | null) ?? document.body)
  }, [])

  return (
    <>
      <button
        ref={btnRef}
        className={`field-chip${readOnly ? ' chip-readonly' : ''}`}
        type="button"
        disabled={readOnly}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!readOnly) setOpen(true)
        }}
      >
        <span className="ficon">📆</span>
        <div>
          <div className="flabel">{label}</div>
          <div className={value ? 'fvalue' : 'fvalue placeholder-val'}>
            {value ? formatPersianDateFull(value) : 'انتخاب تاریخ…'}
          </div>
        </div>
        {readOnly ? <span className="readonly-tag">قفل</span> : <span className="fchev">‹</span>}
      </button>
      {open && portalRoot
        ? createPortal(
            <JalaliCalendarSheet
              value={value}
              onSelect={(iso) => {
                onChange(iso)
                setOpen(false)
              }}
              onClose={() => setOpen(false)}
            />,
            portalRoot,
          )
        : null}
    </>
  )
}
