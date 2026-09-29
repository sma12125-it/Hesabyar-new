import { describe, expect, it } from 'vitest'
import { parseVoiceCommand } from '../lib/voice'
import { expenseByCategory, monthlySeries } from '../lib/reports'
import type { Transaction } from '../types'

const tx = (kind: Transaction['kind'], amount: number, date: string, categoryId = 'food'): Transaction => ({
  id: `${kind}-${date}-${amount}`,
  kind,
  amount,
  accountId: 'a',
  categoryId,
  note: '',
  date,
  createdAt: 1,
})

describe('voice and reports', () => {
  it('parses a Persian expense amount', () => {
    expect(parseVoiceCommand('هزینه ۵۰ هزار خوراک')).toMatchObject({ kind: 'expense', amount: 50_000 })
    expect(parseVoiceCommand('درآمد ۲ میلیون حقوق')?.kind).toBe('income')
  })

  it('sums expenses of the current Jalali month by category', () => {
    const rows = [tx('expense', 1000, '2026-09-15', 'food'), tx('income', 5000, '2026-09-15', 'salary')]
    const month = '1405-06'
    expect(expenseByCategory(rows, month)).toEqual([{ id: 'food', name: 'خوراک و سوپرمارکت', amount: 1000 }])
    expect(monthlySeries(rows, '2026-09-15').some((point) => point.expense === 1000)).toBe(true)
  })
})