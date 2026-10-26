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
  deletePocketCascade,
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
  DebtLoan,
  InstallmentItem,
  InstallmentPlan,
  Pocket,
  PocketTransfer,
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
  pockets: Pocket[]
  pocketTransfers: PocketTransfer[]
  customCategories: Category[]
  activeAccounts: Account[]
  totalBalance: number
  refresh: () => Promise<void>
  createAccount: (input: CreateAccountInput) => Promise<Account>
  updateAccount: (id: string, patch: { name?: string; type?: Account['type']; classification?: AccountClassification; accountNumber?: string; smsSenders?: string[] }) => Promise<void>
  archiveAccount: (id: string) => Promise<void>
  restoreAccount: (id: string) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  createPocket: (input: { accountId: string; name: string; isOwn?: boolean; openingBalance?: number }) => Promise<Pocket>
  updatePocket: (id: string, patch: { name?: string; isOwn?: boolean; openingBalance?: number }) => Promise<void>
  deletePocket: (id: string, targetPocketId?: string) => Promise<void>
  addPocketTransfer: (input: { accountId: string; fromPocketId: string; toPocketId: string; amount: number; note?: string; date?: string }) => Promise<PocketTransfer>
  deletePocketTransfer: (id: string) => Promise<void>
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
    pockets?: Pocket[]
    pocketTransfers?: PocketTransfer[]
    customCategories?: Category[]
  }) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

let readLiveImpl: () => AppData = () => ({
  accounts: [],
  transactions: [],
  plans: [],
  items: [],
  pockets: [],
  pocketTransfers: [],
})

export function readLiveStore() {
  return readLiveImpl()
}

