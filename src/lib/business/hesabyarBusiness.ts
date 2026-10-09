import { hydrateAccounts, incomeExpenseTotals } from '../balance'
import {
  deleteTransactionCascade,
  deletePlanCascade,
  deleteInstallmentItemCascade,
  unpayInstallmentItem,
  nextPlanStatus,
  type AppData,
} from '../cascade'
import {
  CATEGORIES,
  INSTALLMENT_CATEGORY_ID,
  categoriesFor,
  getCategory,
} from '../categories'
import {
  scheduleForPlanInput,
  generateInstallmentItems,
  validatePlanInput,
  validatePlanUpdate,
  itemEffectiveStatus,
  defaultPayNote,
} from '../installments'
import { createId } from '../ids'
import { isValidIsoDate, todayIso } from '../iso'
import { actorStamp } from '../actor'
import {
  availableAfterReplacing,
  formatRial,
  toFaDigits,
  validateAmount,
  validateExpenseBalance,
} from '../money'
import { expenseByCategory, monthlySeries } from '../reports'
import { validateTransfer } from '../transfer'
import type {
  Account,
  BankCard,
  Category,
  Cheque,
  ChequeDirection,
  ChequeStatus,
  CreateAccountInput,
  CreateInstallmentPlanInput,
  CurrencyUnit,
  DebtLoan,
  DebtLoanDirection,
  DebtLoanStatus,
  InstallmentItem,
  InstallmentPlan,
  InvestmentAsset,
  ReminderSettings,
  SavingsGoal,
  Transaction,
  TransferInput,
  TxKind,
  TxSource,
  UpdateInstallmentPlanInput,
} from '../../types'

export type { AppData }

export interface CurrencyAmount {
  amountRial: number
  amountToman: number
  currency: CurrencyUnit
  display: string
}

export function toCurrencyAmount(amountRial: number, preferredUnit: CurrencyUnit = 'IRR'): CurrencyAmount {
  const amountToman = Math.floor(amountRial / 10)
  return {
    amountRial,
    amountToman,
    currency: preferredUnit,
    display:
      preferredUnit === 'IRT'
        ? `${toFaDigits(formatRial(amountToman))} تومان`
        : `${toFaDigits(formatRial(amountRial))} ریال`,
  }
}

export function parseInputAmount(amount: number, unit?: CurrencyUnit): number {
  if (unit === 'IRT') {
    return Math.round(amount * 10)
  }
  return Math.round(amount)
}

export interface AccountSummary extends Account {
  balanceToman: number
  formattedBalance: string
  formattedBalanceToman: string
}

export interface AccountBalanceResult {
  account: AccountSummary
  activeTransactionsCount: number
  lastUpdated?: string
}

export interface TransactionFilter {
  accountId?: string
  categoryId?: string
  kind?: TxKind
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  limit?: number
  offset?: number
}

export interface TransactionDetail extends Transaction {
  amountToman: number
  formattedAmount: string
  accountName: string
  counterpartyAccountName?: string
  categoryName: string
  categoryIcon: string
}

export interface CreateTransactionParams {
  account: string // account ID or account name
  amount: number
  currency?: CurrencyUnit // default IRR
  type: 'expense' | 'income'
  date?: string // YYYY-MM-DD
  category?: string // category ID or name
  description?: string // note
  source?: TxSource
  receiptPhoto?: string
  tags?: string[]
}

export interface UpdateTransactionParams {
  amount?: number
  currency?: CurrencyUnit
  account?: string
  category?: string
  description?: string
  date?: string
  type?: 'expense' | 'income'
  fromAccount?: string
  toAccount?: string
  receiptPhoto?: string
  tags?: string[]
}

export interface CreateTransferParams {
  fromAccount: string // account ID or name
  toAccount: string // account ID or name
  amount: number
  currency?: CurrencyUnit // default IRR
  date?: string // YYYY-MM-DD
  description?: string // note
  source?: TxSource
}

export interface ReportSummary {
  period: string
  totalIncome: CurrencyAmount
  totalExpense: CurrencyAmount
  netSavings: CurrencyAmount
  totalAssets: CurrencyAmount
  monthlyHistory: Array<{
    month: string
    income: CurrencyAmount
    expense: CurrencyAmount
  }>
  categoriesBreakdown: Array<{
    id: string
    name: string
    amount: CurrencyAmount
    percentage: number
  }>
}

/**
 * Resolves an account from ID or account name (case-insensitive fuzzy match).
 */
export function findAccount(accounts: Account[], query: string): Account | undefined {
  if (!query) return undefined
  const clean = query.trim().toLowerCase()
  // Exact ID
  const byId = accounts.find((a) => a.id === query)
  if (byId) return byId

  // Exact Name
  const byName = accounts.find((a) => a.name.trim().toLowerCase() === clean)
  if (byName) return byName

  // Partial Name Match (e.g. "ملت" matches "بانک ملت")
  const partial = accounts.find(
    (a) =>
      a.name.toLowerCase().includes(clean) ||
      clean.includes(a.name.toLowerCase()),
  )
  return partial
}

/**
 * Resolves a category from ID or category name.
 */
export function findCategory(
  query: string,
  kind?: 'expense' | 'income' | 'transfer',
  customCategories: Category[] = [],
): Category | undefined {
  if (!query) return undefined
  const clean = query.trim().toLowerCase()
  const all = [...CATEGORIES, ...customCategories]

  const byId = all.find((c) => c.id === query && (!kind || c.kind === kind))
  if (byId) return byId

  const byName = all.find((c) => c.name.trim().toLowerCase() === clean && (!kind || c.kind === kind))
  if (byName) return byName

  const partial = all.find((c) => c.name.toLowerCase().includes(clean) && (!kind || c.kind === kind))
  return partial
}

function decorateAccount(acc: Account): AccountSummary {
  const toman = Math.floor(acc.balance / 10)
  return {
    ...acc,
    balanceToman: toman,
    formattedBalance: `${toFaDigits(formatRial(acc.balance))} ریال`,
    formattedBalanceToman: `${toFaDigits(formatRial(toman))} تومان`,
  }
}

