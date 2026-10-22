import { createId } from './ids'
import { isValidIsoDate, isoFromTimestamp } from './iso'
import { toFaDigits } from './money'
import type { InvestmentAsset, InvestmentMarket, InvestmentTransaction, InvestmentTxKind } from '../types'

/** Iranian portfolios usually carry shares and fund units at weighted-average cost. */
export const COST_BASIS_METHOD_FA = 'میانگین موزون'

export const COST_BASIS_NOTE_FA =
  'بهای تمام‌شده با روش میانگین موزون محاسبه می‌شود. این روش برای سهام و صندوق در ایران رایج است. فروش یا ابطال بیش از موجودی مجاز نیست.'

export const KIND_LABEL: Record<InvestmentTxKind, string> = {
  buy: 'خرید',
  sell: 'فروش',
  issue: 'صدور',
  redeem: 'ابطال',
}

const INFLOW: ReadonlySet<InvestmentTxKind> = new Set(['buy', 'issue'])
const ALL_KINDS: ReadonlySet<string> = new Set(['buy', 'sell', 'issue', 'redeem'])

const QTY_EPS = 1e-6

export class InvestmentLedgerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvestmentLedgerError'
  }
}

export function isInflowKind(kind: InvestmentTxKind): boolean {
  return INFLOW.has(kind)
}

export function kindsForMarket(market: InvestmentMarket | string): InvestmentTxKind[] {
  if (market === 'fund') return ['issue', 'redeem', 'buy', 'sell']
  return ['buy', 'sell']
}

export function defaultKindForMarket(market: InvestmentMarket | string): InvestmentTxKind {
  return market === 'fund' ? 'issue' : 'buy'
}

export interface LedgerRow {
  tx: InvestmentTransaction
  runningQuantity: number
  averageCostAfter: number
  costBasisAfter: number
  /** Profit booked by this sell or redemption. Null for buys and issuances. */
  realizedProfit: number | null
}

export interface AssetSnapshot {
  quantity: number
  averageCost: number
  investedAmount: number
  currentUnitPrice: number | null
  currentValue: number
  realizedProfit: number
  unrealizedProfit: number | null
  rows: LedgerRow[]
}

function roundRial(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

function cleanQuantity(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) < QTY_EPS) return 0
  return Math.round(value * 1e8) / 1e8
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return toFaDigits(0)
  const cleaned = cleanQuantity(value)
  const text = Number.isInteger(cleaned) ? String(cleaned) : String(cleaned)
  return toFaDigits(text).replace('.', '٫')
}

function formatQtyPlain(value: number): string {
  const cleaned = cleanQuantity(value)
  const text = Number.isInteger(cleaned) ? String(cleaned) : String(cleaned)
  return toFaDigits(text).replace('.', '٫')
}

export function parseQuantity(raw: string): number {
  const western = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٬،,\s]/g, '')
    .replace('٫', '.')
  const match = western.match(/-?\d*\.?\d+/)
  if (!match) return 0
  const n = Number(match[0])
  return Number.isFinite(n) ? n : 0
}

function isKind(value: unknown): value is InvestmentTxKind {
  return typeof value === 'string' && ALL_KINDS.has(value)
}

function asTransaction(value: unknown, assetId: string): InvestmentTransaction | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<InvestmentTransaction>
  if (!isKind(row.kind)) return null
  if (typeof row.quantity !== 'number' || !(row.quantity > 0)) return null
  if (typeof row.unitPrice !== 'number' || !(row.unitPrice > 0)) return null
  if (typeof row.date !== 'string' || !isValidIsoDate(row.date)) return null
  const createdAt = typeof row.createdAt === 'number' ? row.createdAt : Date.now()
  return {
    id: typeof row.id === 'string' && row.id ? row.id : createId('itx'),
    assetId: typeof row.assetId === 'string' && row.assetId ? row.assetId : assetId,
    kind: row.kind,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    date: row.date,
    note: typeof row.note === 'string' && row.note.trim() ? row.note.trim() : undefined,
    createdAt,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : undefined,
  }
}

export function normalizeTransactions(value: unknown, assetId: string): InvestmentTransaction[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const tx = asTransaction(row, assetId)
    return tx ? [tx] : []
  })
}

