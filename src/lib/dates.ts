import { parseIsoDate } from './iso'
import { toFaDigits } from './money'

const RELATIVE_DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatClock(date = new Date()): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return toFaDigits(`${h}:${String(m).padStart(2, '0')}`)
}

export function formatRelativeFa(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / RELATIVE_DAY_MS)
  if (diffDays <= 0) return 'امروز'
  if (diffDays === 1) return 'دیروز'
  if (diffDays === 2) return '۲ روز پیش'
  if (diffDays < 7) return `${toFaDigits(diffDays)} روز پیش`
  if (diffDays < 30) return `${toFaDigits(Math.floor(diffDays / 7))} هفته پیش`
  if (diffDays < 365) return `${toFaDigits(Math.floor(diffDays / 30))} ماه پیش`
  return `${toFaDigits(Math.floor(diffDays / 365))} سال پیش`
}

export function formatRelativeFromIso(iso: string, now = Date.now()): string {
  const date = isoToLocalDate(iso)
  if (!date) return iso
  return formatRelativeFa(date.getTime(), now)
}

function isoToLocalDate(iso: string): Date | null {
  const parts = parseIsoDate(iso)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day)
}

/** e.g. ۱۲ شهریور */
export function formatPersianDate(iso: string): string {
  const date = isoToLocalDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(date)
}

/** e.g. ۱ مهر ۱۴۰۵ */
export function formatPersianDateFull(iso: string): string {
  const date = isoToLocalDate(iso)
  if (!date) return iso
  return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
