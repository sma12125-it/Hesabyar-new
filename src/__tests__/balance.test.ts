import { describe, expect, it } from 'vitest'
import { computeBalance, deriveOpeningBalance, incomeExpenseTotals, transactionDelta } from '../lib/balance'
import { todayIso } from '../lib/iso'
import { validateTransfer } from '../lib/transfer'
import type { Account, Transaction, TransferInput } from '../types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'amount' | 'accountId'>): Transaction {
  return {
    categoryId: 'food',
    note: '',
    date: '2026-09-15',
    createdAt: 1,
    ...partial,
  }
}

const from: Account = {
  id: 'a',
  name: 'ملت',
  type: 'bank',
  archived: false,
  openingBalance: 100_000,
  balance: 100_000,
  createdAt: 1,
  updatedAt: 1,
}
const to: Account = { ...from, id: 'b', name: 'مسکن', openingBalance: 10_000, balance: 10_000 }

describe('balance formula', () => {
  it('computes opening + income − expense − transferOut + transferIn', () => {
    const txs: Transaction[] = [
      tx({ id: '1', kind: 'income', amount: 50, accountId: 'a', categoryId: 'salary' }),
      tx({ id: '2', kind: 'expense', amount: 20, accountId: 'a' }),
      tx({ id: '3', kind: 'transferOut', amount: 10, accountId: 'a', transferId: 'tr1' }),
      tx({ id: '4', kind: 'transferIn', amount: 5, accountId: 'a', transferId: 'tr2' }),
    ]
    expect(computeBalance(100, txs, 'a')).toBe(125)
  })

  it('does not count transfers in income/expense totals', () => {
    const txs: Transaction[] = [
      tx({ id: '1', kind: 'income', amount: 80, accountId: 'a', categoryId: 'salary' }),
      tx({ id: '2', kind: 'expense', amount: 30, accountId: 'a' }),
      tx({ id: '3', kind: 'transferOut', amount: 10, accountId: 'a', transferId: 'tr1' }),
      tx({ id: '4', kind: 'transferIn', amount: 10, accountId: 'b', transferId: 'tr1' }),
    ]
    expect(incomeExpenseTotals(txs)).toEqual({ income: 80, expense: 30 })
  })

  it('treats a legacy single-leg transfer as outflow on source and inflow on destination', () => {
    const legacy = tx({
      id: 't',
      kind: 'transferOut',
      amount: 7,
      accountId: 'a',
      counterpartyAccountId: 'b',
    })
    const old = { ...legacy, kind: 'transfer' as unknown as Transaction['kind'] }
    expect(transactionDelta(old, 'a')).toBe(-7)
    expect(transactionDelta(old, 'b')).toBe(7)
  })

  it('derives opening so a stored Sprint 1 balance stays the same', () => {
    const txs: Transaction[] = [tx({ id: '1', kind: 'expense', amount: 450_000, accountId: 'w' })]
    expect(deriveOpeningBalance(12_500_000, txs, 'w')).toBe(12_950_000)
    expect(computeBalance(12_950_000, txs, 'w')).toBe(12_500_000)
  })
})

describe('validateTransfer', () => {
  const base: TransferInput = {
    amount: 40_000,
    fromAccountId: 'a',
    toAccountId: 'b',
    note: '',
    date: todayIso(),
  }

  it('rejects amount greater than source balance', () => {
    expect(validateTransfer({ ...base, amount: 100_001 }, [from, to])).toBe(
      'مبلغ از موجودی قابل انتقال بیشتر است',
    )
  })

  it('rejects same from/to and archived accounts', () => {
    expect(validateTransfer({ ...base, toAccountId: 'a' }, [from, to])).toBe('مبدأ و مقصد باید متفاوت باشند')
    expect(validateTransfer(base, [{ ...from, archived: true }, to])).toBe('حساب مبدأ معتبر نیست')
    expect(validateTransfer(base, [from, { ...to, archived: true }])).toBe('حساب مقصد معتبر نیست')
  })

  it('accepts a valid transfer', () => {
    expect(validateTransfer(base, [from, to])).toBeNull()
  })

  it('accepts transferring the exact source balance and still rejects archived / same-account', () => {
    expect(validateTransfer({ ...base, amount: 100_000 }, [from, to])).toBeNull()
    expect(validateTransfer({ ...base, amount: 100_001 }, [from, to])).toBe(
      'مبلغ از موجودی قابل انتقال بیشتر است',
    )
  })
})