function decorateTransaction(
  tx: Transaction,
  accounts: Account[],
  customCategories: Category[] = [],
): TransactionDetail {
  const toman = Math.floor(tx.amount / 10)
  const acc = accounts.find((a) => a.id === tx.accountId)
  const counterparty = tx.counterpartyAccountId
    ? accounts.find((a) => a.id === tx.counterpartyAccountId)
    : undefined
  const cat = getCategory(tx.categoryId, customCategories)

  return {
    ...tx,
    amountToman: toman,
    formattedAmount: `${toFaDigits(formatRial(toman))} تومان`,
    accountName: acc?.name ?? 'حساب نامشخص',
    counterpartyAccountName: counterparty?.name,
    categoryName: cat?.name ?? 'سایر',
    categoryIcon: cat?.icon ?? '📦',
  }
}

// ============================================================================
// CORE BUSINESS LOGIC FUNCTIONS
// ============================================================================

/**
 * 1. getAccounts: Returns all active accounts with current computed balance.
 */
export function getAccounts(
  data: AppData,
  options: { includeArchived?: boolean } = {},
): AccountSummary[] {
  const hydrated = hydrateAccounts(data.accounts, data.transactions)
  const filtered = options.includeArchived
    ? hydrated
    : hydrated.filter((a) => !a.archived)
  return filtered
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(decorateAccount)
}

/**
 * 2. getAccountBalance: Returns account details and current balance.
 */
export function getAccountBalance(
  data: AppData,
  accountIdOrName: string,
): AccountBalanceResult {
  const hydrated = hydrateAccounts(data.accounts, data.transactions)
  const account = findAccount(hydrated, accountIdOrName)
  if (!account) {
    throw new Error(`حساب با شناسه یا نام «${accountIdOrName}» یافت نشد`)
  }
  const decorated = decorateAccount(account)
  const txs = data.transactions.filter(
    (t) => t.accountId === account.id || t.counterpartyAccountId === account.id,
  )
  const lastTx = txs.sort((a, b) => b.createdAt - a.createdAt)[0]

  return {
    account: decorated,
    activeTransactionsCount: txs.length,
    lastUpdated: lastTx ? lastTx.date : undefined,
  }
}

/**
 * 3. getTransactions: Queries transactions with flexible filtering & pagination.
 */
export function getTransactions(
  data: AppData,
  filters: TransactionFilter = {},
  customCategories: Category[] = [],
): { total: number; transactions: TransactionDetail[] } {
  let list = data.transactions.slice()

  if (filters.accountId) {
    const acc = findAccount(data.accounts, filters.accountId)
    const targetId = acc ? acc.id : filters.accountId
    list = list.filter((t) => t.accountId === targetId || t.counterpartyAccountId === targetId)
  }

  if (filters.categoryId) {
    list = list.filter((t) => t.categoryId === filters.categoryId)
  }

  if (filters.kind) {
    list = list.filter((t) => t.kind === filters.kind)
  }

  if (filters.startDate) {
    list = list.filter((t) => t.date >= filters.startDate!)
  }

  if (filters.endDate) {
    list = list.filter((t) => t.date <= filters.endDate!)
  }

  if (typeof filters.minAmount === 'number') {
    list = list.filter((t) => t.amount >= filters.minAmount!)
  }

  if (typeof filters.maxAmount === 'number') {
    list = list.filter((t) => t.amount <= filters.maxAmount!)
  }

  // Sort: date desc, createdAt desc
  list.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.createdAt - a.createdAt
  })

  const total = list.length
  const offset = filters.offset ?? 0
  const limit = filters.limit ?? 50
  const paginated = list.slice(offset, offset + limit)

  return {
    total,
    transactions: paginated.map((t) => decorateTransaction(t, data.accounts, customCategories)),
  }
}

/**
 * 4. searchTransactions: Fuzzy search across notes, categories, accounts, and tags.
 */
export function searchTransactions(
  data: AppData,
  query: string,
  limit = 30,
  customCategories: Category[] = [],
): TransactionDetail[] {
  if (!query || !query.trim()) {
    return getTransactions(data, { limit }, customCategories).transactions
  }

  const clean = query.trim().toLowerCase()
  const list = data.transactions.filter((tx) => {
    if (tx.note && tx.note.toLowerCase().includes(clean)) return true
    if (tx.tags && tx.tags.some((t) => t.toLowerCase().includes(clean))) return true
    if (tx.date.includes(clean)) return true

    const cat = getCategory(tx.categoryId, customCategories)
    if (cat && cat.name.toLowerCase().includes(clean)) return true

    const acc = data.accounts.find((a) => a.id === tx.accountId)
    if (acc && acc.name.toLowerCase().includes(clean)) return true

    return false
  })

  list.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.createdAt - a.createdAt
  })

  return list.slice(0, limit).map((t) => decorateTransaction(t, data.accounts, customCategories))
}

/**
 * 5. createTransaction: Validates and creates a new income or expense transaction.
 * Supports preview / dryRun for ChatGPT confirmation flow.
 */
export function createTransaction(
  data: AppData,
  params: CreateTransactionParams,
  options: { dryRun?: boolean; customCategories?: Category[] } = {},
): {
  success: boolean
  transaction: TransactionDetail
  previewData?: { balanceBefore: number; balanceAfter: number; accountName: string }
  nextData: AppData
} {
  const accounts = hydrateAccounts(data.accounts, data.transactions)
  const targetAccount = findAccount(accounts, params.account)
  if (!targetAccount || targetAccount.archived) {
    throw new Error(`حساب «${params.account}» معتبر نیست یا غیرفعال شده است`)
  }

  const amountRial = parseInputAmount(params.amount, params.currency)
  const amountError = validateAmount(amountRial)
  if (amountError) throw new Error(amountError)

  if (params.type === 'expense') {
    const balError = validateExpenseBalance(amountRial, targetAccount.balance)
    if (balError) throw new Error(balError)
  }

  const date = params.date ?? todayIso()
  if (!isValidIsoDate(date)) {
    throw new Error('تاریخ تراکنش نامعتبر است (فرمت استاندارد YYYY-MM-DD)')
  }

  // Resolve Category
  let categoryId = params.category
  if (categoryId) {
    const found = findCategory(categoryId, params.type, options.customCategories)
    if (found) categoryId = found.id
  }
  if (!categoryId) {
    categoryId = params.type === 'expense' ? 'other-exp' : 'other-inc'
  }

  const now = Date.now()
  const tx: Transaction = {
    id: createId('tx'),
    kind: params.type,
    amount: amountRial,
    accountId: targetAccount.id,
    categoryId,
    note: (params.description ?? '').trim(),
    date,
    createdAt: now,
    ...actorStamp(now),
    ...(params.source ? { source: params.source } : {}),
    ...(params.receiptPhoto ? { receiptPhoto: params.receiptPhoto } : {}),
    ...(params.tags && params.tags.length > 0 ? { tags: params.tags } : {}),
  }

  const balanceBefore = targetAccount.balance
  const balanceAfter =
    params.type === 'expense' ? balanceBefore - amountRial : balanceBefore + amountRial

  const nextTransactions = [tx, ...data.transactions]
  const nextData: AppData = {
    ...data,
    transactions: nextTransactions,
  }

  const decorated = decorateTransaction(tx, data.accounts, options.customCategories)

  return {
    success: true,
    transaction: decorated,
    previewData: {
      balanceBefore,
      balanceAfter,
      accountName: targetAccount.name,
    },
    nextData: options.dryRun ? data : nextData,
  }
}

