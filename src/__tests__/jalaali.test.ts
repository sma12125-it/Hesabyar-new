import { describe, expect, it } from 'vitest'
import { addDaysIso, isoFromParts } from '../lib/iso'
import {
  addJalaliMonths,
  addJalaliMonthsIso,
  isLeapJalaaliYear,
  isoToJalali,
  isValidJalaaliDate,
  jalaaliMonthLength,
  jalaliMonthGrid,
  jalaliToIso,
  jalaliWeekday,
  toGregorian,
  toJalaali,
} from '../lib/jalaali'

describe('Jalali ↔ Gregorian conversion', () => {
  it('maps Nowruz (1 Farvardin) for recent years', () => {
    expect(toJalaali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 })
    expect(toGregorian(1403, 1, 1)).toEqual({ gy: 2024, gm: 3, gd: 20 })
    expect(toJalaali(2025, 3, 20)).toEqual({ jy: 1403, jm: 12, jd: 30 })
    expect(toJalaali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 })
    expect(toJalaali(2026, 3, 21)).toEqual({ jy: 1405, jm: 1, jd: 1 })
    expect(jalaliToIso(1405, 1, 1)).toBe('2026-03-21')
  })

  it('matches known ISO dates used in the app display tests', () => {
    expect(isoToJalali('2026-09-03')).toEqual({ jy: 1405, jm: 6, jd: 12 })
    expect(isoToJalali('2026-09-23')).toEqual({ jy: 1405, jm: 7, jd: 1 })
    expect(jalaliToIso(1405, 7, 1)).toBe('2026-09-23')
  })

  it('round-trips every day of a common year and a leap year', () => {
    for (const start of ['2024-03-20', '2025-03-20'] as const) {
      let iso: string = start
      const seen = new Set<string>()
      for (let i = 0; i < 366; i += 1) {
        const j = isoToJalali(iso)
        expect(j).not.toBeNull()
        expect(jalaliToIso(j!.jy, j!.jm, j!.jd)).toBe(iso)
        seen.add(`${j!.jy}-${j!.jm}-${j!.jd}`)
        const next = addDaysIso(iso, 1)
        if (isoToJalali(next)?.jm === 1 && isoToJalali(next)?.jd === 1 && i > 0) break
        iso = next
      }
      expect(seen.size).toBeGreaterThanOrEqual(365)
    }
  })

  it('round-trips Gregorian leap day', () => {
    expect(toJalaali(2024, 2, 29)).toEqual({ jy: 1402, jm: 12, jd: 10 })
    expect(jalaliToIso(1402, 12, 10)).toBe('2024-02-29')
  })
})

describe('Jalali month lengths and leap years', () => {
  it('uses 31 / 30 / 29-or-30 month lengths', () => {
    for (const year of [1403, 1404, 1405]) {
      for (let m = 1; m <= 6; m += 1) expect(jalaaliMonthLength(year, m)).toBe(31)
      for (let m = 7; m <= 11; m += 1) expect(jalaaliMonthLength(year, m)).toBe(30)
    }
    expect(jalaaliMonthLength(1403, 12)).toBe(30)
    expect(jalaaliMonthLength(1404, 12)).toBe(29)
    expect(isValidJalaaliDate(1403, 12, 30)).toBe(true)
    expect(isValidJalaaliDate(1403, 12, 31)).toBe(false)
    expect(isValidJalaaliDate(1404, 12, 29)).toBe(true)
    expect(isValidJalaaliDate(1404, 12, 30)).toBe(false)
    expect(isValidJalaaliDate(1405, 1, 31)).toBe(true)
    expect(isValidJalaaliDate(1405, 1, 32)).toBe(false)
    expect(isValidJalaaliDate(1405, 7, 30)).toBe(true)
    expect(isValidJalaaliDate(1405, 7, 31)).toBe(false)
  })

  it('detects leap years on the 33-year cycle (Esfand 30)', () => {
    expect(isLeapJalaaliYear(1395)).toBe(true)
    expect(isLeapJalaaliYear(1399)).toBe(true)
    expect(isLeapJalaaliYear(1403)).toBe(true)
    expect(isLeapJalaaliYear(1404)).toBe(false)
    expect(jalaliToIso(1399, 12, 30)).toBe('2021-03-20')
    expect(jalaliToIso(1403, 12, 30)).toBe('2025-03-20')
    expect(jalaliToIso(1404, 12, 29)).toBe('2026-03-20')
  })

  it('rejects invalid Jalali coordinates', () => {
    expect(isValidJalaaliDate(1405, 0, 1)).toBe(false)
    expect(isValidJalaaliDate(1405, 13, 1)).toBe(false)
    expect(isValidJalaaliDate(1405, 6, 0)).toBe(false)
    expect(jalaliToIso(1404, 12, 30)).toBeNull()
    expect(isoToJalali('2026-02-30')).toBeNull()
    expect(isoToJalali('not-a-date')).toBeNull()
  })
})

describe('Jalali calendar grid', () => {
  it('starts the week on Saturday and pads the first of the month', () => {
    expect(jalaliWeekday(1405, 1, 1)).toBe(0)
    const farvardin = jalaliMonthGrid(1405, 1)
    expect(farvardin.length).toBe(31)
    expect(farvardin.offset).toBe(0)
    const shahrivar = jalaliMonthGrid(1405, 6)
    expect(shahrivar.length).toBe(31)
    const mehr = jalaliMonthGrid(1405, 7)
    expect(mehr.length).toBe(30)
    expect(mehr.offset).toBe(jalaliWeekday(1405, 7, 1))
    expect(mehr.offset).toBeGreaterThan(0)
    expect(addJalaliMonths(1405, 12, 1)).toEqual({ jy: 1406, jm: 1 })
    expect(addJalaliMonths(1405, 1, -1)).toEqual({ jy: 1404, jm: 12 })
  })

  it('adds Jalali months on an ISO date without permanently shifting the day', () => {
    const day6 = jalaliToIso(1405, 6, 6)!
    for (let i = 0; i < 14; i += 1) {
      expect(isoToJalali(addJalaliMonthsIso(day6, i))?.jd).toBe(6)
    }
    const day31 = jalaliToIso(1404, 6, 31)!
    expect(isoToJalali(addJalaliMonthsIso(day31, 1))).toEqual({ jy: 1404, jm: 7, jd: 30 })
    expect(isoToJalali(addJalaliMonthsIso(day31, 7))).toEqual({ jy: 1405, jm: 1, jd: 31 })
    expect(isoToJalali(addJalaliMonthsIso(day31, 6))).toEqual({ jy: 1404, jm: 12, jd: 29 })
  })

  it('keeps ISO persistence as Gregorian YYYY-MM-DD', () => {
    const iso = jalaliToIso(1405, 6, 25)
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(iso).toBe(isoFromParts(2026, 9, 16))
  })
})
