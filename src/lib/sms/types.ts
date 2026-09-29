/** Review queue for a bank SMS. This is not a ledger transaction. */

export type SmsDirection = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'UNKNOWN'
export type SmsCurrency = 'IRR' | 'IRT'
export type DraftStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'
export type DraftSource = 'SMS' | 'MANUAL'

export interface SmsSettings {
  enableDetection: boolean
  autoDetect: boolean
  showNotifications: boolean
  /** Default off. OTP-like messages are never stored even when this is on. */
  saveOriginalSms: boolean
  descriptionRequired: boolean
  /** How pending amounts are labeled. Never used to guess a missing unit. */
  displayUnit: SmsCurrency
}

export interface ParsedBankSms {
  parserId: string
  parserVersion: string
  bankId: string
  bankLabel: string
  direction: SmsDirection
  /** Integer in the SMS unit. Null when no amount was found. */
  amountMinor: number | null
  currency: SmsCurrency | null
  /** Integer rials. Null until the SMS itself names ریال or تومان. */
  amountRial: number | null
  date: string | null
  time: string | null
  maskedCard: string | null
  balanceAfterRial: number | null
  reference: string | null
  confidence: number
  needsReview: boolean
  containsSecret: boolean
}

export interface TransactionDraft {
  id: string
  source: DraftSource
  sourceMessageHash: string
  bankId: string
  bankLabel: string
  accountId: string | null
  counterpartyAccountId: string | null
  direction: SmsDirection
  /** Digits found in the SMS, before a unit is chosen. */
  amountMinor: number | null
  amountRial: number | null
  currency: SmsCurrency | null
  transactionDate: string
  transactionTime: string | null
  dateFromMessage: boolean
  balanceAfterRial: number | null
  maskedCardNumber: string | null
  bankReference: string | null
  sender: string
  originalMessage: string | null
  parserVersion: string
  parserId: string
  confidence: number
  needsReview: boolean
  status: DraftStatus
  categoryId: string | null
  description: string
  createdAt: number
  confirmedAt: number | null
  rejectedAt: number | null
}

export interface SeenSms {
  hash: string
  outcome: 'pending' | 'confirmed' | 'rejected'
  at: number
}

export interface DraftState {
  settings: SmsSettings
  drafts: TransactionDraft[]
  seen: SeenSms[]
}

export interface InboundSms {
  sender: string
  body: string
  receivedAt?: number
  mode: 'bridge' | 'manual-import'
}

export type IngestResult =
  | { status: 'created'; draftId: string; needsReview: boolean }
  | { status: 'duplicate' }
  | { status: 'ignored'; reason: 'otp' | 'not-bank' | 'empty' | 'disabled' }
  | { status: 'error'; message: string }

export interface DraftConfirmInput {
  direction: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  amountRial: number
  accountId: string
  counterpartyAccountId?: string
  categoryId: string
  description: string
  date: string
}

export interface BankParser {
  id: string
  label: string
  priority: number
  matches(text: string): boolean
  parse(text: string, receivedAt: number): ParsedBankSms | { ignored: 'otp' | 'not-bank' }
}

/** Host object a future native shell may install. The PWA never creates it. */
export interface NativeSmsHost {
  subscribe(handler: (message: { sender: string; body: string; receivedAt?: number }) => void): () => void
  capabilities?: { readInbox?: boolean }
}