/**
 * 6. updateTransaction: Updates an existing transaction with full validation.
 */
export function updateTransaction(
  data: AppData,
  id: string,
  patch: UpdateTransactionParams,
  options: { dryRun?: boolean; customCategories?: Category[] } = {},
): {
  success: boolean
  transaction: TransactionDetail
  nextData: AppData
} {
  const prevTx = data.transactions.find((t) => t.id === id)
  if (!prevTx) {
    throw new Error('تراکنش پیدا نشد')
  }

  const accounts = hydrateAccounts(data.accounts, data.transactions)

  // Handle transfer transactions
  if (prevTx.kind === 'transferOut' || prevTx.kind === 'transferIn') {
    const outTx = data.transactions.find(
      (t) => t.transferId === prevTx.transferId && t.kind === 'transferOut',
    )
    const inTx = data.transactions.find(
      (t) => t.transferId === prevTx.transferId && t.kind === 'transferIn',
    )
    if (!outTx || !inTx) throw new Error('پایه‌های تراکنش انتقال ناقص است')

    let fromId = outTx.accountId
    if (patch.fromAccount) {
      const acc = findAccount(accounts, patch.fromAccount)
      if (!acc) throw new Error(`حساب مبدأ «${patch.fromAccount}» پیدا نشد`)
      fromId = acc.id
    }

    let toId = inTx.accountId
    if (patch.toAccount) {
      const acc = findAccount(accounts, patch.toAccount)
      if (!acc) throw new Error(`حساب مقصد «${patch.toAccount}» پیدا نشد`)
      toId = acc.id
    }

    const amount = patch.amount
      ? parseInputAmount(patch.amount, patch.currency)
      : outTx.amount
    const note = patch.description != null ? patch.description.trim() : outTx.note
    const date = patch.date ?? outTx.date

    const credited = accounts.map((a) =>
      a.id === fromId ? { ...a, balance: availableAfterReplacing(a.balance, outTx, fromId) } : a,
    )

    const transferErr = validateTransfer(
      { amount, fromAccountId: fromId, toAccountId: toId, note, date },
      credited,
    )
    if (transferErr) throw new Error(transferErr)

    const now = Date.now()
    const nextOut: Transaction = {
      ...outTx,
      amount,
      accountId: fromId,
      counterpartyAccountId: toId,
      note,
      date,
      updatedAt: now,
    }
    const nextIn: Transaction = {
      ...inTx,
      amount,
      accountId: toId,
      counterpartyAccountId: fromId,
      note,
      date,
      updatedAt: now,
    }

    const nextTxs = data.transactions.map((t) => {
      if (t.id === nextOut.id) return nextOut
      if (t.id === nextIn.id) return nextIn
      return t
    })

    const nextData: AppData = { ...data, transactions: nextTxs }
    const decorated = decorateTransaction(
      prevTx.kind === 'transferOut' ? nextOut : nextIn,
      accounts,
      options.customCategories,
    )

    return {
      success: true,
      transaction: decorated,
      nextData: options.dryRun ? data : nextData,
    }
  }

  // Handle standard income / expense
  if (prevTx.installmentItemId && patch.type === 'income') {
    throw new Error('تراکنش قسط را نمی‌توان به درآمد تبدیل کرد')
  }

  const kind = patch.type ?? (prevTx.kind as 'expense' | 'income')
  if (kind !== 'expense' && kind !== 'income') {
    throw new Error('نوع تراکنش نامعتبر است')
  }

  const amount = patch.amount
    ? parseInputAmount(patch.amount, patch.currency)
    : prevTx.amount
  const amountErr = validateAmount(amount)
  if (amountErr) throw new Error(amountErr)

  let accountId = prevTx.accountId
  if (patch.account) {
    const acc = findAccount(accounts, patch.account)
    if (!acc || acc.archived) throw new Error(`حساب «${patch.account}» نامعتبر است`)
    accountId = acc.id
  }
  const targetAccount = accounts.find((a) => a.id === accountId)
  if (!targetAccount) throw new Error('حساب پیدا نشد')

  if (kind === 'expense') {
    const available = availableAfterReplacing(targetAccount.balance, prevTx, accountId)
    const balErr = validateExpenseBalance(amount, available)
    if (balErr) throw new Error(balErr)
  }

  const date = patch.date ?? prevTx.date
  if (!isValidIsoDate(date)) throw new Error('تاریخ نامعتبر است')

  let categoryId = prevTx.categoryId
  if (patch.category && !prevTx.installmentItemId) {
    const cat = findCategory(patch.category, kind, options.customCategories)
    if (cat) categoryId = cat.id
  }

  const nextTx: Transaction = {
    ...prevTx,
    kind,
    amount,
    accountId,
    categoryId: prevTx.installmentItemId ? INSTALLMENT_CATEGORY_ID : categoryId,
    note: patch.description != null ? patch.description.trim() : prevTx.note,
    date,
    updatedAt: Date.now(),
    receiptPhoto: patch.receiptPhoto !== undefined ? patch.receiptPhoto : prevTx.receiptPhoto,
    tags: patch.tags !== undefined ? patch.tags : prevTx.tags,
  }

  const nextItems = prevTx.installmentItemId
    ? data.items.map((item) =>
        item.id === prevTx.installmentItemId ? { ...item, amount } : item,
      )
    : data.items

  const nextData: AppData = {
    ...data,
    transactions: data.transactions.map((t) => (t.id === id ? nextTx : t)),
    items: nextItems,
  }

  const decorated = decorateTransaction(nextTx, accounts, options.customCategories)

  return {
    success: true,
    transaction: decorated,
    nextData: options.dryRun ? data : nextData,
  }
}

/**
 * 7. deleteTransaction: Deletes transaction with cascade handling.
 */
