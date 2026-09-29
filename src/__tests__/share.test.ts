import { describe, expect, it } from 'vitest'
import { mergeShare, type ShareAccount } from '../lib/share'
import type { Transaction } from '../types'

const account: ShareAccount = {
  id: 'acc',
  name: 'کارت مشترک',
  type: 'bank',
  openingBalance: 0,
  archived: false,
  createdAt: 1,
  updatedAt: 10,
}

function tx(id: string, amount: number, updatedAt: number, actorEmail: string): Transaction {
  return {
    id,
    kind: 'expense',
    amount,
    accountId: 'acc',
    categoryId: 'food',
    note: '',
    date: '2026-01-01',
    createdAt: updatedAt,
    updatedAt,
    actorEmail,
  }
}

describe('mergeShare', () => {
  it('keeps both users’ transactions and the newer edit', () => {
    const remote = mergeShare(null, {
      account,
      transactions: [tx('a', 100, 10, 'owner@example.com')],
      deletedIds: [],
    })
    const merged = mergeShare(remote, {
      account: { ...account, updatedAt: 5 },
      transactions: [tx('a', 250, 20, 'owner@example.com'), tx('b', 40, 15, 'guest@example.com')],
      deletedIds: [],
    })
    expect(merged.transactions.map((row) => row.id).sort()).toEqual(['a', 'b'])
    expect(merged.transactions.find((row) => row.id === 'a')?.amount).toBe(250)
    expect(merged.account.name).toBe('کارت مشترک')
  })

  it('drops a transaction deleted on one side', () => {
    const remote = mergeShare(null, {
      account,
      transactions: [tx('a', 100, 10, 'owner@example.com'), tx('b', 40, 12, 'guest@example.com')],
      deletedIds: [],
    })
    const merged = mergeShare(remote, {
      account,
      transactions: [tx('b', 40, 12, 'guest@example.com')],
      deletedIds: ['a'],
    })
    expect(merged.transactions.map((row) => row.id)).toEqual(['b'])
    expect(merged.deletedIds).toContain('a')
  })
})
