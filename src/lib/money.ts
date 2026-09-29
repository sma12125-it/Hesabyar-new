import type { TxKind } from '../types'

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d)
}

/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits become 0-9. English digits stay. */
export function toWesternDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
}

export function digitsOnly(raw: string): string {
  return toWesternDigits(raw).replace(/\D/g, '')
}

export function parseRialInput(raw: string): number {
  const western = digitsOnly(raw)
  if (!western) return 0
  const n = Number(western)
  return Number.isFinite(n) ? n : 0
}

/** Short Rial label for dashboard cards: ۱۲٫۴ میلیون، or the full grouped amount. */
export function formatCompactRial(amount: number): string {
  const abs = Math.abs(Math.trunc(amount))
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}${compactDigits(abs / 1_000_000_000)} میلیارد`
  if (abs >= 1_000_000) return `${sign}${compactDigits(abs / 1_000_000)} میلیون`
  return `${sign}${formatRial(abs)}`
}

function compactDigits(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return toFaDigits(text).replace('.', '\u066b')
}

/** Grouped Persian digits, no sign. Amounts are Rial-only. */
export function formatRial(amount: number): string {
  const abs = Math.abs(Math.trunc(amount))
  return abs.toLocaleString('fa-IR')
}

/** Masked input value: grouped Persian digits, empty when the amount is 0. */
export function formatRialInput(amount: number): string {
  if (!Number.isFinite(amount) || Math.trunc(amount) === 0) return ''
  return formatRial(amount)
}

/** Parse then re-format so typing always shows thousand separators. */
export function maskRialInput(raw: string): string {
  return formatRialInput(parseRialInput(raw))
}

function isRialDigit(ch: string): boolean {
  return (ch >= '0' && ch <= '9') || (ch >= '۰' && ch <= '۹') || (ch >= '٠' && ch <= '٩')
}

export function countRialDigits(value: string): number {
  let n = 0
  for (const ch of value) {
    if (isRialDigit(ch)) n++
  }
  return n
}

/** Best-effort caret index after remasking, given how many digits sat before the caret. */
export function caretFromRialDigitCount(display: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0
  let n = 0
  for (let i = 0; i < display.length; i++) {
    if (isRialDigit(display[i]!)) {
      n++
      if (n >= digitsBefore) return i + 1
    }
  }
  return display.length
}

export function applySignedBalance(
  balance: number,
  kind: TxKind | 'transfer',
  amount: number,
  direction: 'out' | 'in' = 'out',
): number {
  if (kind === 'income' || kind === 'transferIn' || (kind === 'transfer' && direction === 'in')) {
    return balance + amount
  }
  return balance - amount
}

export function validateAccountName(name: string): string | null {
  if (!name.trim()) return 'نام حساب الزامی است'
  if (name.trim().length > 48) return 'نام حساب خیلی طولانی است'
  return null
}

export function validateAmount(amount: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'مبلغ باید بیشتر از صفر باشد'
  return null
}

export function validateExpenseBalance(amount: number, available: number): string | null {
  if (amount > available) return 'موجودی حساب کافی نیست'
  return null
}

/** Expense/transfer room on an account, crediting back a tx that is being replaced. */
export function availableAfterReplacing(
  balance: number,
  replacing: { kind: string; amount: number; accountId: string } | null,
  nextAccountId: string,
): number {
  if (!replacing || replacing.accountId !== nextAccountId) return balance
  if (replacing.kind === 'expense' || replacing.kind === 'transferOut') return balance + replacing.amount
  if (replacing.kind === 'income' || replacing.kind === 'transferIn') return balance - replacing.amount
  return balance
}

/** Decimal parser for interest rates (Persian digits and ٫ allowed). */
export function parseDecimalInput(raw: string): number {
  const western = toWesternDigits(raw)
    .replace(/٫/g, '.')
    .replace(/[^\d.]/g, '')
  if (!western) return 0
  const n = Number(western)
  return Number.isFinite(n) ? n : 0
}