export function deleteTransaction(
  data: AppData,
  id: string,
  options: { dryRun?: boolean; customCategories?: Category[] } = {},
): {
  success: boolean
  deletedTransaction: TransactionDetail
  nextData: AppData
} {
  const tx = data.transactions.find((t) => t.id === id)
  if (!tx) {
    throw new Error('تراکنش پیدا نشد')
  }

  const decorated = decorateTransaction(tx, data.accounts, options.customCategories)
  const nextData = deleteTransactionCascade(id, data)

  return {
    success: true,
    deletedTransaction: decorated,
    nextData: options.dryRun ? data : nextData,
  }
}

/**
 * 8. createTransfer: Creates double-entry transfer (transferOut + transferIn).
 * Supports preview / dryRun for ChatGPT confirmation flow.
 */
export function createTransfer(
  data: AppData,
  params: CreateTransferParams,
  options: { dryRun?: boolean; customCategories?: Category[] } = {},
): {
  success: boolean
  outLeg: TransactionDetail
  inLeg: TransactionDetail
  previewData?: {
    fromAccountName: string
    toAccountName: string
    fromBalanceAfter: number
    toBalanceAfter: number
  }
  nextData: AppData
} {
  const accounts = hydrateAccounts(data.accounts, data.transactions)
  const from = findAccount(accounts, params.fromAccount)
  const to = findAccount(accounts, params.toAccount)

  if (!from || from.archived) throw new Error(`حساب مبدأ «${params.fromAccount}» نامعتبر است`)
  if (!to || to.archived) throw new Error(`حساب مقصد «${params.toAccount}» نامعتبر است`)

  const amountRial = parseInputAmount(params.amount, params.currency)
  const date = params.date ?? todayIso()
  if (!isValidIsoDate(date)) throw new Error('تاریخ انتقال نامعتبر است')

  const input: TransferInput = {
    amount: amountRial,
    fromAccountId: from.id,
    toAccountId: to.id,
    note: (params.description ?? '').trim(),
    date,
    source: params.source,
  }

  const validationError = validateTransfer(input, accounts)
  if (validationError) throw new Error(validationError)

  const now = Date.now()
  const stamp = actorStamp(now)
  const transferId = createId('tr')

  const outTx: Transaction = {
    id: createId('tx'),
    kind: 'transferOut',
    amount: amountRial,
    accountId: from.id,
    counterpartyAccountId: to.id,
    transferId,
    categoryId: 'transfer',
    note: input.note,
    date: input.date,
    createdAt: now,
    ...stamp,
    ...(input.source ? { source: input.source } : {}),
  }

  const inTx: Transaction = {
    id: createId('tx'),
    kind: 'transferIn',
    amount: amountRial,
    accountId: to.id,
    counterpartyAccountId: from.id,
    transferId,
    categoryId: 'transfer',
    note: input.note,
    date: input.date,
    createdAt: now + 1,
    ...stamp,
    updatedAt: now + 1,
    ...(input.source ? { source: input.source } : {}),
  }

  const nextData: AppData = {
    ...data,
    transactions: [outTx, inTx, ...data.transactions],
  }

  return {
    success: true,
    outLeg: decorateTransaction(outTx, accounts, options.customCategories),
    inLeg: decorateTransaction(inTx, accounts, options.customCategories),
    previewData: {
      fromAccountName: from.name,
      toAccountName: to.name,
      fromBalanceAfter: from.balance - amountRial,
      toBalanceAfter: to.balance + amountRial,
    },
    nextData: options.dryRun ? data : nextData,
  }
}

/**
 * 9. getCategories: Returns categorized system & custom categories.
 */
export function getCategories(
  customCategories: Category[] = [],
): {
  expense: Category[]
  income: Category[]
  transfer: Category[]
  all: Category[]
} {
  return {
    expense: categoriesFor('expense', customCategories),
    income: categoriesFor('income', customCategories),
    transfer: CATEGORIES.filter((c) => c.kind === 'transfer'),
    all: [...CATEGORIES, ...customCategories],
  }
}

/**
 * 10. getReports: Computes financial report summary, monthly series & category breakdowns.
 */
export function getReports(
  data: AppData,
  params: { endIso?: string; customCategories?: Category[] } = {},
): ReportSummary {
  const endIso = params.endIso ?? todayIso()
  const custom = params.customCategories ?? []
  const hydrated = hydrateAccounts(data.accounts, data.transactions)

  const { income, expense } = incomeExpenseTotals(data.transactions)
  const net = income - expense
  const totalAssets = hydrated
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0)

  const series = monthlySeries(data.transactions, endIso)
  const history = series.map((s) => ({
    month: s.label,
    income: toCurrencyAmount(s.income),
    expense: toCurrencyAmount(s.expense),
  }))

  // Current month breakdown
  const currentMonthKey = series[series.length - 1]?.label ?? ''
  const catBreakdown = expenseByCategory(data.transactions, currentMonthKey, custom)
  const currentMonthExpenses = catBreakdown.reduce((sum, c) => sum + c.amount, 0)

  const categoriesBreakdown = catBreakdown.map((c) => ({
    id: c.id,
    name: c.name,
    amount: toCurrencyAmount(c.amount),
    percentage: currentMonthExpenses > 0 ? Math.round((c.amount / currentMonthExpenses) * 100) : 0,
  }))

  return {
    period: currentMonthKey,
    totalIncome: toCurrencyAmount(income),
    totalExpense: toCurrencyAmount(expense),
    netSavings: toCurrencyAmount(net),
    totalAssets: toCurrencyAmount(totalAssets),
    monthlyHistory: history,
    categoriesBreakdown,
  }
}

// ============================================================================
// INSTALLMENTS BUSINESS LOGIC
// ============================================================================

export function getInstallmentPlans(data: AppData): InstallmentPlan[] {
  return data.plans.slice().sort((a, b) => a.createdAt - b.createdAt)
}

export function getInstallmentPlan(data: AppData, idOrName: string): { plan: InstallmentPlan; items: InstallmentItem[] } {
  const clean = idOrName.trim().toLowerCase()
  const plan =
    data.plans.find((p) => p.id === idOrName) ||
    data.plans.find((p) => p.name.trim().toLowerCase() === clean) ||
    data.plans.find((p) => p.name.toLowerCase().includes(clean))
  if (!plan) {
    throw new Error(`برنامه اقساط «${idOrName}» یافت نشد`)
  }
  const items = data.items
    .filter((item) => item.planId === plan.id)
    .sort((a, b) => a.index - b.index)
  return { plan, items }
}

