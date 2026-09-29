import { describe, expect, it } from 'vitest'
import { buildLoanSchedule } from '../lib/loan'

describe('loan amortization', () => {
  it('splits a zero-rate principal evenly with leftover Rials on the last payment', () => {
    const schedule = buildLoanSchedule(10_000_000, 0, 3)
    expect(schedule.amounts).toEqual([3_333_333, 3_333_333, 3_333_334])
    expect(schedule.totalInterest).toBe(0)
    expect(schedule.totalRepayment).toBe(10_000_000)
    expect(schedule.amounts.reduce((sum, n) => sum + n, 0)).toBe(schedule.principal)
  })

  it('uses declining-balance equal installments and puts rounding on the last payment', () => {
    const principal = 12_000_000
    const rate = 18
    const months = 12
    const schedule = buildLoanSchedule(principal, rate, months)
    const i = rate / 100 / 12
    const factor = (1 + i) ** months
    const exact = (principal * i * factor) / (factor - 1)
    expect(schedule.monthlyPayment).toBe(Math.round(exact))
    expect(schedule.amounts).toHaveLength(months)
    expect(schedule.amounts.slice(0, -1).every((n) => n === schedule.monthlyPayment || n === schedule.monthlyPayment - 1 || n === schedule.monthlyPayment + 1)).toBe(true)
    expect(schedule.totalRepayment).toBe(schedule.amounts.reduce((sum, n) => sum + n, 0))
    expect(schedule.totalRepayment).toBe(principal + schedule.totalInterest)
    expect(schedule.totalInterest).toBeGreaterThan(0)
    const last = schedule.amounts[months - 1]!
    expect(last).toBeGreaterThan(0)
  })

  it('rejects invalid principal, term, or rate', () => {
    expect(() => buildLoanSchedule(0, 18, 12)).toThrow('مبلغ اصل وام نامعتبر است')
    expect(() => buildLoanSchedule(1_000, 18, 0)).toThrow('تعداد اقساط باید حداقل ۱ باشد')
    expect(() => buildLoanSchedule(1_000, -1, 12)).toThrow('نرخ سود نامعتبر است')
    expect(() => buildLoanSchedule(1_000, 101, 12)).toThrow('نرخ سود نامعتبر است')
  })
})
