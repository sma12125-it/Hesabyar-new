import type { Category, Transaction } from '../types'

export const INSTALLMENT_CATEGORY_ID = 'installments' as const

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'خوراک و سوپرمارکت', icon: '🛒', kind: 'expense' },
  { id: 'transport', name: 'حمل‌ونقل', icon: '⛽', kind: 'expense' },
  { id: 'bills', name: 'قبوض', icon: '🧾', kind: 'expense' },
  { id: 'shopping', name: 'خرید', icon: '🛍️', kind: 'expense' },
  { id: 'health', name: 'سلامت', icon: '💊', kind: 'expense' },
  { id: INSTALLMENT_CATEGORY_ID, name: 'اقساط', icon: '📅', kind: 'expense' },
  { id: 'other-exp', name: 'سایر', icon: '📦', kind: 'expense' },
  { id: 'salary', name: 'حقوق', icon: '💼', kind: 'income' },
  { id: 'gift', name: 'هدیه', icon: '🎁', kind: 'income' },
  { id: 'sale', name: 'فروش', icon: '🏷️', kind: 'income' },
  { id: 'other-inc', name: 'سایر', icon: '💰', kind: 'income' },
  { id: 'transfer', name: 'انتقال', icon: '⇄', kind: 'transfer' },
]

/** Builtins that must never be deleted. «اقساط» and both «سایر» plus every system default. */
export const PROTECTED_CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id))

export const OTHER_CATEGORY_ID = {
  expense: 'other-exp',
  income: 'other-inc',
} as const

export function isProtectedCategory(id: string): boolean {
  return PROTECTED_CATEGORY_IDS.has(id)
}

export function categoriesFor(kind: 'expense' | 'income', custom: Category[] = []): Category[] {
  const extras = custom.filter((c) => c.kind === kind && !isProtectedCategory(c.id))
  return [...CATEGORIES.filter((c) => c.kind === kind), ...extras]
}

export function getCategory(id: string, custom: Category[] = []): Category | undefined {
  return CATEGORIES.find((c) => c.id === id) ?? custom.find((c) => c.id === id)
}

export function fallbackCategoryId(kind: 'expense' | 'income'): string {
  return OTHER_CATEGORY_ID[kind]
}

export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'نام دسته الزامی است'
  if (trimmed.length > 24) return 'نام دسته خیلی طولانی است'
  return null
}

export function transactionsAfterCategoryDelete(
  transactions: Transaction[],
  categoryId: string,
  kind: 'expense' | 'income',
): Transaction[] {
  const fallback = fallbackCategoryId(kind)
  return transactions.map((tx) => (tx.categoryId === categoryId ? { ...tx, categoryId: fallback } : tx))
}

export function accountIcon(type: 'cash' | 'bank', name: string): string {
  if (type === 'cash') return '💵'
  if (name.includes('پس‌انداز') || name.includes('مسکن')) return '🏠'
  return '🏦'
}
