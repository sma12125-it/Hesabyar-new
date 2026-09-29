import { getKv, setKv } from '../../db/db'
import { createId } from '../ids'
import { isoFromTimestamp, isValidIsoDate } from '../iso'
import { validateAmount } from '../money'
import type { QuickEntryInput, TransferInput } from '../../types'
import { suggestCategory } from './categorize'
import { smsFingerprint } from './fingerprint'
import { parseBankSms } from './parsers'
import type {
  DraftConfirmInput,
  DraftState,
  InboundSms,
  IngestResult,
  SeenSms,
  SmsSettings,
  TransactionDraft,
} from './types'

export const SMS_STATE_KEY = 'smsDraftState'
export const SMS_CHANGED = 'hy-sms-drafts'

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  enableDetection: true,
  autoDetect: true,
  showNotifications: false,
  saveOriginalSms: false,
  descriptionRequired: false,
  displayUnit: 'IRR',
}

export interface SmsStateStore {
  load(): Promise<DraftState>
  save(state: DraftState): Promise<void>
}

const kvStore: SmsStateStore = {
  async load() {
    return normalizeState(await getKv<DraftState>(SMS_STATE_KEY))
  },
  async save(state) {
    await setKv(SMS_STATE_KEY, state)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SMS_CHANGED))
  },
}

export function memorySmsStore(seed?: Partial<DraftState>): SmsStateStore {
  let state = normalizeState(seed as DraftState | undefined)
  return {
    async load() {
      return structuredClone(state)
    },
    async save(next) {
      state = structuredClone(next)
    },
  }
}

export async function loadSmsState(store: SmsStateStore = kvStore): Promise<DraftState> {
  return store.load()
}

export async function saveSmsSettings(patch: Partial<SmsSettings>, store: SmsStateStore = kvStore): Promise<SmsSettings> {
  const state = await store.load()
  state.settings = { ...state.settings, ...patch }
  await store.save(state)
  return state.settings
}

export async function clearSmsDrafts(store: SmsStateStore = kvStore): Promise<void> {
  const state = await store.load()
  state.drafts = []
  state.seen = []
  await store.save(state)
}

export async function ingestBankSms(message: InboundSms, store: SmsStateStore = kvStore): Promise<IngestResult> {
  const state = await store.load()
  if (!state.settings.enableDetection) return { status: 'ignored', reason: 'disabled' }
  if (message.mode === 'bridge' && !state.settings.autoDetect) return { status: 'ignored', reason: 'disabled' }
  const body = message.body.trim()
  if (!body) return { status: 'ignored', reason: 'empty' }
  const receivedAt = message.receivedAt ?? Date.now()
  const parsed = parseBankSms(body, receivedAt)
  if (parsed.kind === 'error') {
    return { status: 'error', message: 'امکان تشخیص خودکار این پیام وجود نداشت.' }
  }
  if (parsed.kind === 'ignored') return { status: 'ignored', reason: parsed.reason }

  const value = parsed.value
  const amountKey = value.amountMinor == null ? 'none' : `${value.currency ?? 'unitless'}:${value.amountMinor}`
  const hash = smsFingerprint({
    sender: message.sender.trim(),
    normalizedMessage: parsed.normalized,
    amountKey,
    reference: value.reference ?? '',
    maskedCard: value.maskedCard ?? '',
  })
  if (state.seen.some((row) => row.hash === hash) || state.drafts.some((row) => row.sourceMessageHash === hash)) {
    return { status: 'duplicate' }
  }

  const draft: TransactionDraft = {
    id: createId('draft'),
    source: message.mode === 'manual-import' ? 'MANUAL' : 'SMS',
    sourceMessageHash: hash,
    bankId: value.bankId,
    bankLabel: value.bankLabel,
    accountId: null,
    counterpartyAccountId: null,
    direction: value.direction,
    amountMinor: value.amountMinor,
    amountRial: value.amountRial,
    currency: value.currency,
    transactionDate: value.date ?? isoFromTimestamp(receivedAt),
    transactionTime: value.time,
    dateFromMessage: value.date != null,
    balanceAfterRial: value.balanceAfterRial,
    maskedCardNumber: value.maskedCard,
    bankReference: value.reference,
    sender: message.sender.trim().slice(0, 40),
    originalMessage: state.settings.saveOriginalSms && !value.containsSecret ? body.slice(0, 500) : null,
    parserVersion: value.parserVersion,
    parserId: value.parserId,
    confidence: value.confidence,
    needsReview: value.needsReview,
    status: 'PENDING',
    categoryId: suggestCategory(parsed.normalized, value.direction),
    description: '',
    createdAt: receivedAt,
    confirmedAt: null,
    rejectedAt: null,
  }
  state.drafts = [draft, ...state.drafts].slice(0, 200)
  state.seen = remember(state.seen, { hash, outcome: 'pending', at: receivedAt })
  await store.save(state)
  if (message.mode === 'bridge') void notifyPending(state.settings)
  return { status: 'created', draftId: draft.id, needsReview: draft.needsReview }
}

