import { hydrateAccounts } from './balance'
import { itemEffectiveStatus } from './installments'
import { todayIso } from './iso'
import type { Account, InstallmentItem, InstallmentPlan, Transaction } from '../types'

export interface AppData {
  accounts: Account[]
  transactions: Transaction[]
  plans: InstallmentPlan[]
  items: InstallmentItem[]
}

function rebalance(data: AppData): AppData {
  return {
    ...data,
    accounts: hydrateAccounts(data.accounts, data.transactions),
  }
}

function transferIdsToRemove(tx: Transaction, transactions: Transaction[]): Set<string> {
  const ids = new Set<string>([tx.id])
  if (!tx.transferId) return ids
  for (const row of transactions) {
    if (row.transferId === tx.transferId) ids.add(row.id)
  }
  return ids
}

function unpayItemsForRemovedTxs(
  items: InstallmentItem[],
  plans: InstallmentPlan[],
  removedTxIds: Set<string>,
  today: string,
): { items: InstallmentItem[]; plans: InstallmentPlan[] } {
  const nextItems = items.map((item) => {
    if (item.transactionId && removedTxIds.has(item.transactionId)) {
      return { ...item, status: 'pending' as const, paidAt: undefined, transactionId: undefined }
    }
    return item
  })
  const nextPlans = plans.map((plan) => {
    const planItems = nextItems.filter((item) => item.planId === plan.id)
    return { ...plan, status: nextPlanStatus(plan, planItems, today), updatedAt: Date.now() }
  })
  return { items: nextItems, plans: nextPlans }
}

export function nextPlanStatus(
  plan: InstallmentPlan,
  items: InstallmentItem[],
  today: string,
): InstallmentPlan['status'] {
  if (plan.status === 'archived') return 'archived'
  if (items.length > 0 && items.every((item) => itemEffectiveStatus(item, today) === 'paid')) {
    return 'completed'
  }
  return 'active'
}

function reindexItems(items: InstallmentItem[]): InstallmentItem[] {
  return items
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item, idx) => (item.index === idx + 1 ? item : { ...item, index: idx + 1 }))
}

/** Return one paid installment to unpaid. The linked expense is removed and the account balance comes back. */
export function unpayInstallmentItem(itemId: string, data: AppData, today = todayIso()): AppData {
  const item = data.items.find((row) => row.id === itemId)
  if (!item) throw new Error('قسط پیدا نشد')
  if (itemEffectiveStatus(item, today) !== 'paid') throw new Error('این قسط پرداخت نشده')
  if (item.transactionId && data.transactions.some((row) => row.id === item.transactionId)) {
    return deleteTransactionCascade(item.transactionId, data, today)
  }
  const nextItems = data.items.map((row) =>
    row.id === item.id ? { ...row, status: 'pending' as const, paidAt: undefined, transactionId: undefined } : row,
  )
  const plans = data.plans.map((plan) => {
    if (plan.id !== item.planId) return plan
    const planItems = nextItems.filter((row) => row.planId === plan.id)
    return { ...plan, status: nextPlanStatus(plan, planItems, today), updatedAt: Date.now() }
  })
  return { ...data, items: nextItems, plans }
}

/** Delete one transaction. Transfer legs are always removed together. Linked installment items are unpaid, not removed. */
export function deleteTransactionCascade(txId: string, data: AppData, today = todayIso()): AppData {
  const tx = data.transactions.find((row) => row.id === txId)
  if (!tx) throw new Error('تراکنش پیدا نشد')
  const removedTxIds = transferIdsToRemove(tx, data.transactions)
  const transactions = data.transactions.filter((row) => !removedTxIds.has(row.id))
  const { items, plans } = unpayItemsForRemovedTxs(data.items, data.plans, removedTxIds, today)
  return rebalance({ ...data, transactions, items, plans })
}

/**
 * Hard-delete an account.
 * - All of its transactions go away.
 * - Transfer counterpart legs on other accounts go away too (double-entry stays consistent).
 * - Linked installment payments are reversed (items stay on the plan, unpaid).
 * - Plans that used this account as default are pointed at another active account when one exists.
 */
export function deleteAccountCascade(accountId: string, data: AppData, today = todayIso()): AppData {
  const account = data.accounts.find((row) => row.id === accountId)
  if (!account) throw new Error('حساب پیدا نشد')

  const removedTxIds = new Set<string>()
  for (const tx of data.transactions) {
    if (tx.accountId === accountId) {
      for (const id of transferIdsToRemove(tx, data.transactions)) removedTxIds.add(id)
    }
  }

  const transactions = data.transactions.filter((row) => !removedTxIds.has(row.id))
  const accounts = data.accounts.filter((row) => row.id !== accountId)
  const fallback = accounts.find((row) => !row.archived)
  const { items, plans: unpaidPlans } = unpayItemsForRemovedTxs(data.items, data.plans, removedTxIds, today)
  const plans = unpaidPlans.map((plan) =>
    plan.defaultAccountId === accountId
      ? { ...plan, defaultAccountId: fallback?.id ?? plan.defaultAccountId, updatedAt: Date.now() }
      : plan,
  )
  return rebalance({ accounts, transactions, items, plans })
}

/**
 * Hard-delete a plan, every installment item, and every linked payment expense.
 * Account balances credit back because those expenses disappear.
 */
