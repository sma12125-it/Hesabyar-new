import { describe, expect, it } from 'vitest'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  getAccountBalance,
  getAccounts,
  getCategories,
  getReports,
  getTransactions,
  searchTransactions,
  updateTransaction,
  type AppData,
} from '../lib/business/hesabyarBusiness'
import type { Account, Transaction } from '../types'

function makeTestDataset(): AppData {
  const accounts: Account[] = [
    {
      id: 'acc-mellat',
      name: 'بانک ملت',
      type: 'bank',
      openingBalance: 10_000_000, // 10 million IRR (1 million Tomans)
      balance: 10_000_000,
      archived: false,
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'acc-melli',
      name: 'بانک ملی',
      type: 'bank',
      openingBalance: 5_000_000,
      balance: 5_000_000,
      archived: false,
      createdAt: 1001,
      updatedAt: 1001,
    },
  ]

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      kind: 'expense',
      amount: 2_000_000,
      accountId: 'acc-mellat',
      categoryId: 'food',
      note: 'خرید سوپرمارکت',
      date: '2026-03-01',
      createdAt: 2000,
    },
    {
      id: 'tx-2',
      kind: 'income',
      amount: 4_000_000,
      accountId: 'acc-mellat',
      categoryId: 'salary',
      note: 'واریز پاداش',
      date: '2026-03-02',
      createdAt: 2001,
    },
  ]

  return {
    accounts,
    transactions,
    plans: [],
    items: [],
  }
}

