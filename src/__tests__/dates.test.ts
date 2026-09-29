import { describe, expect, it } from 'vitest'
import { formatPersianDate, formatPersianDateFull, formatRelativeFa } from '../lib/dates'
import { addCalendarMonths, addDaysIso, isValidIsoDate, todayIso } from '../lib/iso'

describe('relative Persian dates', () => {
  const noon = new Date('2026-09-15T12:00:00').getTime()

  it('labels today, yesterday, and n days ago', () => {
    expect(formatRelativeFa(noon - 2 * 60 * 60 * 1000, noon)).toBe('امروز')
    expect(formatRelativeFa(noon - 24 * 60 * 60 * 1000, noon)).toBe('دیروز')
    expect(formatRelativeFa(noon - 2 * 24 * 60 * 60 * 1000, noon)).toBe('۲ روز پیش')
  })
})

describe('ISO Gregorian dates', () => {
  it('adds calendar months and days', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addDaysIso('2026-09-15', 3)).toBe('2026-09-18')
    expect(isValidIsoDate('2026-09-15')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(todayIso(new Date(2026, 8, 15))).toBe('2026-09-15')
  })

  it('formats Persian display from stored ISO dates', () => {
    expect(formatPersianDate('2026-09-03')).toMatch(/شهریور/)
    expect(formatPersianDateFull('2026-09-23')).toMatch(/مهر/)
  })
})
