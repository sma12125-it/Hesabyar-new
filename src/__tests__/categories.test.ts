import { describe, expect, it } from 'vitest'
import {
  INSTALLMENT_CATEGORY_ID,
  isProtectedCategory,
  transactionsAfterCategoryDelete,
} from '../lib/categories'
import type { Transaction } from '../types'

const tx = (categoryId: string, kind: Transaction['kind'] = 'expense'): Transaction => ({
  id: categoryId,
  kind,
  amount: 1,
  accountId: 'a',
  categoryId,
  note: '',
  date: '2026-09-15',
  createdAt: 1,
})

describe('custom category protection', () => {
  it('protects installments, سایر, and every builtin', () => {
    expect(isProtectedCategory(INSTALLMENT_CATEGORY_ID)).toBe(true)
    expect(isProtectedCategory('other-exp')).toBe(true)
    expect(isProtectedCategory('other-inc')).toBe(true)
    expect(isProtectedCategory('food')).toBe(true)
    expect(isProtectedCategory('cat_custom')).toBe(false)
  })

  it('moves transactions of a deleted custom category to سایر of the same kind', () => {
    const rows = [tx('cat_trip'), tx('food'), tx('cat_bonus', 'income')]
    expect(transactionsAfterCategoryDelete(rows, 'cat_trip', 'expense').map((row) => row.categoryId)).toEqual([
      'other-exp',
      'food',
      'cat_bonus',
    ])
    expect(transactionsAfterCategoryDelete(rows, 'cat_bonus', 'income').map((row) => row.categoryId)).toEqual([
      'cat_trip',
      'food',
      'other-inc',
    ])
  })
})