export async function rejectDraft(id: string, store: SmsStateStore = kvStore): Promise<void> {
  const state = await store.load()
  const draft = state.drafts.find((row) => row.id === id && row.status === 'PENDING')
  if (!draft) throw new Error('این مورد دیگر در انتظار تأیید نیست')
  draft.status = 'REJECTED'
  draft.rejectedAt = Date.now()
  draft.originalMessage = null
  state.seen = remember(state.seen, { hash: draft.sourceMessageHash, outcome: 'rejected', at: draft.rejectedAt })
  await store.save(state)
}

export async function confirmDraft(
  id: string,
  input: DraftConfirmInput,
  sink: {
    addQuickEntry: (input: QuickEntryInput) => Promise<void>
    addTransfer: (input: TransferInput) => Promise<void>
  },
  store: SmsStateStore = kvStore,
): Promise<void> {
  const state = await store.load()
  const draft = state.drafts.find((row) => row.id === id && row.status === 'PENDING')
  if (!draft) throw new Error('این مورد دیگر در انتظار تأیید نیست')
  if (state.seen.some((row) => row.hash === draft.sourceMessageHash && row.outcome === 'confirmed')) {
    throw new Error('این پیامک قبلاً ثبت شده است')
  }
  const amountError = validateAmount(input.amountRial)
  if (amountError) throw new Error(amountError)
  if (!isValidIsoDate(input.date)) throw new Error('تاریخ نامعتبر است')
  const description = input.description.trim()
  if (state.settings.descriptionRequired && !description) throw new Error('توضیح را وارد کنید')
  if (!input.accountId) throw new Error('حساب را انتخاب کنید')

  if (input.direction === 'TRANSFER') {
    if (!input.counterpartyAccountId || input.counterpartyAccountId === input.accountId) {
      throw new Error('حساب مبدأ و مقصد انتقال را جدا انتخاب کنید')
    }
    await sink.addTransfer({
      amount: input.amountRial,
      fromAccountId: input.accountId,
      toAccountId: input.counterpartyAccountId,
      note: description,
      date: input.date,
      source: 'sms',
    })
  } else {
    await sink.addQuickEntry({
      kind: input.direction === 'INCOME' ? 'income' : 'expense',
      amount: input.amountRial,
      accountId: input.accountId,
      categoryId: input.categoryId,
      note: description,
      date: input.date,
      source: 'sms',
    })
  }

  draft.status = 'CONFIRMED'
  draft.confirmedAt = Date.now()
  draft.originalMessage = null
  draft.description = description
  draft.direction = input.direction
  draft.amountRial = input.amountRial
  draft.accountId = input.accountId
  draft.counterpartyAccountId = input.counterpartyAccountId ?? null
  draft.categoryId = input.categoryId
  draft.transactionDate = input.date
  state.seen = remember(state.seen, { hash: draft.sourceMessageHash, outcome: 'confirmed', at: draft.confirmedAt })
  await store.save(state)
}

function remember(seen: SeenSms[], entry: SeenSms): SeenSms[] {
  const rest = seen.filter((row) => row.hash !== entry.hash)
  return [entry, ...rest].slice(0, 500)
}

function normalizeState(raw: DraftState | undefined): DraftState {
  return {
    settings: { ...DEFAULT_SMS_SETTINGS, ...raw?.settings },
    drafts: Array.isArray(raw?.drafts) ? raw.drafts : [],
    seen: Array.isArray(raw?.seen) ? raw.seen : [],
  }
}

async function notifyPending(settings: SmsSettings) {
  if (!settings.showNotifications) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification('تراکنش جدید شناسایی شد', {
      body: 'یک پیامک بانکی برای بررسی آماده است.',
      tag: 'hy-sms-pending',
    })
  } catch {
    // Notification display is optional.
  }
}
