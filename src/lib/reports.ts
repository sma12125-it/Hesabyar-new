import { getCategory } from './categories'
import { isoToJalali } from './jalaali'
import type { Category, Transaction } from '../types'

export interface MonthPoint {
  label: string
  income: number
  expense: number
}

export interface CategoryBar {
  id: string
  name: string
  amount: number
}

export function monthKey(iso: string): string | null {
  const j = isoToJalali(iso)
  if (!j) return null
  return `${j.jy}-${String(j.jm).padStart(2, '0')}`
}

export function lastJalaliMonths(endIso: string, count = 6): string[] {
  const end = isoToJalali(endIso)
  if (!end) return []
  const keys: string[] = []
  let y = end.jy
  let m = end.jm
  for (let i = 0; i < count; i += 1) {
    keys.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return keys
}

export function monthlySeries(transactions: Transaction[], endIso: string): MonthPoint[] {
  const keys = lastJalaliMonths(endIso, 6)
  return keys.map((key) => {
    let income = 0
    let expense = 0
    for (const tx of transactions) {
      if (monthKey(tx.date) !== key) continue
      if (tx.kind === 'income') income += tx.amount
      if (tx.kind === 'expense') expense += tx.amount
    }
    const [, month] = key.split('-')
    return { label: month ?? key, income, expense }
  })
}

export function expenseByCategory(
  transactions: Transaction[],
  month: string,
  custom: Category[] = [],
): CategoryBar[] {
  const totals = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || monthKey(tx.date) !== month) continue
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount)
  }
  return [...totals.entries()]
    .map(([id, amount]) => ({ id, name: getCategory(id, custom)?.name ?? 'سایر', amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function monthTotals(transactions: Transaction[], month: string): { income: number; expense: number; net: number } {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    if (monthKey(tx.date) !== month) continue
    if (tx.kind === 'income') income += tx.amount
    if (tx.kind === 'expense') expense += tx.amount
  }
  return { income, expense, net: income - expense }
}

export function spentInCategory(transactions: Transaction[], month: string, categoryId: string): number {
  return transactions.reduce((sum, tx) => {
    if (tx.kind === 'expense' && tx.categoryId === categoryId && monthKey(tx.date) === month) return sum + tx.amount
    return sum
  }, 0)
}
