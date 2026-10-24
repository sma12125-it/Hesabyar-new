import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sortTransactions } from '../db/db'
import type { Transaction } from '../types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    kind: 'expense',
    amount: 1,
    accountId: 'a',
    categoryId: 'food',
    note: '',
    date: '2026-01-01',
    createdAt: 1,
    ...partial,
  }
}

describe('boot resilience', () => {
  it('sorts legacy rows that are missing a date', () => {
    const rows = [
      tx({ id: 'new', date: '2026-02-01', createdAt: 2 }),
      tx({ id: 'blank', date: undefined as unknown as string, createdAt: 3 }),
      tx({ id: 'old', date: '2026-01-01', createdAt: 1 }),
    ]
    expect(sortTransactions(rows).map((row) => row.id)).toEqual(['new', 'old', 'blank'])
  })

  it('serves navigations network-first and retires old caches', () => {
    const source = readFileSync('public/sw.js', 'utf8')
    expect(source).toContain("const CACHE = 'hesabyar-v4'")
    expect(source).toContain('skipWaiting')
    expect(source).toContain('clients.claim')
    expect(source).toContain('caches.delete')
    expect(source).toContain("request.mode === 'navigate'")
    expect(source).toContain("cache: 'reload'")
    expect(source).toContain('index.html')
  })
})
