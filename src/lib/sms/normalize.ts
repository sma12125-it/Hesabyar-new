import { toWesternDigits } from '../money'
import type { SmsCurrency } from './types'

const MAX_DIGITS = 15

/** Persian and Arabic-Indic digits become 0-9, and digit group separators are removed. */
export function normalizeSmsText(raw: string): string {
  const western = toWesternDigits(raw).replace(/[\u200c\u200f\u200e]/g, ' ')
  return western
    .replace(/(\d)[,\u066C\u060C\u00A0]+(?=\d)/g, '$1')
    .replace(/(\d)[ \t]+(?=\d)/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function parseIntegerToken(digits: string): number | null {
  if (!/^\d+$/.test(digits) || digits.length === 0 || digits.length > MAX_DIGITS) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

/** Explicit conversion. تومان becomes rial × 10. A missing unit returns null. */
export function toRial(amount: number, currency: SmsCurrency | null): number | null {
  if (currency == null) return null
  if (!Number.isSafeInteger(amount) || amount < 0) return null
  if (currency === 'IRR') return amount
  if (amount > Math.floor(Number.MAX_SAFE_INTEGER / 10)) return null
  return amount * 10
}

export function currencyFromUnit(token: string | undefined): SmsCurrency | null {
  if (token === 'ریال') return 'IRR'
  if (token === 'تومان' || token === 'تومن') return 'IRT'
  return null
}
