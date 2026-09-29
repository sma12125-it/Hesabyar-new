/**
 * Jalali (Solar Hijri / شمسی) calendar helpers.
 *
 * Conversion uses the Kazimierz M. Borkowski algorithm as implemented by
 * jalaali-js (33-year cycle with historical break years).
 * @see http://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm
 */
import { isoFromParts, isValidIsoDate, parseIsoDate } from './iso'

export type JalaliDate = { jy: number; jm: number; jd: number }
export type GregorianDate = { gy: number; gm: number; gd: number }

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

/** Saturday-first Persian week, matching typical شمسی calendars. */
export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

const BREAKS: number[] = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
]

function div(a: number, b: number): number {
  return ~~(a / b)
}

function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function jalCal(
  jy: number,
  withoutLeap: boolean,
): { leap: number; gy: number; march: number } | { gy: number; march: number } {
  const bl = BREAKS.length
  const gy = jy + 621
  let leapJ = -14
  let jp = BREAKS[0]
  let jump = 0
  let i

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`سال شمسی نامعتبر است: ${jy}`)
  }

  for (i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  const n0 = jy - jp

  leapJ = leapJ + div(n0, 33) * 8 + div(mod(n0, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n0 === 4) leapJ += 1

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (withoutLeap) return { gy, march }

  let n = n0
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function jalCalLeap(jy: number): number {
  const bl = BREAKS.length
  let jp = BREAKS[0]
  let jump = 0
  let i

  if (jy < jp || jy >= BREAKS[bl - 1]) {
    throw new Error(`سال شمسی نامعتبر است: ${jy}`)
  }

  for (i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    jp = jm
  }
  let n = jy - jp
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return leap
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy, true)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy, false)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  let jm: number
  let jd: number

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31)
      jd = mod(k, 31) + 1
      return { jy, jm, jd }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if ('leap' in r && r.leap === 1) k += 1
  }
  jm = 7 + div(k, 30)
  jd = mod(k, 30) + 1
  return { jy, jm, jd }
}

export function toJalaali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd))
}

export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd))
}

export function isLeapJalaaliYear(jy: number): boolean {
  return jalCalLeap(jy) === 0
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm < 1 || jm > 12) return 0
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalaaliYear(jy) ? 30 : 29
}

export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean {
  return (
    Number.isInteger(jy) &&
    Number.isInteger(jm) &&
    Number.isInteger(jd) &&
    jy >= -61 &&
    jy <= 3177 &&
    jm >= 1 &&
    jm <= 12 &&
    jd >= 1 &&
    jd <= jalaaliMonthLength(jy, jm)
  )
}

export function isoToJalali(iso: string): JalaliDate | null {
  if (!isValidIsoDate(iso)) return null
  const parts = parseIsoDate(iso)
  if (!parts) return null
  return toJalaali(parts.year, parts.month, parts.day)
}

export function jalaliToIso(jy: number, jm: number, jd: number): string | null {
  if (!isValidJalaaliDate(jy, jm, jd)) return null
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return isoFromParts(gy, gm, gd)
}

/** Saturday = 0 … Friday = 6. */
export function jalaliWeekday(jy: number, jm: number, jd: number): number {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return (new Date(gy, gm - 1, gd).getDay() + 1) % 7
}

export function jalaliMonthGrid(jy: number, jm: number): { offset: number; length: number } {
  return { offset: jalaliWeekday(jy, jm, 1), length: jalaaliMonthLength(jy, jm) }
}

export function addJalaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const zero = jy * 12 + (jm - 1) + delta
  const year = Math.floor(zero / 12)
  const monthIndex = ((zero % 12) + 12) % 12
  return { jy: year, jm: monthIndex + 1 }
}

/**
 * Add Jalali months to an ISO date, keeping the original Jalali day-of-month.
 * Shorter months clamp to that month's last day only — the anchor day is not shifted.
 */
export function addJalaliMonthsIso(iso: string, months: number): string {
  const j = isoToJalali(iso)
  if (!j) throw new Error('تاریخ نامعتبر است')
  const shifted = addJalaliMonths(j.jy, j.jm, months)
  const length = jalaaliMonthLength(shifted.jy, shifted.jm)
  const jd = Math.min(j.jd, length)
  const out = jalaliToIso(shifted.jy, shifted.jm, jd)
  if (!out) throw new Error('تاریخ نامعتبر است')
  return out
}
