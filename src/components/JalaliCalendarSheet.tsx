import { useEffect, useMemo, useState } from 'react'
import { todayIso } from '../lib/iso'
import {
  addJalaliMonths,
  isoToJalali,
  jalaliMonthGrid,
  jalaliToIso,
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  type JalaliDate,
} from '../lib/jalaali'
import { toFaDigits } from '../lib/money'

const MIN_JALALI_YEAR = 1200
const MAX_JALALI_YEAR = 1600

function resolveJalali(iso: string): JalaliDate {
  return isoToJalali(iso) ?? isoToJalali(todayIso()) ?? { jy: 1405, jm: 1, jd: 1 }
}

function shiftView(
  view: { jy: number; jm: number },
  mode: 'days' | 'months',
  delta: number,
): { jy: number; jm: number } {
  const next = mode === 'days' ? addJalaliMonths(view.jy, view.jm, delta) : { ...view, jy: view.jy + delta }
  if (next.jy < MIN_JALALI_YEAR || next.jy > MAX_JALALI_YEAR) return view
  return next
}

export function JalaliCalendarSheet({
  value,
  onSelect,
  onClose,
}: {
  value: string
  onSelect: (iso: string) => void
  onClose: () => void
}) {
  const selected = isoToJalali(value)
  const today = isoToJalali(todayIso())
  const initial = resolveJalali(value)
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm })
  const [mode, setMode] = useState<'days' | 'months'>('days')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const grid = useMemo(() => jalaliMonthGrid(view.jy, view.jm), [view.jy, view.jm])
  const monthLabel = `${JALALI_MONTHS[view.jm - 1]} ${toFaDigits(view.jy)}`

  function pickDay(jd: number) {
    const iso = jalaliToIso(view.jy, view.jm, jd)
    if (iso) onSelect(iso)
  }

  function pickToday() {
    if (!today) return
    const iso = jalaliToIso(today.jy, today.jm, today.jd)
    if (iso) onSelect(iso)
  }

  function pickMonth(jm: number) {
    setView((v) => ({ ...v, jm }))
    setMode('days')
  }

  return (
    <>
      <div className="sheet-scrim jalali-cal-scrim" onClick={onClose} />
      <div
        className="glass-sheet jalali-cal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="انتخاب تاریخ شمسی"
        dir="rtl"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>تاریخ شمسی</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        <div className="jalali-cal">
          <div className="jalali-cal-nav">
            <button
              className="jalali-cal-nav-btn"
              type="button"
              aria-label={mode === 'days' ? 'ماه قبل' : 'سال قبل'}
              onClick={() => setView((v) => shiftView(v, mode, -1))}
            >
              قبلی
            </button>
            <button
              className="jalali-cal-title"
              type="button"
              aria-label={mode === 'days' ? 'انتخاب ماه و سال' : 'بازگشت به روزها'}
              aria-pressed={mode === 'months'}
              onClick={() => setMode((m) => (m === 'days' ? 'months' : 'days'))}
            >
              {mode === 'days' ? monthLabel : toFaDigits(view.jy)}
            </button>
            <button
              className="jalali-cal-nav-btn"
              type="button"
              aria-label={mode === 'days' ? 'ماه بعد' : 'سال بعد'}
              onClick={() => setView((v) => shiftView(v, mode, 1))}
            >
              بعدی
            </button>
          </div>

          {mode === 'days' ? (
            <>
              <div className="jalali-cal-week" aria-hidden="true">
                {JALALI_WEEKDAYS_SHORT.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="jalali-cal-days" role="grid" aria-label={monthLabel}>
                {Array.from({ length: grid.offset }, (_, i) => (
                  <span key={`pad-${i}`} className="jalali-cal-pad" aria-hidden="true" />
                ))}
                {Array.from({ length: grid.length }, (_, i) => {
                  const jd = i + 1
                  const isSelected = selected?.jy === view.jy && selected.jm === view.jm && selected.jd === jd
                  const isToday = today?.jy === view.jy && today.jm === view.jm && today.jd === jd
                  return (
                    <button
                      key={jd}
                      type="button"
                      role="gridcell"
                      className={`jalali-cal-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                      aria-label={`${toFaDigits(jd)} ${monthLabel}`}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => pickDay(jd)}
                    >
                      {toFaDigits(jd)}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="jalali-cal-months" role="listbox" aria-label="انتخاب ماه">
              {JALALI_MONTHS.map((name, idx) => {
                const jm = idx + 1
                const active = view.jm === jm
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`jalali-cal-month${active ? ' selected' : ''}`}
                    onClick={() => pickMonth(jm)}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          )}

          <button className="btn-secondary-glass jalali-cal-today" type="button" onClick={pickToday}>
            امروز
          </button>
        </div>
      </div>
    </>
  )
}
