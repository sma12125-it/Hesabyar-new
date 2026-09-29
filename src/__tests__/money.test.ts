import { describe, expect, it } from 'vitest'
import {
  availableAfterReplacing,
  caretFromRialDigitCount,
  countRialDigits,
  formatCompactRial,
  formatRial,
  formatRialInput,
  maskRialInput,
  parseDecimalInput,
  parseRialInput,
  toFaDigits,
  validateAccountName,
  validateAmount,
  validateExpenseBalance,
} from '../lib/money'

describe('rial formatting', () => {
  it('formats grouped Persian digits without a sign', () => {
    expect(formatRial(416_700_000)).toBe((416_700_000).toLocaleString('fa-IR'))
    expect(formatRial(-450_000)).toBe((450_000).toLocaleString('fa-IR'))
  })

  it('compacts large rial amounts for the dashboard', () => {
    expect(formatCompactRial(86_400_000)).toBe('۸۶\u066b۴ میلیون')
    expect(formatCompactRial(52_000_000)).toBe('۵۲ میلیون')
    expect(formatCompactRial(12_500)).toBe(formatRial(12_500))
  })

  it('parses Persian and Western digit input', () => {
    expect(parseRialInput('۴۵۰٬۰۰۰')).toBe(450_000)
    expect(parseRialInput(String.fromCharCode(0x0661, 0x0668, 0x0665))).toBe(185)
    expect(parseRialInput('185000000')).toBe(185_000_000)
    expect(parseRialInput('')).toBe(0)
  })

  it('round-trips grouped separators and Persian digits', () => {
    const n = 1_200_000
    expect(formatRial(n)).toBe('۱٬۲۰۰٬۰۰۰')
    expect(formatRialInput(n)).toBe('۱٬۲۰۰٬۰۰۰')
    expect(formatRialInput(0)).toBe('')
    expect(parseRialInput(formatRial(n))).toBe(n)
    expect(parseRialInput('۱٬۲۰۰٬۰۰۰')).toBe(n)
    expect(parseRialInput('1,200,000')).toBe(n)
    expect(parseRialInput('۱۲۰۰۰۰۰')).toBe(n)
    expect(maskRialInput('1200000')).toBe('۱٬۲۰۰٬۰۰۰')
    expect(maskRialInput('۱٬۲۰۰٬۰۰۰')).toBe('۱٬۲۰۰٬۰۰۰')
    expect(maskRialInput('۴۵۰٬۰۰۰x')).toBe(formatRial(450_000))
    expect(maskRialInput('')).toBe('')
  })

  it('masks live typing with thousand separators', () => {
    let typed = ''
    for (const ch of '1200000') {
      typed = maskRialInput(typed + ch)
    }
    expect(typed).toBe('۱٬۲۰۰٬۰۰۰')
    expect(parseRialInput(typed)).toBe(1_200_000)

    let fa = ''
    for (const ch of '۴۵۰۰۰۰') {
      fa = maskRialInput(fa + ch)
    }
    expect(fa).toBe('۴۵۰٬۰۰۰')
    expect(parseRialInput(fa)).toBe(450_000)
  })

  it('keeps caret after the same digit count when separators appear', () => {
    const display = maskRialInput('1200')
    expect(display).toBe('۱٬۲۰۰')
    expect(countRialDigits(display)).toBe(4)
    expect(caretFromRialDigitCount(display, 4)).toBe(display.length)
    expect(caretFromRialDigitCount(display, 1)).toBe(1)
    expect(caretFromRialDigitCount(display, 2)).toBe(3)
    expect(caretFromRialDigitCount('', 0)).toBe(0)
  })

  it('validates account name and amount', () => {
    expect(validateAccountName('  ')).toBe('نام حساب الزامی است')
    expect(validateAccountName('کیف پول')).toBeNull()
    expect(validateAmount(0)).toBe('مبلغ باید بیشتر از صفر باشد')
    expect(validateAmount(450_000)).toBeNull()
  })

  it('parses decimal rates and credits back a replaced expense', () => {
    expect(parseDecimalInput('۱۸٫۵')).toBe(18.5)
    expect(validateExpenseBalance(200, 100)).toBe('موجودی حساب کافی نیست')
    expect(availableAfterReplacing(60_000, { kind: 'expense', amount: 40_000, accountId: 'a' }, 'a')).toBe(100_000)
  })

  it('converts western digits to Persian', () => {
    expect(toFaDigits('941')).toBe('۹۴۱')
  })
})
