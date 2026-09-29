import { describe, expect, it } from 'vitest'
import { computeBalance, incomeExpenseTotals } from '../lib/balance'
import { demoDataset } from '../db/seed'

describe('demo dataset', () => {
  it('keeps Sprint 1 displayed balances after double-entry + installment expenses', () => {
    const demo = demoDataset(new Date('2026-09-15T12:00:00').getTime())
    const wallet = demo.accounts.find((a) => a.id === 'acc_wallet')!
    const mellat = demo.accounts.find((a) => a.id === 'acc_mellat')!
    const home = demo.accounts.find((a) => a.id === 'acc_home')!
    expect(computeBalance(wallet.openingBalance, demo.transactions, wallet.id)).toBe(12_500_000)
    expect(computeBalance(mellat.openingBalance, demo.transactions, mellat.id)).toBe(84_200_000)
    expect(computeBalance(home.openingBalance, demo.transactions, home.id)).toBe(320_000_000)
    expect(demo.plans).toHaveLength(3)
    expect(demo.items).toHaveLength(12 + 12 + 6)
    const totals = incomeExpenseTotals(demo.transactions)
    expect(totals.income).toBe(185_000_000)
    expect(totals.expense).toBeGreaterThan(1_200_000)
    expect(demo.transactions.filter((t) => t.kind === 'transferOut')).toHaveLength(1)
    expect(demo.transactions.filter((t) => t.kind === 'transferIn')).toHaveLength(1)
  })
})
