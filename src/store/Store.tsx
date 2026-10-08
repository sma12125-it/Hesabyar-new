import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as db from '../db/db'
import { sortTransactions } from '../db/db'
import { demoDataset } from '../db/seed'
import { hydrateAccounts } from '../lib/balance'
import * as hesabyarBusiness from '../lib/business'
import {
  deleteAccountCascade,
  deleteInstallmentItemCascade,
  deletePlanCascade,
  nextPlanStatus,
  unpayInstallmentItem,
  patchToWrites,
  type AppData,
} from '../lib/cascade'
import {
  INSTALLMENT_CATEGORY_ID,
  isProtectedCategory,
  transactionsAfterCategoryDelete,
  validateCategoryName,
} from '../lib/categories'
import { createId } from '../lib/ids'
import {
  defaultPayNote,
  generateInstallmentItems,
  itemEffectiveStatus,
  paidCount,
  planHasPayment,
  scheduleForPlanInput,
  validatePlanInput,
  validatePlanUpdate,
} from '../lib/installments'
import { isValidIsoDate, todayIso } from '../lib/iso'
import { actorStamp } from '../lib/actor'
import { validateAccountName, validateAmount } from '../lib/money'
import { applyShareToData, type SharePayload } from '../lib/share'
import type {
  Account,
  AccountClassification,
  Category,
  CreateAccountInput,
  CreateInstallmentPlanInput,
  InstallmentItem,
  InstallmentPlan,
  QuickEntryInput,
  Transaction,
  TransferInput,
  UpdateInstallmentItemInput,
  UpdateInstallmentPlanInput,
  UpdateTransactionInput,
} from '../types'