export function getInstallmentItems(data: AppData, planId?: string): InstallmentItem[] {
  let list = data.items
  if (planId) {
    list = list.filter((i) => i.planId === planId)
  }
  return list.slice().sort((a, b) => a.index - b.index)
}

export function createInstallmentPlan(
  data: AppData,
  input: CreateInstallmentPlanInput,
): { plan: InstallmentPlan; items: InstallmentItem[]; nextData: AppData } {
  const hydrated = hydrateAccounts(data.accounts, data.transactions)
  const err = validatePlanInput(input, hydrated)
  if (err) throw new Error(err)

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
  const nextData: AppData = {
    ...data,
    plans: [...data.plans, plan],
    items: [...data.items, ...generated],
  }

  return { plan, items: generated, nextData }
}

export function updateInstallmentPlan(
  data: AppData,
  id: string,
  patch: UpdateInstallmentPlanInput,
): { plan: InstallmentPlan; nextData: AppData } {
  const plan = data.plans.find((p) => p.id === id)
  if (!plan) throw new Error('برنامه اقساط پیدا نشد')

  const hydrated = hydrateAccounts(data.accounts, data.transactions)
  const planItems = data.items.filter((i) => i.planId === id)
  const err = validatePlanUpdate(patch, planItems, hydrated)
  if (err) throw new Error(err)

  const now = Date.now()
  const nextPlan: InstallmentPlan = {
    ...plan,
    name: patch.name ? patch.name.trim() : plan.name,
    defaultAccountId: patch.defaultAccountId ?? plan.defaultAccountId,
    updatedAt: now,
  }

  const nextData: AppData = {
    ...data,
    plans: data.plans.map((p) => (p.id === id ? nextPlan : p)),
  }

  return { plan: nextPlan, nextData }
}

export function archiveInstallmentPlan(data: AppData, id: string): { plan: InstallmentPlan; nextData: AppData } {
  const plan = data.plans.find((p) => p.id === id)
  if (!plan) throw new Error('برنامه اقساط پیدا نشد')
  const nextPlan: InstallmentPlan = { ...plan, status: 'archived', updatedAt: Date.now() }
  return {
    plan: nextPlan,
    nextData: { ...data, plans: data.plans.map((p) => (p.id === id ? nextPlan : p)) },
  }
}

export function restoreInstallmentPlan(data: AppData, id: string): { plan: InstallmentPlan; nextData: AppData } {
  const plan = data.plans.find((p) => p.id === id)
  if (!plan) throw new Error('برنامه اقساط پیدا نشد')
  const planItems = data.items.filter((i) => i.planId === id)
  const status = nextPlanStatus({ ...plan, status: 'active' }, planItems, todayIso())
  const nextPlan: InstallmentPlan = { ...plan, status, updatedAt: Date.now() }
  return {
    plan: nextPlan,
    nextData: { ...data, plans: data.plans.map((p) => (p.id === id ? nextPlan : p)) },
  }
}

export function deleteInstallmentPlan(data: AppData, id: string): { nextData: AppData } {
  return { nextData: deletePlanCascade(id, data) }
}

export function deleteInstallmentItem(data: AppData, id: string): { nextData: AppData } {
  return { nextData: deleteInstallmentItemCascade(id, data) }
}

export function payInstallment(
  data: AppData,
  itemId: string,
  accountId: string,
  note?: string,
): { expense: Transaction; item: InstallmentItem; plan: InstallmentPlan; nextData: AppData } {
  const item = data.items.find((i) => i.id === itemId)
  if (!item) throw new Error('قسط پیدا نشد')
  const plan = data.plans.find((p) => p.id === item.planId)
  if (!plan) throw new Error('برنامه اقساط پیدا نشد')
  if (plan.status !== 'active') throw new Error('این برنامه اقساط فعال نیست')

  const today = todayIso()
  if (itemEffectiveStatus(item, today) === 'paid') throw new Error('این قسط قبلاً پرداخت شده است')

  const hydrated = hydrateAccounts(data.accounts, data.transactions)
  const account = hydrated.find((a) => a.id === accountId) || findAccount(hydrated, accountId)
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

  const allItems = data.items.map((row) => (row.id === paidItem.id ? paidItem : row))
  const planItems = allItems.filter((row) => row.planId === plan.id)
  const nextPlan: InstallmentPlan = {
    ...plan,
    status: nextPlanStatus({ ...plan, status: 'active' }, planItems, today),
    updatedAt: now,
  }

  const nextData: AppData = {
    ...data,
    transactions: [expense, ...data.transactions],
    items: allItems,
    plans: data.plans.map((row) => (row.id === plan.id ? nextPlan : row)),
  }

  return { expense, item: paidItem, plan: nextPlan, nextData }
}

export function unpayInstallment(data: AppData, itemId: string): { nextData: AppData } {
  return { nextData: unpayInstallmentItem(itemId, data) }
}

// ============================================================================
// ACCOUNT MANAGEMENT EXTENSIONS
// ============================================================================

export function createAccount(
  data: AppData,
  input: CreateAccountInput & { currency?: CurrencyUnit },
): { account: AccountSummary; nextData: AppData } {
  const name = input.name.trim()
  if (!name) throw new Error('نام حساب نمی‌تواند خالی باشد')

  const existing = data.accounts.find((a) => a.name.trim().toLowerCase() === name.toLowerCase())
  if (existing) throw new Error(`حسابی با نام «${name}» قبلاً ثبت شده است`)

  const initialRials = parseInputAmount(input.initialBalance || 0, input.currency)
  const now = Date.now()

  const newAccount: Account = {
    id: createId('acc'),
    name,
    type: input.type,
    classification: input.classification || (input.type === 'bank' ? 'credit' : 'cash'),
    archived: false,
    openingBalance: initialRials,
    balance: initialRials,
    createdAt: now,
    updatedAt: now,
    accountNumber: input.accountNumber?.trim() || undefined,
    cardId: input.cardId || undefined,
  }

  const nextAccounts = [...data.accounts, newAccount]
  const nextData: AppData = { ...data, accounts: nextAccounts }

  return {
    account: decorateAccount(newAccount),
    nextData,
  }
}