describe('Hesabyar Business Logic Layer', () => {
  it('1. getAccounts correctly computes balances for all accounts', () => {
    const data = makeTestDataset()
    const accounts = getAccounts(data)
    expect(accounts).toHaveLength(2)

    // Mellat: opening 10M - 2M expense + 4M income = 12M IRR = 1.2M Tomans
    const mellat = accounts.find((a) => a.id === 'acc-mellat')!
    expect(mellat.balance).toBe(12_000_000)
    expect(mellat.balanceToman).toBe(1_200_000)
  })

  it('2. getAccountBalance works by ID and by fuzzy Persian name (e.g. "ملت")', () => {
    const data = makeTestDataset()
    const byId = getAccountBalance(data, 'acc-mellat')
    expect(byId.account.balance).toBe(12_000_000)
    expect(byId.account.balanceToman).toBe(1_200_000)

    const byName = getAccountBalance(data, 'ملت')
    expect(byName.account.id).toBe('acc-mellat')
    expect(byName.account.name).toBe('بانک ملت')
    expect(byName.activeTransactionsCount).toBe(2)
  })

  it('3. getTransactions filters by account, category, kind, and date', () => {
    const data = makeTestDataset()
    const all = getTransactions(data)
    expect(all.total).toBe(2)

    const expensesOnly = getTransactions(data, { kind: 'expense' })
    expect(expensesOnly.total).toBe(1)
    expect(expensesOnly.transactions[0].id).toBe('tx-1')

    const foodOnly = getTransactions(data, { categoryId: 'food' })
    expect(foodOnly.total).toBe(1)
  })

  it('4. searchTransactions finds transactions by note or category', () => {
    const data = makeTestDataset()
    const results = searchTransactions(data, 'سوپرمارکت')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('tx-1')

    const empty = searchTransactions(data, 'چیزی که نیست')
    expect(empty).toHaveLength(0)
  })

  it('5. createTransaction supports Tomans (IRT) and dryRun preview', () => {
    const data = makeTestDataset()

    // DryRun (preview for ChatGPT confirmation)
    const dryRunResult = createTransaction(
      data,
      {
        account: 'بانک ملت',
        amount: 500_000, // 500,000 Tomans = 5,000,000 Rials
        currency: 'IRT',
        type: 'expense',
        category: 'خرید',
        description: 'خرید پوشاک',
      },
      { dryRun: true },
    )

    expect(dryRunResult.success).toBe(true)
    expect(dryRunResult.transaction.amount).toBe(5_000_000)
    expect(dryRunResult.transaction.amountToman).toBe(500_000)
    expect(dryRunResult.previewData?.balanceBefore).toBe(12_000_000)
    expect(dryRunResult.previewData?.balanceAfter).toBe(7_000_000)
    // Data remains untouched on dryRun
    expect(dryRunResult.nextData.transactions).toHaveLength(2)

    // Real Execution
    const realResult = createTransaction(data, {
      account: 'بانک ملت',
      amount: 500_000,
      currency: 'IRT',
      type: 'expense',
      category: 'خرید',
      description: 'خرید پوشاک',
    })

    expect(realResult.nextData.transactions).toHaveLength(3)
    const updatedAccounts = getAccounts(realResult.nextData)
    const updatedMellat = updatedAccounts.find((a) => a.id === 'acc-mellat')!
    expect(updatedMellat.balance).toBe(7_000_000)
  })

  it('5b. createTransaction rejects expense when balance is insufficient', () => {
    const data = makeTestDataset()
    expect(() =>
      createTransaction(data, {
        account: 'بانک ملت',
        amount: 20_000_000, // 20M > 12M available
        type: 'expense',
      }),
    ).toThrow('موجودی حساب کافی نیست')
  })

  it('6. updateTransaction edits transaction notes and amounts', () => {
    const data = makeTestDataset()
    const updated = updateTransaction(data, 'tx-1', {
      description: 'خرید سوپرمارکت زنجیره‌ای',
      amount: 3_000_000,
    })

    expect(updated.success).toBe(true)
    expect(updated.transaction.note).toBe('خرید سوپرمارکت زنجیره‌ای')
    expect(updated.transaction.amount).toBe(3_000_000)
  })

  it('7. deleteTransaction removes transaction and updates balance', () => {
    const data = makeTestDataset()
    const deleted = deleteTransaction(data, 'tx-1')
    expect(deleted.success).toBe(true)
    expect(deleted.nextData.transactions).toHaveLength(1)

    const accounts = getAccounts(deleted.nextData)
    const mellat = accounts.find((a) => a.id === 'acc-mellat')!
    // 10M opening + 4M income = 14M (expense of 2M removed)
    expect(mellat.balance).toBe(14_000_000)
  })

  it('8. createTransfer creates matching transferOut and transferIn legs', () => {
    const data = makeTestDataset()
    const transferResult = createTransfer(data, {
      fromAccount: 'بانک ملت',
      toAccount: 'بانک ملی',
      amount: 100_000, // 100,000 Tomans = 1,000,000 Rials
      currency: 'IRT',
      description: 'انتقال شتابی کارت به کارت',
    })

    expect(transferResult.success).toBe(true)
    expect(transferResult.outLeg.kind).toBe('transferOut')
    expect(transferResult.inLeg.kind).toBe('transferIn')
    expect(transferResult.outLeg.transferId).toBe(transferResult.inLeg.transferId)
    expect(transferResult.outLeg.amount).toBe(1_000_000)
    expect(transferResult.inLeg.amount).toBe(1_000_000)

    const accounts = getAccounts(transferResult.nextData)
    const mellat = accounts.find((a) => a.id === 'acc-mellat')!
    const melli = accounts.find((a) => a.id === 'acc-melli')!

    // Mellat: 12M - 1M = 11M
    expect(mellat.balance).toBe(11_000_000)
    // Melli: 5M + 1M = 6M
    expect(melli.balance).toBe(6_000_000)
  })

  it('9. getCategories returns all categories categorized by kind', () => {
    const cats = getCategories()
    expect(cats.expense.length).toBeGreaterThan(0)
    expect(cats.income.length).toBeGreaterThan(0)
    expect(cats.transfer.length).toBeGreaterThan(0)
    expect(cats.all.some((c) => c.id === 'food')).toBe(true)
  })

  it('10. getReports returns monthly series, income/expense totals, and assets', () => {
    const data = makeTestDataset()
    const report = getReports(data, { endIso: '2026-03-05' })
    expect(report.totalIncome.amountRial).toBe(4_000_000)
    expect(report.totalExpense.amountRial).toBe(2_000_000)
    expect(report.netSavings.amountRial).toBe(2_000_000)
    expect(report.totalAssets.amountRial).toBe(17_000_000) // 12M Mellat + 5M Melli
    expect(report.monthlyHistory.length).toBeGreaterThan(0)
  })
})