function hydrateSnapshot(data: AppData): AppData {
  return {
    ...data,
    accounts: hydrateAccounts(data.accounts, data.transactions).sort((a, b) => a.createdAt - b.createdAt),
    transactions: sortTransactions(data.transactions),
    plans: data.plans.slice().sort((a, b) => a.createdAt - b.createdAt),
    items: data.items.slice().sort((a, b) => a.index - b.index),
    pockets: (data.pockets ?? []).slice().sort((a, b) => a.createdAt - b.createdAt),
    pocketTransfers: (data.pocketTransfers ?? []).slice().sort((a, b) => b.createdAt - a.createdAt),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [plans, setPlans] = useState<InstallmentPlan[]>([])
  const [items, setItems] = useState<InstallmentItem[]>([])
  const [pockets, setPockets] = useState<Pocket[]>([])
  const [pocketTransfers, setPocketTransfers] = useState<PocketTransfer[]>([])
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const dataRef = useRef<AppData>({ accounts, transactions, plans, items, pockets, pocketTransfers })
  dataRef.current = { accounts, transactions, plans, items, pockets, pocketTransfers }
  readLiveImpl = () => dataRef.current

  const applySnapshot = useCallback((data: AppData) => {
    const next = hydrateSnapshot(data)
    dataRef.current = next
    setAccounts(next.accounts)
    setTransactions(next.transactions)
    setPlans(next.plans)
    setItems(next.items)
    setPockets(next.pockets ?? [])
    setPocketTransfers(next.pocketTransfers ?? [])
  }, [])

  const persistSnapshot = useCallback(
    async (prev: AppData, next: AppData) => {
      const hydrated = hydrateSnapshot(next)
      applySnapshot(hydrated)
      try {
        await db.applyDataPatch(patchToWrites(prev, hydrated))
        if (hydrated.pockets) await db.putPockets(hydrated.pockets)
        if (hydrated.pocketTransfers) await db.putPocketTransfers(hydrated.pocketTransfers)
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
    const [raw, txs, nextPlans, nextItems, nextPockets, nextPocketTransfers] = await Promise.all([
      db.listRawAccounts(),
      db.listTransactions(),
      db.listInstallmentPlans(),
      db.listInstallmentItems(),
      db.listPockets(),
      db.listPocketTransfers(),
    ])
    applySnapshot({
      accounts: hydrateAccounts(raw, txs),
      transactions: txs,
      plans: nextPlans,
      items: nextItems,
      pockets: nextPockets,
      pocketTransfers: nextPocketTransfers,
    })
  }, [applySnapshot])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      setError((current) => current ?? 'باز کردن ذخیره‌سازی محلی طول کشید. صفحه را یک‌بار تازه کنید.')
      setReady(true)
    }, 8000)
    ;(async () => {
      try {
        await refresh()
        const customsRaw = await db.getKv<Category[]>('customCategories')
        const customs = Array.isArray(customsRaw) ? customsRaw : []
        if (cancelled) return
        setCustomCategories(customs.filter((c) => c && !isProtectedCategory(c.id)))
        setError(null)
        setReady(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'خطای ذخیره‌سازی')
        setReady(true)
      } finally {
        window.clearTimeout(timer)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
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
      smsSenders: input.smsSenders && input.smsSenders.length > 0 ? input.smsSenders : undefined,
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
      smsSenders?: string[]
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
      smsSenders: patch.smsSenders !== undefined ? (patch.smsSenders.length > 0 ? patch.smsSenders : undefined) : account.smsSenders,
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

  const createPocket = useCallback(async (input: { accountId: string; name: string; isOwn?: boolean; openingBalance?: number }) => {
    const prev = dataRef.current
    const account = prev.accounts.find((a) => a.id === input.accountId)
    if (!account) throw new Error('حساب پیدا نشد')
    const name = input.name.trim()
    if (!name) throw new Error('نام جیب را وارد کنید')

    const now = Date.now()
    const { pockets: currentPockets, mainPocket } = db.ensureMainPocketForAccount(account, prev.pockets ?? [])

    const newPocket: Pocket = {
      id: createId('pkt'),
      accountId: input.accountId,
      name,
      isMain: false,
      isOwn: input.isOwn ?? true,
      openingBalance: input.openingBalance ?? 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }

    // Pockets are ledgers: the opening amount is not taken from the main pocket.
    void mainPocket
    const nextPockets = currentPockets

    await persistSnapshot(prev, {
      ...prev,
      pockets: [...nextPockets, newPocket],
    })

    return newPocket
  }, [persistSnapshot])

  const updatePocket = useCallback(async (id: string, patch: { name?: string; isOwn?: boolean; openingBalance?: number }) => {
    const prev = dataRef.current
    const pocket = (prev.pockets ?? []).find((p) => p.id === id)
    if (!pocket) throw new Error('جیب پیدا نشد')
    const now = Date.now()
    const nextPocket: Pocket = {
      ...pocket,
      name: patch.name !== undefined ? patch.name.trim() : pocket.name,
      isOwn: patch.isOwn !== undefined ? patch.isOwn : pocket.isOwn,
      openingBalance: patch.openingBalance !== undefined ? patch.openingBalance : pocket.openingBalance,
      updatedAt: now,
    }
    await persistSnapshot(prev, {
      ...prev,
      pockets: (prev.pockets ?? []).map((p) => (p.id === id ? nextPocket : p)),
    })
  }, [persistSnapshot])

  const deletePocket = useCallback(async (id: string, targetPocketId?: string) => {
    const prev = dataRef.current
    const existingDebts = (await db.getKv<DebtLoan[]>('debts')) ?? []
    const next = deletePocketCascade(id, targetPocketId, { ...prev, debts: existingDebts })
    if (next.debts) {
      await db.setKv('debts', next.debts)
      window.dispatchEvent(new Event('hy-debts-updated'))
    }
    await persistSnapshot(prev, next)
  }, [persistSnapshot])

  const addPocketTransfer = useCallback(async (input: {
    accountId: string
    fromPocketId: string
    toPocketId: string
    amount: number
    note?: string
    date?: string
  }) => {
    if (input.fromPocketId === input.toPocketId) {
      throw new Error('جیب مبدأ و مقصد نمی‌تواند یکسان باشد')
    }
    if (input.amount <= 0) {
      throw new Error('مبلغ انتقال باید بیشتر از صفر باشد')
    }
    const prev = dataRef.current
    const now = Date.now()
    const tr: PocketTransfer = {
      id: createId('ptr'),
      accountId: input.accountId,
      fromPocketId: input.fromPocketId,
      toPocketId: input.toPocketId,
      amount: input.amount,
      note: input.note?.trim() || '',
      date: input.date || todayIso(),
      createdAt: now,
      updatedAt: now,
    }
    await persistSnapshot(prev, {
      ...prev,
      pocketTransfers: [tr, ...(prev.pocketTransfers ?? [])],
    })
    return tr
  }, [persistSnapshot])

  const deletePocketTransfer = useCallback(async (id: string) => {
    const prev = dataRef.current
    await persistSnapshot(prev, {
      ...prev,
      pocketTransfers: (prev.pocketTransfers ?? []).filter((tr) => tr.id !== id),
    })
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
        pocketId: input.pocketId,
      },
      { customCategories },
    )
    let nextData = result.nextData
    if (input.countAsLoan && input.kind === 'expense' && input.pocketId) {
      const pocket = (prev.pockets ?? []).find((p) => p.id === input.pocketId)
      const now = Date.now()
      const newDebt: DebtLoan = {
        id: createId('debt'),
        direction: 'borrowed',
        party: pocket ? pocket.name : 'جیب',
        amount: input.amount,
        repaidAmount: 0,
        status: 'active',
        pocketId: input.pocketId,
        transactionId: result.transaction.id,
        note: `قرض از جیب ${pocket ? pocket.name : ''}`.trim(),
        createdAt: now,
        updatedAt: now,
      }
      const existingDebts = (await db.getKv<DebtLoan[]>('debts')) ?? []
      const nextDebts = [newDebt, ...existingDebts]
      await db.setKv('debts', nextDebts)
      window.dispatchEvent(new Event('hy-debts-updated'))
      nextData = { ...nextData, debts: nextDebts }
    } else if (input.repayDebtId && input.kind === 'income') {
      const existingDebts = (await db.getKv<DebtLoan[]>('debts')) ?? []
      const targetDebt = existingDebts.find((d) => d.id === input.repayDebtId)
      if (targetDebt) {
        const updatedRepaid = (targetDebt.repaidAmount || 0) + input.amount
        const isSettled = updatedRepaid >= targetDebt.amount
        const updatedDebt: DebtLoan = {
          ...targetDebt,
          repaidAmount: updatedRepaid,
          status: isSettled ? 'settled' : 'active',
          settledAt: isSettled ? (input.date || todayIso()) : targetDebt.settledAt,
          updatedAt: Date.now(),
        }
        const nextDebts = existingDebts.map((d) => (d.id === targetDebt.id ? updatedDebt : d))
        await db.setKv('debts', nextDebts)
        window.dispatchEvent(new Event('hy-debts-updated'))
        nextData = { ...nextData, debts: nextDebts }
      }
    }
    await persistSnapshot(prev, nextData)
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
        fromPocketId: input.fromPocketId,
        toPocketId: input.toPocketId,
      },
      { customCategories },
    )
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const updateTransaction = useCallback(async (id: string, patch: UpdateTransactionInput) => {
    const prev = dataRef.current
    const existingDebts = (await db.getKv<DebtLoan[]>('debts')) ?? []
    const result = hesabyarBusiness.updateTransaction(
      { ...prev, debts: existingDebts },
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
        pocketId: patch.pocketId,
      },
      { customCategories },
    )
    if (result.nextData.debts) {
      await db.setKv('debts', result.nextData.debts)
      window.dispatchEvent(new Event('hy-debts-updated'))
    }
    await persistSnapshot(prev, result.nextData)
  }, [persistSnapshot, customCategories])

  const deleteTransaction = useCallback(async (id: string) => {
    const prev = dataRef.current
    const existingDebts = (await db.getKv<DebtLoan[]>('debts')) ?? []
    const result = hesabyarBusiness.deleteTransaction({ ...prev, debts: existingDebts }, id, { customCategories })
    if (result.nextData.debts) {
      await db.setKv('debts', result.nextData.debts)
      window.dispatchEvent(new Event('hy-debts-updated'))
    }
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
    pockets?: Pocket[]
    pocketTransfers?: PocketTransfer[]
    customCategories?: Category[]
  }) => {
    const { withoutSync } = await import('../lib/sync')
    await withoutSync(async () => {
      await db.replaceAllData(data.accounts, data.transactions, data.plans, data.items)
      if (data.pockets) await db.putPockets(data.pockets)
      if (data.pocketTransfers) await db.putPocketTransfers(data.pocketTransfers)
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
      pockets,
      pocketTransfers,
      customCategories,
      activeAccounts,
      totalBalance,
      refresh,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      deleteAccount,
      createPocket,
      updatePocket,
      deletePocket,
      addPocketTransfer,
      deletePocketTransfer,
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
      pockets,
      pocketTransfers,
      customCategories,
      activeAccounts,
      totalBalance,
      refresh,
      createAccount,
      updateAccount,
      archiveAccount,
      restoreAccount,
      deleteAccount,
      createPocket,
      updatePocket,
      deletePocket,
      addPocketTransfer,
      deletePocketTransfer,
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
