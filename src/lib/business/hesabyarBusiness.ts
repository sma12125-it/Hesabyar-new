import { hydrateAccounts, incomeExpenseTotals } from '../balance'
import { deleteTransactionCascade, type AppData } from '../cascade'
import {
  CATEGORIES,
  INSTALLMENT_CATEGORY_ID,
  categoriesFor,
  getCategory,
} from '../categories'
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
  Category,
  CurrencyUnit,
  Transaction,
  TransferInput,
  TxKind,
  TxSource,
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
