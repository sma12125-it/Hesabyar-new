export type AccountType = 'cash' | 'bank'
export type TxKind = 'expense' | 'income' | 'transferOut' | 'transferIn'
/** @deprecated Sprint 1 single-leg transfer; migrated to transferOut + transferIn */
export type LegacyTxKind = TxKind | 'transfer'

export type InstallmentPlanStatus = 'active' | 'completed' | 'archived'
export type InstallmentItemStatus = 'pending' | 'paid' | 'overdue'
export type PlanBadge = 'overdue' | 'due-soon' | 'ok'

export interface Account {
  id: string
  name: string
  type: AccountType
  archived: boolean
  /** Immutable after create. Balance is computed from this + transactions. */
  openingBalance: number
  /** Computed: openingBalance + income − expense − transferOut + transferIn */
  balance: number
  createdAt: number
  updatedAt: number
  /** Vault card this bank account was opened from. */
  cardId?: string
  /** Cloud ledger shared with another signed-in user. */
  shareId?: string
}

/** Absent on older rows, which stay manual entries. */
export type TxSource = 'sms' | 'manual'

export interface Transaction {
  id: string
  kind: TxKind
  amount: number
  accountId: string
  counterpartyAccountId?: string
  transferId?: string
  installmentItemId?: string
  categoryId: string
  note: string
  /** ISO Gregorian calendar date (YYYY-MM-DD). */
  date: string
  createdAt: number
  updatedAt?: number
  /** Email of the signed-in user who recorded this row. */
  actorEmail?: string
  /** Set when a reviewed bank SMS is confirmed. Older rows omit this and stay manual. */
  source?: TxSource
  /** Optional base64 compressed receipt or invoice image */
  receiptPhoto?: string
  /** Optional hashtags or labels e.g. ['سفر', 'تعمیرات'] */
  tags?: string[]
}

export interface Category {
  id: string
  name: string
  icon: string
  kind: 'expense' | 'income' | 'transfer'
}

export type InstallmentPlanKind = 'fixed' | 'loan'

export interface InstallmentPlan {
  id: string
  name: string
  installmentAmount: number
  totalCount: number
  startDate: string
  defaultAccountId: string
  categoryId: 'installments'
  status: InstallmentPlanStatus
  /** Default `fixed` for Sprint 2 plans. `loan` uses declining-balance amortization. */
  kind?: InstallmentPlanKind
  principal?: number
  annualRatePercent?: number
  createdAt: number
  updatedAt: number
}

export interface InstallmentItem {
  id: string
  planId: string
  index: number
  dueDate: string
  amount: number
  status: InstallmentItemStatus
  paidAt?: string
  transactionId?: string
}

export interface CreateAccountInput {
  name: string
  type: AccountType
  initialBalance: number
  cardId?: string
}

export interface QuickEntryInput {
  kind: 'expense' | 'income'
  amount: number
  accountId: string
  categoryId: string
  note: string
  date?: string
  source?: TxSource
  receiptPhoto?: string
  tags?: string[]
}

export interface TransferInput {
  amount: number
  fromAccountId: string
  toAccountId: string
  note: string
  date: string
  source?: TxSource
}

export interface CreateInstallmentPlanInput {
  name: string
  installmentAmount: number
  totalCount: number
  startDate: string
  defaultAccountId: string
  kind?: InstallmentPlanKind
  principal?: number
  annualRatePercent?: number
}

export interface UpdateInstallmentPlanInput {
  name?: string
  defaultAccountId?: string
  installmentAmount?: number
  totalCount?: number
  startDate?: string
  kind?: InstallmentPlanKind
  principal?: number
  annualRatePercent?: number
}

export interface UpdateTransactionInput {
  amount?: number
  accountId?: string
  categoryId?: string
  note?: string
  date?: string
  kind?: 'expense' | 'income'
  fromAccountId?: string
  toAccountId?: string
  receiptPhoto?: string
  tags?: string[]
}

export interface UpdateInstallmentItemInput {
  amount?: number
  dueDate?: string
}

export type CardMarket = 'gold' | 'stock' | 'crypto' | 'fund' | 'bank' | 'cash'

export interface BankCard {
  id: string
  bankName: string
  holder: string
  pan: string
  expiry: string
  cvv: string
  sheba: string
  note: string
  createdAt: number
  accountId?: string
  /** CSS gradient or solid color chosen from the palette. */
  color?: string
}

export interface Budget {
  id: string
  categoryId: string
  monthlyLimit: number
}

export interface SavingsGoal {
  id: string
  name: string
  target: number
  saved: number
  market: CardMarket
}

export interface ReminderSettings {
  enabled: boolean
  leadDays: number
}

export type CurrencyUnit = 'IRT' | 'IRR'

export type ChequeDirection = 'payable' | 'receivable'
export type ChequeStatus = 'pending' | 'cleared' | 'bounced'

export interface Cheque {
  id: string
  direction: ChequeDirection
  sayadId: string
  bankName: string
  amount: number
  dueDate: string
  party: string
  status: ChequeStatus
  accountId?: string
  note: string
  createdAt: number
  clearedAt?: string
  transactionId?: string
}