export function deletePlanCascade(planId: string, data: AppData): AppData {
  const plan = data.plans.find((row) => row.id === planId)
  if (!plan) throw new Error('برنامه پیدا نشد')
  const planItems = data.items.filter((item) => item.planId === planId)
  const removedTxIds = new Set<string>()
  for (const item of planItems) {
    if (item.transactionId) removedTxIds.add(item.transactionId)
  }
  return rebalance({
    ...data,
    transactions: data.transactions.filter((row) => !removedTxIds.has(row.id)),
    items: data.items.filter((item) => item.planId !== planId),
    plans: data.plans.filter((row) => row.id !== planId),
  })
}

/**
 * Hard-delete one installment item.
 * Paid item: linked expense is also deleted (payment reversed AND the slot leaves the schedule).
 * Remaining items are reindexed 1..n and plan.totalCount follows.
 * If nothing remains, the plan is deleted.
 *
 * Contrast with deleteTransactionCascade on the payment: that only unpays the item and keeps the slot.
 */
export function deleteInstallmentItemCascade(itemId: string, data: AppData, today = todayIso()): AppData {
  const item = data.items.find((row) => row.id === itemId)
  if (!item) throw new Error('قسط پیدا نشد')
  const plan = data.plans.find((row) => row.id === item.planId)
  if (!plan) throw new Error('برنامه پیدا نشد')

  const removedTxIds = new Set<string>()
  if (item.transactionId) removedTxIds.add(item.transactionId)

  const remaining = reindexItems(data.items.filter((row) => row.planId === plan.id && row.id !== itemId))
  const otherItems = data.items.filter((row) => row.planId !== plan.id)
  const transactions = data.transactions.filter((row) => !removedTxIds.has(row.id))

  if (remaining.length === 0) {
    return rebalance({
      ...data,
      transactions,
      items: otherItems,
      plans: data.plans.filter((row) => row.id !== plan.id),
    })
  }

  const nextPlan: InstallmentPlan = {
    ...plan,
    totalCount: remaining.length,
    status: nextPlanStatus(plan, remaining, today),
    updatedAt: Date.now(),
  }
  return rebalance({
    ...data,
    transactions,
    items: [...otherItems, ...remaining],
    plans: data.plans.map((row) => (row.id === plan.id ? nextPlan : row)),
  })
}

function accountRowKey(row: Account): string {
  return `${row.id}|${row.name}|${row.type}|${row.archived}|${row.openingBalance}|${row.createdAt}|${row.updatedAt}`
}

function txRowKey(row: Transaction): string {
  return `${row.id}|${row.kind}|${row.amount}|${row.accountId}|${row.counterpartyAccountId ?? ''}|${row.transferId ?? ''}|${row.installmentItemId ?? ''}|${row.categoryId}|${row.note}|${row.date}|${row.createdAt}`
}

function planRowKey(row: InstallmentPlan): string {
  return `${row.id}|${row.name}|${row.installmentAmount}|${row.totalCount}|${row.startDate}|${row.defaultAccountId}|${row.status}|${row.kind ?? ''}|${row.principal ?? ''}|${row.annualRatePercent ?? ''}|${row.updatedAt}`
}

function itemRowKey(row: InstallmentItem): string {
  return `${row.id}|${row.planId}|${row.index}|${row.dueDate}|${row.amount}|${row.status}|${row.paidAt ?? ''}|${row.transactionId ?? ''}`
}

export function patchToWrites(
  prev: AppData,
  next: AppData,
): {
  putAccounts: Account[]
  deleteAccountIds: string[]
  putTransactions: Transaction[]
  deleteTransactionIds: string[]
  putPlans: InstallmentPlan[]
  deletePlanIds: string[]
  putItems: InstallmentItem[]
  deleteItemIds: string[]
} {
  const prevAcc = new Map(prev.accounts.map((row) => [row.id, row]))
  const nextAcc = new Map(next.accounts.map((row) => [row.id, row]))
  const prevTx = new Map(prev.transactions.map((row) => [row.id, row]))
  const nextTx = new Map(next.transactions.map((row) => [row.id, row]))
  const prevPlan = new Map(prev.plans.map((row) => [row.id, row]))
  const nextPlan = new Map(next.plans.map((row) => [row.id, row]))
  const prevItem = new Map(prev.items.map((row) => [row.id, row]))
  const nextItem = new Map(next.items.map((row) => [row.id, row]))

  return {
    putAccounts: next.accounts.filter((row) => {
      const prior = prevAcc.get(row.id)
      return !prior || accountRowKey(prior) !== accountRowKey(row)
    }),
    deleteAccountIds: prev.accounts.filter((row) => !nextAcc.has(row.id)).map((row) => row.id),
    putTransactions: next.transactions.filter((row) => {
      const prior = prevTx.get(row.id)
      return !prior || txRowKey(prior) !== txRowKey(row)
    }),
    deleteTransactionIds: prev.transactions.filter((row) => !nextTx.has(row.id)).map((row) => row.id),
    putPlans: next.plans.filter((row) => {
      const prior = prevPlan.get(row.id)
      return !prior || planRowKey(prior) !== planRowKey(row)
    }),
    deletePlanIds: prev.plans.filter((row) => !nextPlan.has(row.id)).map((row) => row.id),
    putItems: next.items.filter((row) => {
      const prior = prevItem.get(row.id)
      return !prior || itemRowKey(prior) !== itemRowKey(row)
    }),
    deleteItemIds: prev.items.filter((row) => !nextItem.has(row.id)).map((row) => row.id),
  }
}
