/** Local calendar YYYY-MM-DD (not UTC). */

export function todayIso(now = new Date()): string {
  return isoFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function isoFromTimestamp(ts: number): string {
  return todayIso(new Date(ts))
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export function isValidIsoDate(iso: string): boolean {
  const parts = parseIsoDate(iso)
  if (!parts) return false
  const { year, month, day } = parts
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const parts = parseIsoDate(isoDate)
  if (!parts) throw new Error('تاریخ نامعتبر است')
  const totalMonths = parts.year * 12 + (parts.month - 1) + months
  const year = Math.floor(totalMonths / 12)
  const monthIndex = ((totalMonths % 12) + 12) % 12
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const day = Math.min(parts.day, lastDay)
  return isoFromParts(year, monthIndex + 1, day)
}

export function addDaysIso(iso: string, days: number): string {
  const parts = parseIsoDate(iso)
  if (!parts) throw new Error('تاریخ نامعتبر است')
  const dt = new Date(parts.year, parts.month - 1, parts.day + days)
  return todayIso(dt)
}

export function compareIso(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function daysUntil(iso: string, today: string): number {
  const a = parseIsoDate(iso)
  const b = parseIsoDate(today)
  if (!a || !b) return 0
  const ms = Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)
  return Math.round(ms / 86_400_000)
}