interface StoreValue {
  ready: boolean
  error: string | null
  accounts: Account[]
  transactions: Transaction[]
  plans: InstallmentPlan[]
  items: InstallmentItem[]
  customCategories: Category[]
  activeAccounts: Account[]
  totalBalance: number
  refresh: () => Promise<void>
  createAccount: (input: CreateAccountInput) => Promise<Account>
  updateAccount: (id: string, patch: { name?: string; type?: Account['type']; classification?: AccountClassification; accountNumber?: string }) => Promise<void>
  archiveAccount: (id: string) => Promise<void>
  restoreAccount: (id: string) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  addQuickEntry: (input: QuickEntryInput) => Promise<void>
  addTransfer: (input: TransferInput) => Promise<void>
  updateTransaction: (id: string, patch: UpdateTransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  createInstallmentPlan: (input: CreateInstallmentPlanInput) => Promise<InstallmentPlan>
  updateInstallmentPlan: (id: string, patch: UpdateInstallmentPlanInput) => Promise<void>
  updateInstallmentItem: (id: string, patch: UpdateInstallmentItemInput) => Promise<void>
  archiveInstallmentPlan: (id: string) => Promise<void>
  restoreInstallmentPlan: (id: string) => Promise<void>
  deleteInstallmentPlan: (id: string) => Promise<void>
  deleteInstallmentItem: (id: string) => Promise<void>
  payInstallment: (itemId: string, accountId: string, note?: string) => Promise<void>
  unpayInstallment: (itemId: string) => Promise<void>
  resetDemo: () => Promise<void>
  wipeAll: () => Promise<void>
  createCategory: (kind: 'expense' | 'income', name: string) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  attachShare: (accountId: string, shareId: string) => Promise<void>
  applyShared: (ledgerId: string, payload: SharePayload) => Promise<void>
  importCloud: (data: {
    accounts: Account[]
    transactions: Transaction[]
    plans: InstallmentPlan[]
    items: InstallmentItem[]
    customCategories?: Category[]
  }) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

let readLiveImpl: () => AppData = () => ({ accounts: [], transactions: [], plans: [], items: [] })

export function readLiveStore() {
  return readLiveImpl()
}

function hydrateSnapshot(data: AppData): AppData {
  return {
    accounts: hydrateAccounts(data.accounts, data.transactions).sort((a, b) => a.createdAt - b.createdAt),
    transactions: sortTransactions(data.transactions),
    plans: data.plans.slice().sort((a, b) => a.createdAt - b.createdAt),
    items: data.items.slice().sort((a, b) => a.index - b.index),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [plans, setPlans] = useState<InstallmentPlan[]>([])
  const [items, setItems] = useState<InstallmentItem[]>([])
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const dataRef = useRef<AppData>({ accounts, transactions, plans, items })
  dataRef.current = { accounts, transactions, plans, items }
  readLiveImpl = () => dataRef.current

  const applySnapshot = useCallback((data: AppData) => {
    const next = hydrateSnapshot(data)
    dataRef.current = next
    setAccounts(next.accounts)
    setTransactions(next.transactions)
    setPlans(next.plans)
    setItems(next.items)
  }, [])

  const persistSnapshot = useCallback(
    async (prev: AppData, next: AppData) => {
      const hydrated = hydrateSnapshot(next)
      applySnapshot(hydrated)
      try {
        await db.applyDataPatch(patchToWrites(prev, hydrated))
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      } catch (err) {
        applySnapshot(prev)
        throw err
      }
    },
    [applySnapshot],
  )

  const refresh = useCallback(async () => {
    const [raw, txs, nextPlans, nextItems] = await Promise.all([
      db.listRawAccounts(),
      db.listTransactions(),
      db.listInstallmentPlans(),
      db.listInstallmentItems(),
    ])
    applySnapshot({ accounts: hydrateAccounts(raw, txs), transactions: txs, plans: nextPlans, items: nextItems })
  }, [applySnapshot])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!cancelled) {
          await refresh()
          const customs = (await db.getKv<Category[]>('customCategories')) ?? []
          setCustomCategories(customs.filter((c) => !isProtectedCategory(c.id)))
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطای ذخیره‌سازی')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts])
  const totalBalance = useMemo(
    () => activeAccounts.reduce((sum, a) => sum + a.balance, 0),
    [activeAccounts],
  )

  const createAccount = useCallback(async (input: CreateAccountInput) => {
    const nameError = validateAccountName(input.name)
    if (nameError) throw new Error(nameError)
    if (input.initialBalance < 0 || !Number.isInteger(input.initialBalance)) {
      throw new Error('موجودی اولیه نامعتبر است')
    }
    const now = Date.now()
    const account: Account = {
      id: createId('acc'),
      name: input.name.trim(),
      type: input.type,
      classification: input.classification ?? 'cash',
      accountNumber: input.accountNumber?.trim() || undefined,
      archived: false,
      openingBalance: input.initialBalance,
      balance: input.initialBalance,
      createdAt: now,
      updatedAt: now,
      cardId: input.cardId,
    }
    const prev = dataRef.current
    await persistSnapshot(prev, { ...prev, accounts: [...prev.accounts, account] })
    return account
  }, [persistSnapshot])

  const updateAccount = useCallback(async (
    id: string,
    patch: {
      name?: string
      type?: Account['type']
      classification?: AccountClassification
      accountNumber?: string
    }
  ) => {
    const prev = dataRef.current
    const account = prev.accounts.find((a) => a.id === id)
    if (!account) throw new Error('حساب پیدا نشد')
    const nextName = patch.name ?? account.name
    const nameError = validateAccountName(nextName)
    if (nameError) throw new Error(nameError)
    const next: Account = {
      ...account,
      name: nextName.trim(),
      type: patch.type ?? account.type,
      classification: patch.classification ?? account.classification ?? 'cash',
      accountNumber: patch.accountNumber !== undefined ? (patch.accountNumber.trim() || undefined) : account.accountNumber,
      updatedAt: Date.now(),
    }
    await persistSnapshot(prev, {
      ...prev,
      accounts: prev.accounts.map((row) => (row.id === id ? next : row)),
    })
  }, [persistSnapshot])

  const archiveAccount = useCallback(async (id: string) => {
    const prev = dataRef.current
    const account = prev.accounts.find((a) => a.id === id)
    if (!account) throw new Error('حساب پیدا نشد')
    await persistSnapshot(prev, {
      ...prev,
      accounts: prev.accounts.map((row) => (row.id === id ? { ...row, archived: true, updatedAt: Date.now() } : row)),
    })
  }, [persistSnapshot])

  const restoreAccount = useCallback(async (id: string) => {
    const prev = dataRef.current
    const account = prev.accounts.find((a) => a.id === id)
    if (!account) throw new Error('حساب پیدا نشد')
    await persistSnapshot(prev, {
      ...prev,
      accounts: prev.accounts.map((row) => (row.id === id ? { ...row, archived: false, updatedAt: Date.now() } : row)),
    })
  }, [persistSnapshot])

  const deleteAccount = useCallback(async (id: string) => {
    const prev = dataRef.current
    await persistSnapshot(prev, deleteAccountCascade(id, prev))
  }, [persistSnapshot])

  const addQuickEntry = useCallback(async (input: QuickEntryInput) => {
    const prev = dataRef.current
    const result = hesabyarBusiness.createTransaction(
      prev,
      {
        account: input.accountId,
        amount: input.amount,
        currency: 'IRR',
        type: input.kind,
        category: input.categoryId,
        description: input.note,
        date: input.date,
        source: input.source,
        receiptPhoto: input.receiptPhoto,
        tags: input.tags,
      },
      { customCategories },
    )
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const addTransfer = useCallback(async (input: TransferInput) => {
    const prev = dataRef.current
    const result = hesabyarBusiness.createTransfer(
      prev,
      {
        fromAccount: input.fromAccountId,
        toAccount: input.toAccountId,
        amount: input.amount,
        currency: 'IRR',
        date: input.date,
        description: input.note,
        source: input.source,
      },
      { customCategories },
    )
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const updateTransaction = useCallback(async (id: string, patch: UpdateTransactionInput) => {
    const prev = dataRef.current
    const result = hesabyarBusiness.updateTransaction(
      prev,
      id,
      {
        amount: patch.amount,
        account: patch.accountId,
        category: patch.categoryId,
        description: patch.note,
        date: patch.date,
        type: patch.kind,
        fromAccount: patch.fromAccountId,
        toAccount: patch.toAccountId,
        receiptPhoto: patch.receiptPhoto,
        tags: patch.tags,
      },
      { customCategories },
    )
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const deleteTransaction = useCallback(async (id: string) => {
    const prev = dataRef.current
    const result = hesabyarBusiness.deleteTransaction(prev, id, { customCategories })
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const createInstallmentPlan = useCallback(async (input: CreateInstallmentPlanInput) => {
    const prev = dataRef.current
    const errorMessage = validatePlanInput(input, prev.accounts)
    if (errorMessage) throw new Error(errorMessage)
    const built = scheduleForPlanInput(input)
    const now = Date.now()
    const plan: InstallmentPlan = {
      id: createId('plan'),
      name: input.name.trim(),
      installmentAmount: built.installmentAmount,
      totalCount: input.totalCount,
      startDate: input.startDate,
      defaultAccountId: input.defaultAccountId,
      categoryId: INSTALLMENT_CATEGORY_ID,
      status: 'active',
      kind: built.kind,
      principal: built.principal,
      annualRatePercent: built.annualRatePercent,
      createdAt: now,
      updatedAt: now,
    }
    const generated = generateInstallmentItems(plan.id, built.amounts, plan.totalCount, plan.startDate)
    await persistSnapshot(prev, {
      ...prev,
      plans: [...prev.plans, plan],
      items: [...prev.items, ...generated],
    })
    return plan
  }, [persistSnapshot])

  const updateInstallmentPlan = useCallback(async (id: string, patch: UpdateInstallmentPlanInput) => {
    const prev = dataRef.current
    const plan = prev.plans.find((p) => p.id === id)
    if (!plan) throw new Error('برنامه پیدا نشد')
    const planItems = prev.items.filter((i) => i.planId === id)
    const errorMessage = validatePlanUpdate(patch, planItems, prev.accounts)
    if (errorMessage) throw new Error(errorMessage)
    const locked = planHasPayment(planItems)
    const next: InstallmentPlan = {
      ...plan,
      name: patch.name?.trim() ?? plan.name,
      defaultAccountId: patch.defaultAccountId ?? plan.defaultAccountId,
      updatedAt: Date.now(),
    }
    const scheduleChanged =
      !locked &&
      (patch.installmentAmount != null ||
        patch.totalCount != null ||
        patch.startDate != null ||
        patch.kind != null ||
        patch.principal != null ||
        patch.annualRatePercent != null)
    if (scheduleChanged) {
      const kind = patch.kind ?? plan.kind ?? 'fixed'
      const built = scheduleForPlanInput({
        kind,
        installmentAmount: patch.installmentAmount ?? plan.installmentAmount,
        totalCount: patch.totalCount ?? plan.totalCount,
        principal: patch.principal ?? plan.principal,
        annualRatePercent: patch.annualRatePercent ?? plan.annualRatePercent,
      })
      next.kind = built.kind
      next.principal = built.kind === 'loan' ? built.principal : undefined
      next.annualRatePercent = built.kind === 'loan' ? built.annualRatePercent : undefined
      next.installmentAmount = built.installmentAmount
      next.totalCount = patch.totalCount ?? plan.totalCount
      next.startDate = patch.startDate ?? plan.startDate
      const sameSchedule =
        next.kind === (plan.kind ?? 'fixed') &&
        next.installmentAmount === plan.installmentAmount &&
        next.totalCount === plan.totalCount &&
        next.startDate === plan.startDate &&
        next.principal === plan.principal &&
        next.annualRatePercent === plan.annualRatePercent
      if (!sameSchedule) {
        const generated = generateInstallmentItems(next.id, built.amounts, next.totalCount, next.startDate)
        await persistSnapshot(prev, {
          ...prev,
          plans: prev.plans.map((row) => (row.id === id ? next : row)),
          items: [...prev.items.filter((item) => item.planId !== id), ...generated],
        })
        return
      }
    }
    await persistSnapshot(prev, {
      ...prev,
      plans: prev.plans.map((row) => (row.id === id ? next : row)),
    })
  }, [persistSnapshot])

  const updateInstallmentItem = useCallback(async (id: string, patch: UpdateInstallmentItemInput) => {
    const prev = dataRef.current
    const item = prev.items.find((row) => row.id === id)
    if (!item) throw new Error('قسط پیدا نشد')
    if (itemEffectiveStatus(item, todayIso()) === 'paid') {
      throw new Error('قسط پرداخت‌شده را از تراکنش ویرایش کنید')
    }
    const amount = patch.amount ?? item.amount
    const amountError = validateAmount(amount)
    if (amountError) throw new Error(amountError)
    const dueDate = patch.dueDate ?? item.dueDate
    if (!isValidIsoDate(dueDate)) throw new Error('تاریخ نامعتبر است')
    const nextItem: InstallmentItem = { ...item, amount, dueDate }
    await persistSnapshot(prev, {
      ...prev,
      items: prev.items.map((row) => (row.id === id ? nextItem : row)),
    })
  }, [persistSnapshot])

  const archiveInstallmentPlan = useCallback(async (id: string) => {
    const prev = dataRef.current
    const plan = prev.plans.find((p) => p.id === id)
    if (!plan) throw new Error('برنامه پیدا نشد')
    await persistSnapshot(prev, {
      ...prev,
      plans: prev.plans.map((row) => (row.id === id ? { ...row, status: 'archived', updatedAt: Date.now() } : row)),
    })
  }, [persistSnapshot])

  const restoreInstallmentPlan = useCallback(async (id: string) => {
    const prev = dataRef.current
    const plan = prev.plans.find((p) => p.id === id)
    if (!plan) throw new Error('برنامه پیدا نشد')
    const planItems = prev.items.filter((i) => i.planId === id)
    const today = todayIso()
    const status = paidCount(planItems, today) === planItems.length && planItems.length > 0 ? 'completed' : 'active'
    await persistSnapshot(prev, {
      ...prev,
      plans: prev.plans.map((row) => (row.id === id ? { ...row, status, updatedAt: Date.now() } : row)),
    })
  }, [persistSnapshot])

  const deleteInstallmentPlan = useCallback(async (id: string) => {
    const prev = dataRef.current
    await persistSnapshot(prev, deletePlanCascade(id, prev))
  }, [persistSnapshot])

  const deleteInstallmentItem = useCallback(async (id: string) => {
    const prev = dataRef.current
    await persistSnapshot(prev, deleteInstallmentItemCascade(id, prev))
  }, [persistSnapshot])

  const payInstallment = useCallback(async (itemId: string, accountId: string, note?: string) => {
    const prev = dataRef.current
    const item = prev.items.find((i) => i.id === itemId)
    if (!item) throw new Error('قسط پیدا نشد')
    const plan = prev.plans.find((p) => p.id === item.planId)
    if (!plan) throw new Error('برنامه پیدا نشد')
    if (plan.status !== 'active') throw new Error('این برنامه قابل پرداخت نیست')
    const today = todayIso()
    if (itemEffectiveStatus(item, today) === 'paid') throw new Error('این قسط قبلاً پرداخت شده')
    const account = prev.accounts.find((a) => a.id === accountId)
    if (!account || account.archived) throw new Error('حساب پرداخت معتبر نیست')
    if (item.amount > account.balance) throw new Error('موجودی حساب برای پرداخت این قسط کافی نیست')
    const now = Date.now()
    const expense: Transaction = {
      id: createId('tx'),
      kind: 'expense',
      amount: item.amount,
      accountId: account.id,
      categoryId: INSTALLMENT_CATEGORY_ID,
      installmentItemId: item.id,
      note: (note ?? defaultPayNote(plan.name, item.index, plan.totalCount)).trim(),
      date: today,
      createdAt: now,
      ...actorStamp(now),
    }
    const paidItem: InstallmentItem = {
      ...item,
      status: 'paid',
      paidAt: today,
      transactionId: expense.id,
    }
    const allItems = prev.items.map((row) => (row.id === paidItem.id ? paidItem : row))
    const planItems = allItems.filter((row) => row.planId === plan.id)
    const nextPlan: InstallmentPlan = {
      ...plan,
      status: nextPlanStatus({ ...plan, status: 'active' }, planItems, today),
      updatedAt: now,
    }
    await persistSnapshot(prev, {
      ...prev,
      transactions: [expense, ...prev.transactions],
      items: allItems,
      plans: prev.plans.map((row) => (row.id === plan.id ? nextPlan : row)),
    })
  }, [persistSnapshot])

  const unpayInstallment = useCallback(async (itemId: string) => {
    const prev = dataRef.current
    await persistSnapshot(prev, unpayInstallmentItem(itemId, prev))
  }, [persistSnapshot])

  const resetDemo = useCallback(async () => {
    const demo = demoDataset()
    await db.replaceAllData(demo.accounts, demo.transactions, demo.plans, demo.items)
    await db.setKv('seeded', true)
    await refresh()
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [refresh])

  const wipeAll = useCallback(async () => {
    await db.replaceAllData([], [], [], [])
    await db.setKv('seeded', true)
    await db.setKv('customCategories', [])
    const { clearSmsDrafts } = await import('../lib/sms/drafts')
    await clearSmsDrafts()
    setCustomCategories([])
    await refresh()
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [refresh])

  const persistCategories = useCallback(async (next: Category[]) => {
    const clean = next.filter((c) => c.kind !== 'transfer' && !isProtectedCategory(c.id))
    setCustomCategories(clean)
    await db.setKv('customCategories', clean)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const createCategory = useCallback(async (kind: 'expense' | 'income', name: string) => {
    const nameError = validateCategoryName(name)
    if (nameError) throw new Error(nameError)
    const category: Category = {
      id: createId('cat'),
      name: name.trim(),
      icon: kind === 'expense' ? '🏷️' : '✨',
      kind,
    }
    await persistCategories([...customCategories, category])
    return category
  }, [customCategories, persistCategories])

  const renameCategory = useCallback(async (id: string, name: string) => {
    if (isProtectedCategory(id)) throw new Error('این دسته قابل تغییر نیست')
    const nameError = validateCategoryName(name)
    if (nameError) throw new Error(nameError)
    const current = customCategories.find((c) => c.id === id)
    if (!current) throw new Error('دسته پیدا نشد')
    await persistCategories(customCategories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)))
  }, [customCategories, persistCategories])

  const deleteCategory = useCallback(async (id: string) => {
    if (isProtectedCategory(id)) throw new Error('این دسته قابل حذف نیست')
    const current = customCategories.find((c) => c.id === id)
    if (!current || current.kind === 'transfer') throw new Error('دسته پیدا نشد')
    const prev = dataRef.current
    const nextTransactions = transactionsAfterCategoryDelete(prev.transactions, id, current.kind)
    await persistSnapshot(prev, { ...prev, transactions: nextTransactions })
    await persistCategories(customCategories.filter((c) => c.id !== id))
  }, [customCategories, persistCategories, persistSnapshot])

  const attachShare = useCallback(async (accountId: string, shareId: string) => {
    const prev = dataRef.current
    const account = prev.accounts.find((row) => row.id === accountId)
    if (!account) throw new Error('حساب پیدا نشد')
    await persistSnapshot(prev, {
      ...prev,
      accounts: prev.accounts.map((row) =>
        row.id === accountId ? { ...row, shareId, updatedAt: Date.now() } : row,
      ),
    })
  }, [persistSnapshot])

  const applyShared = useCallback(async (ledgerId: string, payload: SharePayload) => {
    const prev = dataRef.current
    const next = applyShareToData(prev, ledgerId, payload)
    const signature = (data: AppData) =>
      data.accounts
        .map((account) => `${account.id}:${account.shareId ?? ''}:${account.name}:${account.openingBalance}:${account.archived}:${account.updatedAt}`)
        .sort()
        .join('|') +
      '#' +
      data.transactions
        .map((tx) => `${tx.id}:${tx.updatedAt ?? tx.createdAt}:${tx.amount}:${tx.accountId}`)
        .sort()
        .join('|')
    if (signature(prev) === signature(next)) return
    const { withoutSync } = await import('../lib/sync')
    await withoutSync(() => persistSnapshot(prev, next))
  }, [persistSnapshot])

  const importCloud = useCallback(async (data: {
    accounts: Account[]
    transactions: Transaction[]
    plans: InstallmentPlan[]
    items: InstallmentItem[]
    customCategories?: Category[]
  }) => {
    const { withoutSync } = await import('../lib/sync')
    await withoutSync(async () => {
      await db.replaceAllData(data.accounts, data.transactions, data.plans, data.items)
      const customs = data.customCategories ?? []
      await db.setKv('customCategories', customs)
      setCustomCategories(customs)
      applySnapshot(data)
    })
  }, [applySnapshot])

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      error,
      accounts,
      transactions,
      plans,
      items,
      customCategories,
      activeAccounts,
      totalBalance,
      refresh,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      deleteAccount,
      addQuickEntry,
      addTransfer,
      updateTransaction,
      deleteTransaction,
      createInstallmentPlan,
      updateInstallmentPlan,
      updateInstallmentItem,
      archiveInstallmentPlan,
      restoreInstallmentPlan,
      deleteInstallmentPlan,
      deleteInstallmentItem,
      payInstallment,
      unpayInstallment,
      resetDemo,
      wipeAll,
      createCategory,
      renameCategory,
      deleteCategory,
      attachShare,
      applyShared,
      importCloud,
    }),
    [
      ready,
      error,
      accounts,
      transactions,
      plans,
      items,
      customCategories,
      activeAccounts,
      totalBalance,
      refresh,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      deleteAccount,
      addQuickEntry,
      addTransfer,
      updateTransaction,
      deleteTransaction,
      createInstallmentPlan,
      updateInstallmentPlan,
      updateInstallmentItem,
      archiveInstallmentPlan,
      restoreInstallmentPlan,
      deleteInstallmentPlan,
      deleteInstallmentItem,
      payInstallment,
      unpayInstallment,
      resetDemo,
      wipeAll,
      createCategory,
      renameCategory,
      deleteCategory,
      attachShare,
      applyShared,
      importCloud,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