export function updateAccount(
  data: AppData,
  id: string,
  patch: { name?: string; type?: 'cash' | 'bank'; accountNumber?: string },
): { account: AccountSummary; nextData: AppData } {
  const acc = data.accounts.find((a) => a.id === id)
  if (!acc) throw new Error('حساب پیدا نشد')

  const updated: Account = {
    ...acc,
    name: patch.name ? patch.name.trim() : acc.name,
    type: patch.type || acc.type,
    accountNumber: patch.accountNumber !== undefined ? patch.accountNumber.trim() : acc.accountNumber,
    updatedAt: Date.now(),
  }

  const nextAccounts = data.accounts.map((a) => (a.id === id ? updated : a))
  const hydrated = hydrateAccounts(nextAccounts, data.transactions)
  const found = hydrated.find((a) => a.id === id)!

  return {
    account: decorateAccount(found),
    nextData: { ...data, accounts: nextAccounts },
  }
}

export function archiveAccount(data: AppData, id: string): { account: AccountSummary; nextData: AppData } {
  const acc = data.accounts.find((a) => a.id === id)
  if (!acc) throw new Error('حساب پیدا نشد')

  const updated: Account = { ...acc, archived: true, updatedAt: Date.now() }
  const nextAccounts = data.accounts.map((a) => (a.id === id ? updated : a))
  const hydrated = hydrateAccounts(nextAccounts, data.transactions)
  const found = hydrated.find((a) => a.id === id)!

  return {
    account: decorateAccount(found),
    nextData: { ...data, accounts: nextAccounts },
  }
}

export function restoreAccount(data: AppData, id: string): { account: AccountSummary; nextData: AppData } {
  const acc = data.accounts.find((a) => a.id === id)
  if (!acc) throw new Error('حساب پیدا نشد')

  const updated: Account = { ...acc, archived: false, updatedAt: Date.now() }
  const nextAccounts = data.accounts.map((a) => (a.id === id ? updated : a))
  const hydrated = hydrateAccounts(nextAccounts, data.transactions)
  const found = hydrated.find((a) => a.id === id)!

  return {
    account: decorateAccount(found),
    nextData: { ...data, accounts: nextAccounts },
  }
}

// ============================================================================
// CHEQUES BUSINESS LOGIC (مدیریت چک‌ها)
// ============================================================================