function sortTransactions(transactions: InvestmentTransaction[]): InvestmentTransaction[] {
  return transactions.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Replay the ledger in date order.
 * Inflows set a new weighted-average cost. Outflows realize profit against that average
 * and leave the average unchanged.
 */
export function explainLedger(transactions: InvestmentTransaction[]): LedgerRow[] {
  const ordered = sortTransactions(transactions)
  let quantity = 0
  let costBasis = 0
  const rows: LedgerRow[] = []

  for (const tx of ordered) {
    if (!(tx.quantity > 0) || !Number.isFinite(tx.quantity)) {
      throw new InvestmentLedgerError('تعداد واحد باید بیشتر از صفر باشد')
    }
    if (!(tx.unitPrice > 0) || !Number.isFinite(tx.unitPrice)) {
      throw new InvestmentLedgerError('قیمت هر واحد باید بیشتر از صفر باشد')
    }
    if (!isValidIsoDate(tx.date)) {
      throw new InvestmentLedgerError('تاریخ معامله نامعتبر است')
    }
    if (!isKind(tx.kind)) {
      throw new InvestmentLedgerError('نوع معامله نامعتبر است')
    }

    if (isInflowKind(tx.kind)) {
      costBasis += tx.quantity * tx.unitPrice
      quantity = cleanQuantity(quantity + tx.quantity)
      const average = quantity > 0 ? costBasis / quantity : 0
      rows.push({
        tx,
        runningQuantity: quantity,
        averageCostAfter: average,
        costBasisAfter: quantity > 0 ? costBasis : 0,
        realizedProfit: null,
      })
      continue
    }

    if (tx.quantity > quantity + QTY_EPS) {
      throw new InvestmentLedgerError(
        `فروش یا ابطال بیش از موجودی ممکن نیست. در این تاریخ فقط ${formatQtyPlain(quantity)} واحد موجود است.`,
      )
    }
    const average = quantity > 0 ? costBasis / quantity : 0
    const realized = tx.quantity * (tx.unitPrice - average)
    quantity = cleanQuantity(quantity - tx.quantity)
    costBasis = quantity > 0 ? average * quantity : 0
    rows.push({
      tx,
      runningQuantity: quantity,
      averageCostAfter: quantity > 0 ? average : 0,
      costBasisAfter: costBasis,
      realizedProfit: realized,
    })
  }

  return rows
}

function positive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function snapshotFromRows(asset: InvestmentAsset, rows: LedgerRow[]): AssetSnapshot {
  const last = rows[rows.length - 1]
  const quantity = last?.runningQuantity ?? 0
  const averageCost = quantity > 0 ? (last?.averageCostAfter ?? 0) : 0
  const investedAmount = roundRial(last?.costBasisAfter ?? 0)
  const realizedProfit = roundRial(rows.reduce((sum, row) => sum + (row.realizedProfit ?? 0), 0))
  const currentUnitPrice = positive(asset.currentUnitPrice) ? asset.currentUnitPrice : null
  const currentValue = currentUnitPrice != null ? roundRial(quantity * currentUnitPrice) : roundRial(asset.currentValue || 0)
  const unrealizedProfit = currentUnitPrice != null ? currentValue - investedAmount : null
  return {
    quantity,
    averageCost,
    investedAmount,
    currentUnitPrice,
    currentValue,
    realizedProfit,
    unrealizedProfit,
    rows,
  }
}

export function recomputeAsset(asset: InvestmentAsset): InvestmentAsset {
  const transactions = sortTransactions(normalizeTransactions(asset.transactions, asset.id))
  const rows = explainLedger(transactions)
  const snap = snapshotFromRows({ ...asset, transactions }, rows)
  return {
    ...asset,
    transactions,
    quantity: snap.quantity,
    unitPrice: snap.quantity > 0 ? snap.averageCost : 0,
    purchaseAmount: snap.investedAmount,
    currentUnitPrice: snap.currentUnitPrice ?? undefined,
    currentValue: snap.currentValue,
    realizedProfit: snap.realizedProfit,
  }
}

function inferOpening(asset: InvestmentAsset): { quantity: number; unitPrice: number } | null {
  const purchase = asset.purchaseAmount
  if (purchase > 0) {
    if (positive(asset.quantity)) return { quantity: asset.quantity, unitPrice: purchase / asset.quantity }
    if (positive(asset.unitPrice)) return { quantity: purchase / asset.unitPrice, unitPrice: asset.unitPrice }
    return { quantity: 1, unitPrice: purchase }
  }
  if (positive(asset.quantity) && positive(asset.unitPrice)) {
    return { quantity: asset.quantity, unitPrice: asset.unitPrice }
  }
  return null
}

function openingDate(asset: InvestmentAsset): string {
  if (asset.purchaseDate && isValidIsoDate(asset.purchaseDate)) return asset.purchaseDate
  if (asset.createdAt) return isoFromTimestamp(asset.createdAt)
  return isoFromTimestamp(Date.now())
}

function materiallyDifferent(before: InvestmentAsset, after: InvestmentAsset): boolean {
  const beforeTx = Array.isArray(before.transactions) ? before.transactions.length : 0
  const afterTx = after.transactions?.length ?? 0
  if (beforeTx !== afterTx) return true
  if (Math.abs((before.quantity ?? 0) - (after.quantity ?? 0)) > QTY_EPS) return true
  if (Math.abs(before.purchaseAmount - after.purchaseAmount) > 1) return true
  if (Math.abs((before.currentValue ?? 0) - (after.currentValue ?? 0)) > 1) return true
  if (Math.abs((before.realizedProfit ?? 0) - (after.realizedProfit ?? 0)) > 1) return true
  if (Math.abs((before.currentUnitPrice ?? 0) - (after.currentUnitPrice ?? 0)) > 1) return true
  return false
}

/**
 * Legacy rows stored a single cost and a current value, with no trade list.
 * The opening trade keeps that cost and value so nothing is dropped.
 */
export function migrateInvestmentAsset(asset: InvestmentAsset): { asset: InvestmentAsset; changed: boolean } {
  const existing = normalizeTransactions(asset.transactions, asset.id)
  if (existing.length > 0) {
    try {
      const next = recomputeAsset({ ...asset, transactions: existing })
      return { asset: next, changed: materiallyDifferent(asset, next) }
    } catch {
      return { asset, changed: false }
    }
  }

  const opening = inferOpening(asset)
  if (!opening) {
    const next: InvestmentAsset = {
      ...asset,
      transactions: [],
      realizedProfit: asset.realizedProfit ?? 0,
      quantity: asset.quantity ?? 0,
    }
    return { asset: next, changed: !Array.isArray(asset.transactions) }
  }

  const currentUnitPrice =
    asset.currentValue > 0 && opening.quantity > 0
      ? asset.currentValue / opening.quantity
      : positive(asset.currentUnitPrice)
        ? asset.currentUnitPrice
        : undefined

  const tx: InvestmentTransaction = {
    id: `itx_open_${asset.id}`,
    assetId: asset.id,
    kind: asset.market === 'fund' ? 'issue' : 'buy',
    quantity: opening.quantity,
    unitPrice: opening.unitPrice,
    date: openingDate(asset),
    note: 'ماندهٔ منتقل‌شده از ثبت قبلی',
    createdAt: asset.createdAt || Date.now(),
  }

  try {
    const next = recomputeAsset({ ...asset, currentUnitPrice, transactions: [tx] })
    return { asset: next, changed: true }
  } catch {
    return { asset, changed: false }
  }
}

export function prepareInvestments(assets: InvestmentAsset[]): { assets: InvestmentAsset[]; changed: boolean } {
  let changed = false
  const next = assets.map((asset) => {
    const result = migrateInvestmentAsset(asset)
    if (result.changed) changed = true
    return result.asset
  })
  return { assets: next, changed }
}

export function snapshotAsset(asset: InvestmentAsset): AssetSnapshot {
  try {
    const ready = asset.transactions && asset.transactions.length > 0 ? recomputeAsset(asset) : migrateInvestmentAsset(asset).asset
    return snapshotFromRows(ready, explainLedger(ready.transactions ?? []))
  } catch {
    const quantity = asset.quantity ?? 0
    const invested = asset.purchaseAmount || 0
    const currentUnitPrice = positive(asset.currentUnitPrice) ? asset.currentUnitPrice : null
    return {
      quantity,
      averageCost: positive(asset.unitPrice) ? asset.unitPrice : quantity > 0 ? invested / quantity : 0,
      investedAmount: invested,
      currentUnitPrice,
      currentValue: asset.currentValue || 0,
      realizedProfit: asset.realizedProfit ?? 0,
      unrealizedProfit: currentUnitPrice != null ? (asset.currentValue || 0) - invested : null,
      rows: [],
    }
  }
}

export function upsertTransaction(
  asset: InvestmentAsset,
  input: Omit<InvestmentTransaction, 'id' | 'assetId' | 'createdAt'> & { id?: string; createdAt?: number },
): InvestmentAsset {
  const base = asset.transactions && asset.transactions.length > 0 ? recomputeAsset(asset) : migrateInvestmentAsset(asset).asset
  const now = Date.now()
  const tx: InvestmentTransaction = {
    id: input.id || createId('itx'),
    assetId: base.id,
    kind: input.kind,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    date: input.date,
    note: input.note?.trim() || undefined,
    createdAt: input.createdAt ?? now,
    updatedAt: input.id ? now : undefined,
  }
  const existing = base.transactions ?? []
  const previous = existing.find((row) => row.id === tx.id)
  const transactions = previous
    ? existing.map((row) => (row.id === tx.id ? { ...tx, createdAt: row.createdAt, updatedAt: now } : row))
    : [...existing, tx]
  return recomputeAsset({ ...base, transactions, updatedAt: now })
}

export function removeTransaction(asset: InvestmentAsset, txId: string): InvestmentAsset {
  const base = asset.transactions && asset.transactions.length > 0 ? recomputeAsset(asset) : migrateInvestmentAsset(asset).asset
  const existing = base.transactions ?? []
  if (!existing.some((row) => row.id === txId)) throw new InvestmentLedgerError('معامله پیدا نشد')
  return recomputeAsset({
    ...base,
    transactions: existing.filter((row) => row.id !== txId),
    updatedAt: Date.now(),
  })
}

export function withCurrentUnitPrice(asset: InvestmentAsset, unitPriceRials: number): InvestmentAsset {
  if (!(unitPriceRials > 0) || !Number.isFinite(unitPriceRials)) {
    throw new InvestmentLedgerError('قیمت روز هر واحد باید بیشتر از صفر باشد')
  }
  const base = asset.transactions && asset.transactions.length > 0 ? asset : migrateInvestmentAsset(asset).asset
  return recomputeAsset({
    ...base,
    currentUnitPrice: unitPriceRials,
    updatedAt: Date.now(),
  })
}
