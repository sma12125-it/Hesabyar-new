import { describe, expect, it } from 'vitest'
import { computeBalance } from '../lib/balance'
import {
  deleteAccountCascade,
  deleteInstallmentItemCascade,
  deletePlanCascade,
  deleteTransactionCascade,
  unpayInstallmentItem,
} from '../lib/cascade'
import { generateInstallmentItems } from '../lib/installments'
import type { Account, InstallmentPlan, Transaction } from '../types'

function account(partial: Partial<Account> & Pick<Account, 'id' | 'name' | 'openingBalance'>): Account {
  return {
    type: 'bank',
    archived: false,
    balance: partial.openingBalance,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'kind' | 'amount' | 'accountId'>): Transaction {
  return {
    categoryId: 'food',
    note: '',
    date: '2026-09-15',
    createdAt: 1,
    ...partial,
  }
}

const from = account({ id: 'a', name: 'ملت', openingBalance: 100_000, balance: 60_000 })
const to = account({ id: 'b', name: 'مسکن', openingBalance: 10_000, balance: 50_000 })

const outTx = tx({
  id: 'out',
  kind: 'transferOut',
  amount: 40_000,
  accountId: 'a',
  counterpartyAccountId: 'b',
  transferId: 'tr1',
  categoryId: 'transfer',
})
const inTx = tx({
  id: 'in',
  kind: 'transferIn',
  amount: 40_000,
  accountId: 'b',
  counterpartyAccountId: 'a',
  transferId: 'tr1',
  categoryId: 'transfer',
  createdAt: 2,
})

describe('delete cascading', () => {
  it('removes both transfer legs and restores both balances', () => {
    const data = {
      accounts: [from, to],
      transactions: [outTx, inTx],
      plans: [],
      items: [],
    }
    expect(computeBalance(from.openingBalance, data.transactions, 'a')).toBe(60_000)
    const next = deleteTransactionCascade('out', data)
    expect(next.transactions).toHaveLength(0)
    expect(computeBalance(from.openingBalance, next.transactions, 'a')).toBe(100_000)
    expect(computeBalance(to.openingBalance, next.transactions, 'b')).toBe(10_000)
  })

  it('rejects missing ids', () => {
    const empty = { accounts: [from], transactions: [], plans: [], items: [] }
    expect(() => deleteTransactionCascade('nope', empty)).toThrow('تراکنش پیدا نشد')
    expect(() => deleteAccountCascade('nope', empty)).toThrow('حساب پیدا نشد')
  })

  it('unpays a linked installment when the payment expense is deleted, keeping the slot', () => {
    const plan: InstallmentPlan = {
      id: 'p',
      name: 'وام',
      installmentAmount: 5_000,
      totalCount: 2,
      startDate: '2026-09-15',
      defaultAccountId: 'a',
      categoryId: 'installments',
      status: 'completed',
      createdAt: 1,
      updatedAt: 1,
    }
    const items = generateInstallmentItems('p', 5_000, 2, '2026-09-15')
    const expense = tx({
      id: 'pay',
      kind: 'expense',
      amount: 5_000,
      accountId: 'a',
      categoryId: 'installments',
      installmentItemId: items[0]!.id,
    })
    items[0]!.status = 'paid'
    items[0]!.transactionId = expense.id
    items[0]!.paidAt = '2026-09-15'
    items[1]!.status = 'paid'
    items[1]!.transactionId = 'pay2'
    const data = {
      accounts: [from],
      transactions: [expense],
      plans: [plan],
      items,
    }
    const next = deleteTransactionCascade('pay', data, '2026-09-15')
    const unpaid = next.items.find((i) => i.id === items[0]!.id)!
    expect(unpaid.status).toBe('pending')
    expect(unpaid.transactionId).toBeUndefined()
    expect(next.plans[0]?.status).toBe('active')
    expect(next.items).toHaveLength(2)
    expect(computeBalance(from.openingBalance, next.transactions, 'a')).toBe(100_000)
  })

  it('unpaying a finished plan returns the installment and moves the plan back to active', () => {
    const plan: InstallmentPlan = {
      id: 'p',
      name: 'وام',
      installmentAmount: 5_000,
      totalCount: 1,
      startDate: '2026-09-15',
      defaultAccountId: 'a',
      categoryId: 'installments',
      status: 'completed',
      createdAt: 1,
      updatedAt: 1,
    }
    const items = generateInstallmentItems('p', 5_000, 1, '2026-09-15')
    const expense = tx({
      id: 'pay',
      kind: 'expense',
      amount: 5_000,
      accountId: 'a',
      categoryId: 'installments',
      installmentItemId: items[0]!.id,
    })
    items[0]!.status = 'paid'
    items[0]!.transactionId = expense.id
    items[0]!.paidAt = '2026-09-15'
    const data = {
      accounts: [from],
      transactions: [expense],
      plans: [plan],
      items,
    }
    const next = unpayInstallmentItem(items[0]!.id, data, '2026-09-15')
    expect(next.items[0]?.status).toBe('pending')
    expect(next.items[0]?.transactionId).toBeUndefined()
    expect(next.transactions).toHaveLength(0)
    expect(next.plans[0]?.status).toBe('active')
    expect(computeBalance(from.openingBalance, next.transactions, 'a')).toBe(100_000)
  })

  it('deleting a paid installment item removes the expense and the slot, then reindexes', () => {
    const plan: InstallmentPlan = {
      id: 'p',
      name: 'وام',
      installmentAmount: 5_000,
      totalCount: 2,
      startDate: '2026-09-15',
      defaultAccountId: 'a',
      categoryId: 'installments',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    }
    const items = generateInstallmentItems('p', 5_000, 2, '2026-09-15')
    const expense = tx({
      id: 'pay',
      kind: 'expense',
      amount: 5_000,
      accountId: 'a',
      categoryId: 'installments',
      installmentItemId: items[0]!.id,
    })
    items[0]!.status = 'paid'
    items[0]!.transactionId = expense.id
    const data = {
      accounts: [from],
      transactions: [expense],
      plans: [plan],
      items,
    }
    const next = deleteInstallmentItemCascade(items[0]!.id, data, '2026-09-15')
    expect(next.transactions).toHaveLength(0)
    expect(next.items).toHaveLength(1)
    expect(next.items[0]?.index).toBe(1)
    expect(next.items[0]?.id).toBe(items[1]!.id)
    expect(next.plans[0]?.totalCount).toBe(1)
    expect(computeBalance(from.openingBalance, next.transactions, 'a')).toBe(100_000)
  })

  it('deleting a plan removes linked payment expenses', () => {
    const plan: InstallmentPlan = {
      id: 'p',
      name: 'وام',
      installmentAmount: 5_000,
      totalCount: 1,
      startDate: '2026-09-15',
      defaultAccountId: 'a',
      categoryId: 'installments',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    }
    const items = generateInstallmentItems('p', 5_000, 1, '2026-09-15')
    const expense = tx({
      id: 'pay',
      kind: 'expense',
      amount: 5_000,
      accountId: 'a',
      categoryId: 'installments',
      installmentItemId: items[0]!.id,
    })
    items[0]!.status = 'paid'
    items[0]!.transactionId = expense.id
    const next = deletePlanCascade('p', {
      accounts: [from],
      transactions: [expense],
      plans: [plan],
      items,
    })
    expect(next.plans).toHaveLength(0)
    expect(next.items).toHaveLength(0)
    expect(next.transactions).toHaveLength(0)
  })

  it('deleting an account drops its txs and the other transfer leg', () => {
    const next = deleteAccountCascade('a', {
      accounts: [from, to],
      transactions: [outTx, inTx],
      plans: [],
      items: [],
    })
    expect(next.accounts.map((a) => a.id)).toEqual(['b'])
    expect(next.transactions).toHaveLength(0)
    expect(computeBalance(to.openingBalance, next.transactions, 'b')).toBe(10_000)
  })
})