export function getCheques(
  data: AppData,
  filter?: { status?: ChequeStatus; direction?: ChequeDirection },
): Cheque[] {
  let list = data.cheques || []
  if (filter?.status) {
    list = list.filter((c) => c.status === filter.status)
  }
  if (filter?.direction) {
    list = list.filter((c) => c.direction === filter.direction)
  }
  return list.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function getCheque(data: AppData, id: string): Cheque {
  const cheque = (data.cheques || []).find((c) => c.id === id || c.sayadId === id)
  if (!cheque) throw new Error(`چک با شناسه «${id}» یافت نشد`)
  return cheque
}

export function createCheque(
  data: AppData,
  input: {
    direction: ChequeDirection
    sayadId: string
    bankName: string
    amount: number
    dueDate: string
    party: string
    note?: string
    accountId?: string
    currency?: CurrencyUnit
  },
): { cheque: Cheque; nextData: AppData } {
  const amountRials = parseInputAmount(input.amount, input.currency)
  if (amountRials <= 0) throw new Error('مبلغ چک باید بیشتر از صفر باشد')
  if (!isValidIsoDate(input.dueDate)) throw new Error('تاریخ سررسید نامعتبر است (فرمت YYYY-MM-DD)')

  const newCheque: Cheque = {
    id: createId('chq'),
    direction: input.direction,
    sayadId: input.sayadId.trim(),
    bankName: input.bankName.trim(),
    amount: amountRials,
    dueDate: input.dueDate,
    party: input.party.trim(),
    status: 'pending',
    accountId: input.accountId,
    note: (input.note || '').trim(),
    createdAt: Date.now(),
  }

  const nextCheques = [...(data.cheques || []), newCheque]
  return {
    cheque: newCheque,
    nextData: { ...data, cheques: nextCheques },
  }
}

export function updateChequeStatus(
  data: AppData,
  id: string,
  status: ChequeStatus,
  clearedDate?: string,
): { cheque: Cheque; nextData: AppData } {
  const cheque = (data.cheques || []).find((c) => c.id === id)
  if (!cheque) throw new Error('چک پیدا نشد')

  const updated: Cheque = {
    ...cheque,
    status,
    clearedAt: status === 'cleared' ? (clearedDate || todayIso()) : undefined,
  }

  const nextCheques = (data.cheques || []).map((c) => (c.id === id ? updated : c))
  return {
    cheque: updated,
    nextData: { ...data, cheques: nextCheques },
  }
}

export function deleteCheque(data: AppData, id: string): { nextData: AppData } {
  const exists = (data.cheques || []).some((c) => c.id === id)
  if (!exists) throw new Error('چک پیدا نشد')

  const nextCheques = (data.cheques || []).filter((c) => c.id !== id)
  return { nextData: { ...data, cheques: nextCheques } }
}

// ============================================================================
// DEBTS & LOANS BUSINESS LOGIC (بدهی و طلب)
// ============================================================================

export function getDebts(
  data: AppData,
  filter?: { status?: DebtLoanStatus; direction?: DebtLoanDirection },
): DebtLoan[] {
  let list = data.debts || []
  if (filter?.status) {
    list = list.filter((d) => d.status === filter.status)
  }
  if (filter?.direction) {
    list = list.filter((d) => d.direction === filter.direction)
  }
  return list.slice().sort((a, b) => b.createdAt - a.createdAt)
}

export function getDebt(data: AppData, id: string): DebtLoan {
  const debt = (data.debts || []).find((d) => d.id === id)
  if (!debt) throw new Error(`مورد بدهی یا طلب با شناسه «${id}» یافت نشد`)
  return debt
}

export function createDebt(
  data: AppData,
  input: {
    direction: DebtLoanDirection
    party: string
    amount: number
    dueDate?: string
    note?: string
    accountId?: string
    currency?: CurrencyUnit
  },
): { debt: DebtLoan; nextData: AppData } {
  const amountRials = parseInputAmount(input.amount, input.currency)
  if (amountRials <= 0) throw new Error('مبلغ باید بیشتر از صفر باشد')

  const newDebt: DebtLoan = {
    id: createId('debt'),
    direction: input.direction,
    party: input.party.trim(),
    amount: amountRials,
    dueDate: input.dueDate,
    accountId: input.accountId,
    note: (input.note || '').trim(),
    status: 'active',
    createdAt: Date.now(),
  }

  const nextDebts = [...(data.debts || []), newDebt]
  return {
    debt: newDebt,
    nextData: { ...data, debts: nextDebts },
  }
}

export function settleDebt(
  data: AppData,
  id: string,
  accountId?: string,
): { debt: DebtLoan; nextData: AppData } {
  const debt = (data.debts || []).find((d) => d.id === id)
  if (!debt) throw new Error('طلب یا بدهی پیدا نشد')

  const now = todayIso()
  const updated: DebtLoan = {
    ...debt,
    status: 'settled',
    settledAt: now,
    accountId: accountId || debt.accountId,
  }

  const nextDebts = (data.debts || []).map((d) => (d.id === id ? updated : d))
  return {
    debt: updated,
    nextData: { ...data, debts: nextDebts },
  }
}

export function unsettleDebt(data: AppData, id: string): { debt: DebtLoan; nextData: AppData } {
  const debt = (data.debts || []).find((d) => d.id === id)
  if (!debt) throw new Error('طلب یا بدهی پیدا نشد')

  const updated: DebtLoan = {
    ...debt,
    status: 'active',
    settledAt: undefined,
  }

  const nextDebts = (data.debts || []).map((d) => (d.id === id ? updated : d))
  return {
    debt: updated,
    nextData: { ...data, debts: nextDebts },
  }
}

export function deleteDebt(data: AppData, id: string): { nextData: AppData } {
  const exists = (data.debts || []).some((d) => d.id === id)
  if (!exists) throw new Error('طلب یا بدهی پیدا نشد')

  const nextDebts = (data.debts || []).filter((d) => d.id !== id)
  return { nextData: { ...data, debts: nextDebts } }
}

// ============================================================================
// BANK CARDS BUSINESS LOGIC (کارت‌های بانکی)
// ============================================================================

export function getCards(data: AppData): BankCard[] {
  return (data.cards || []).slice().sort((a, b) => b.createdAt - a.createdAt)
}

export function getCard(data: AppData, id: string): BankCard {
  const card = (data.cards || []).find((c) => c.id === id)
  if (!card) throw new Error(`کارت با شناسه «${id}» یافت نشد`)
  return card
}

export function createCard(
  data: AppData,
  input: {
    bankName: string
    holder: string
    pan: string
    expiry?: string
    cvv?: string
    sheba?: string
    note?: string
    accountId?: string
    color?: string
  },
): { card: BankCard; nextData: AppData } {
  const pan = input.pan.replace(/\s+/g, '')
  if (pan.length < 16) throw new Error('شماره کارت باید حداقل ۱۶ رقم باشد')

  const newCard: BankCard = {
    id: createId('card'),
    bankName: input.bankName.trim(),
    holder: input.holder.trim(),
    pan,
    expiry: input.expiry || '',
    cvv: input.cvv || '',
    sheba: input.sheba ? input.sheba.trim().toUpperCase() : '',
    note: (input.note || '').trim(),
    accountId: input.accountId,
    color: input.color,
    createdAt: Date.now(),
  }

  const nextCards = [...(data.cards || []), newCard]
  return {
    card: newCard,
    nextData: { ...data, cards: nextCards },
  }
}

export function linkCardToAccount(
  data: AppData,
  cardId: string,
  accountId: string,
): { card: BankCard; nextData: AppData } {
  const card = (data.cards || []).find((c) => c.id === cardId)
  if (!card) throw new Error('کارت پیدا نشد')

  const account = data.accounts.find((a) => a.id === accountId)
  if (!account) throw new Error('حساب بانکی پیدا نشد')

  const updatedCard: BankCard = { ...card, accountId }
  const updatedAccount: Account = { ...account, cardId, updatedAt: Date.now() }

  const nextCards = (data.cards || []).map((c) => (c.id === cardId ? updatedCard : c))
  const nextAccounts = data.accounts.map((a) => (a.id === accountId ? updatedAccount : a))

  return {
    card: updatedCard,
    nextData: { ...data, cards: nextCards, accounts: nextAccounts },
  }
}

export function deleteCard(data: AppData, id: string): { nextData: AppData } {
  const exists = (data.cards || []).some((c) => c.id === id)
  if (!exists) throw new Error('کارت پیدا نشد')

  const nextCards = (data.cards || []).filter((c) => c.id !== id)
  return { nextData: { ...data, cards: nextCards } }
}

// ============================================================================
// SAVINGS GOALS BUSINESS LOGIC (اهداف پس‌انداز و قلک)
// ============================================================================

export function getSavingsGoals(data: AppData): SavingsGoal[] {
  return (data.goals || []).slice()
}

export function getSavingsGoal(data: AppData, id: string): SavingsGoal {
  const goal = (data.goals || []).find((g) => g.id === id || g.name.toLowerCase() === id.toLowerCase())
  if (!goal) throw new Error(`هدف پس‌انداز «${id}» یافت نشد`)
  return goal
}

export function createSavingsGoal(
  data: AppData,
  input: {
    name: string
    target: number
    saved?: number
    market?: 'bank' | 'gold' | 'stock' | 'crypto' | 'cash'
    targetDate?: string
    icon?: string
    note?: string
    currency?: CurrencyUnit
  },
): { goal: SavingsGoal; nextData: AppData } {
  const targetRials = parseInputAmount(input.target, input.currency)
  const savedRials = parseInputAmount(input.saved || 0, input.currency)

  const newGoal: SavingsGoal = {
    id: createId('goal'),
    name: input.name.trim(),
    target: targetRials,
    saved: savedRials,
    market: input.market || 'bank',
    targetDate: input.targetDate,
    icon: input.icon || '🎯',
    note: input.note?.trim(),
    createdAt: Date.now(),
  }

  const nextGoals = [...(data.goals || []), newGoal]
  return {
    goal: newGoal,
    nextData: { ...data, goals: nextGoals },
  }
}

export function updateSavingsGoal(
  data: AppData,
  id: string,
  patch: { saved?: number; target?: number; name?: string; currency?: CurrencyUnit },
): { goal: SavingsGoal; nextData: AppData } {
  const goal = (data.goals || []).find((g) => g.id === id)
  if (!goal) throw new Error('هدف پس‌انداز پیدا نشد')

  const updated: SavingsGoal = {
    ...goal,
    name: patch.name ? patch.name.trim() : goal.name,
    target: patch.target != null ? parseInputAmount(patch.target, patch.currency) : goal.target,
    saved: patch.saved != null ? parseInputAmount(patch.saved, patch.currency) : goal.saved,
  }

  const nextGoals = (data.goals || []).map((g) => (g.id === id ? updated : g))
  return {
    goal: updated,
    nextData: { ...data, goals: nextGoals },
  }
}

export function deleteSavingsGoal(data: AppData, id: string): { nextData: AppData } {
  const nextGoals = (data.goals || []).filter((g) => g.id !== id)
  return { nextData: { ...data, goals: nextGoals } }
}

// ============================================================================
// INVESTMENTS BUSINESS LOGIC (سرمایه‌گذاری و دارایی‌ها)
// ============================================================================

export function getInvestments(data: AppData): InvestmentAsset[] {
  return (data.investments || []).slice()
}

export function getInvestment(data: AppData, id: string): InvestmentAsset {
  const asset = (data.investments || []).find((a) => a.id === id || a.name.toLowerCase() === id.toLowerCase())
  if (!asset) throw new Error(`دارایی سرمایه‌گذاری «${id}» یافت نشد`)
  return asset
}

export function createInvestment(
  data: AppData,
  input: {
    name: string
    market: 'gold' | 'stock' | 'fund' | 'crypto' | 'bank' | 'property' | 'other'
    purchaseAmount: number
    currentValue: number
    quantity?: number
    unitPrice?: number
    currentUnitPrice?: number
    purchaseDate?: string
    note?: string
    currency?: CurrencyUnit
  },
): { asset: InvestmentAsset; nextData: AppData } {
  const purchaseRials = parseInputAmount(input.purchaseAmount, input.currency)
  const currentRials = parseInputAmount(input.currentValue, input.currency)
  const now = Date.now()

  const newAsset: InvestmentAsset = {
    id: createId('inv'),
    name: input.name.trim(),
    market: input.market,
    purchaseAmount: purchaseRials,
    currentValue: currentRials,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currentUnitPrice: input.currentUnitPrice,
    purchaseDate: input.purchaseDate || todayIso(),
    note: input.note?.trim(),
    createdAt: now,
    updatedAt: now,
  }

  const nextInvestments = [...(data.investments || []), newAsset]
  return {
    asset: newAsset,
    nextData: { ...data, investments: nextInvestments },
  }
}

export function updateInvestment(
  data: AppData,
  id: string,
  patch: { currentValue?: number; currentUnitPrice?: number; note?: string; currency?: CurrencyUnit },
): { asset: InvestmentAsset; nextData: AppData } {
  const asset = (data.investments || []).find((a) => a.id === id)
  if (!asset) throw new Error('دارایی سرمایه‌گذاری پیدا نشد')

  const updated: InvestmentAsset = {
    ...asset,
    currentValue: patch.currentValue != null ? parseInputAmount(patch.currentValue, patch.currency) : asset.currentValue,
    currentUnitPrice: patch.currentUnitPrice != null ? patch.currentUnitPrice : asset.currentUnitPrice,
    note: patch.note !== undefined ? patch.note.trim() : asset.note,
    updatedAt: Date.now(),
  }

  const nextInvestments = (data.investments || []).map((a) => (a.id === id ? updated : a))
  return {
    asset: updated,
    nextData: { ...data, investments: nextInvestments },
  }
}

export function deleteInvestment(data: AppData, id: string): { nextData: AppData } {
  const nextInvestments = (data.investments || []).filter((a) => a.id !== id)
  return { nextData: { ...data, investments: nextInvestments } }
}

// ============================================================================
// REMINDERS & DUE DATES (یادآورها و موعد سررسید)
// ============================================================================

export function getRemindersSettings(data: AppData): ReminderSettings {
  return data.reminders || { enabled: false, leadDays: 2 }
}

export function updateRemindersSettings(
  data: AppData,
  settings: ReminderSettings,
): { settings: ReminderSettings; nextData: AppData } {
  return {
    settings,
    nextData: { ...data, reminders: settings },
  }
}

export interface UpcomingReminderItem {
  id: string
  type: 'installment' | 'cheque' | 'debt'
  title: string
  dueDate: string
  amount: number
  amountToman: number
  formattedAmount: string
  daysLeft: number
  isOverdue: boolean
}

export function getUpcomingReminders(data: AppData, leadDays = 7): UpcomingReminderItem[] {
  const today = todayIso()
  const reminders: UpcomingReminderItem[] = []

  // 1. Installments
  for (const plan of data.plans) {
    if (plan.status !== 'active') continue
    const items = data.items.filter((i) => i.planId === plan.id && i.status !== 'paid')
    for (const item of items) {
      const days = Math.round((new Date(item.dueDate).getTime() - new Date(today).getTime()) / (86400 * 1000))
      if (days <= leadDays) {
        reminders.push({
          id: item.id,
          type: 'installment',
          title: `${plan.name} (قسط ${item.index})`,
          dueDate: item.dueDate,
          amount: item.amount,
          amountToman: Math.floor(item.amount / 10),
          formattedAmount: `${toFaDigits(formatRial(Math.floor(item.amount / 10)))} تومان`,
          daysLeft: days,
          isOverdue: days < 0,
        })
      }
    }
  }

  // 2. Cheques (پرداختی‌های در انتظار)
  for (const cheque of data.cheques || []) {
    if (cheque.status !== 'pending') continue
    const days = Math.round((new Date(cheque.dueDate).getTime() - new Date(today).getTime()) / (86400 * 1000))
    if (days <= leadDays) {
      reminders.push({
        id: cheque.id,
        type: 'cheque',
        title: `چک ${cheque.direction === 'payable' ? 'پرداختی' : 'دریافتی'}: ${cheque.party} (${cheque.bankName})`,
        dueDate: cheque.dueDate,
        amount: cheque.amount,
        amountToman: Math.floor(cheque.amount / 10),
        formattedAmount: `${toFaDigits(formatRial(Math.floor(cheque.amount / 10)))} تومان`,
        daysLeft: days,
        isOverdue: days < 0,
      })
    }
  }

  // 3. Debts (بدهی‌های سررسیددار)
  for (const debt of data.debts || []) {
    if (debt.status !== 'active' || !debt.dueDate) continue
    const days = Math.round((new Date(debt.dueDate).getTime() - new Date(today).getTime()) / (86400 * 1000))
    if (days <= leadDays) {
      reminders.push({
        id: debt.id,
        type: 'debt',
        title: `${debt.direction === 'borrowed' ? 'بدهی به' : 'طلب از'}: ${debt.party}`,
        dueDate: debt.dueDate,
        amount: debt.amount,
        amountToman: Math.floor(debt.amount / 10),
        formattedAmount: `${toFaDigits(formatRial(Math.floor(debt.amount / 10)))} تومان`,
        daysLeft: days,
        isOverdue: days < 0,
      })
    }
  }

  reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return reminders
}


