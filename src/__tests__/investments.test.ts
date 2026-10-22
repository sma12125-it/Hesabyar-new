import { describe, expect, it } from 'vitest'
import { jalaliToIso } from '../lib/jalaali'
import {
  explainLedger,
  migrateInvestmentAsset,
  prepareInvestments,
  recomputeAsset,
  removeTransaction,
  snapshotAsset,
  upsertTransaction,
  withCurrentUnitPrice,
  InvestmentLedgerError,
} from '../lib/investments'
import type { InvestmentAsset, InvestmentTransaction } from '../types'

const shahrivar1 = jalaliToIso(1405, 6, 1)!
const shahrivar12 = jalaliToIso(1405, 6, 12)!

function asset(partial: Partial<InvestmentAsset> & Pick<InvestmentAsset, 'id' | 'name'>): InvestmentAsset {
  return {
    market: 'stock',
    purchaseAmount: 0,
    currentValue: 0,
    createdAt: 1_700_000_000_000,
    ...partial,
  }
}

function tx(partial: Partial<InvestmentTransaction> & Pick<InvestmentTransaction, 'id' | 'kind' | 'quantity' | 'unitPrice' | 'date'>): InvestmentTransaction {
  return {
    assetId: 'inv_stock',
    createdAt: 1,
    ...partial,
  }
}

describe('weighted-average investment ledger', () => {
  it('books the Shahrivar buy and partial sale', () => {
    const base = asset({
      id: 'inv_stock',
      name: 'فولاد',
      market: 'stock',
      symbol: 'فولاد',
    })
    const bought = upsertTransaction(base, {
      id: 'buy1',
      kind: 'buy',
      quantity: 1000,
      unitPrice: 2_000,
      date: shahrivar1,
      createdAt: 10,
    })
    const sold = upsertTransaction(bought, {
      id: 'sell1',
      kind: 'sell',
      quantity: 250,
      unitPrice: 2_320,
      date: shahrivar12,
      createdAt: 20,
    })
    const marked = withCurrentUnitPrice(sold, 2_500)
    const snap = snapshotAsset(marked)

    expect(shahrivar1).toBe('2026-08-23')
    expect(shahrivar12).toBe('2026-09-03')
    expect(snap.quantity).toBe(750)
    expect(snap.averageCost).toBe(2_000)
    expect(snap.investedAmount).toBe(1_500_000)
    expect(snap.realizedProfit).toBe(80_000)
    expect(snap.currentValue).toBe(1_875_000)
    expect(snap.unrealizedProfit).toBe(375_000)
    expect(marked.transactions).toHaveLength(2)
    expect(marked.purchaseAmount).toBe(1_500_000)
    expect(marked.quantity).toBe(750)
  })

  it('refuses a sale larger than the quantity held on that date', () => {
    const base = asset({ id: 'inv_stock', name: 'فولاد' })
    const bought = upsertTransaction(base, {
      id: 'buy1',
      kind: 'buy',
      quantity: 1000,
      unitPrice: 2_000,
      date: shahrivar1,
      createdAt: 10,
    })
    expect(() =>
      upsertTransaction(bought, {
        id: 'sell1',
        kind: 'sell',
        quantity: 1001,
        unitPrice: 2_320,
        date: shahrivar12,
        createdAt: 20,
      }),
    ).toThrow(InvestmentLedgerError)

    const sold = upsertTransaction(bought, {
      id: 'sell1',
      kind: 'sell',
      quantity: 250,
      unitPrice: 2_320,
      date: shahrivar12,
      createdAt: 20,
    })
    expect(() => removeTransaction(sold, 'buy1')).toThrow(InvestmentLedgerError)
    expect(() =>
      upsertTransaction(sold, {
        id: 'sell1',
        kind: 'sell',
        quantity: 1001,
        unitPrice: 2_320,
        date: shahrivar12,
        createdAt: 20,
      }),
    ).toThrow(/بیش از موجودی/)
  })

  it('uses issuance and redemption for funds with the same average', () => {
    const base = asset({ id: 'inv_fund', name: 'اهرم', market: 'fund' })
    const issued = upsertTransaction(base, {
      id: 'iss1',
      kind: 'issue',
      quantity: 100,
      unitPrice: 1_000,
      date: shahrivar1,
      createdAt: 10,
    })
    const more = upsertTransaction(issued, {
      id: 'iss2',
      kind: 'issue',
      quantity: 300,
      unitPrice: 2_000,
      date: shahrivar1,
      createdAt: 11,
    })
    const redeemed = upsertTransaction(more, {
      id: 'red1',
      kind: 'redeem',
      quantity: 100,
      unitPrice: 3_000,
      date: shahrivar12,
      createdAt: 20,
    })
    const snap = snapshotAsset(redeemed)
    expect(snap.quantity).toBe(300)
    expect(snap.averageCost).toBe(1_750)
    expect(snap.investedAmount).toBe(525_000)
    expect(snap.realizedProfit).toBe(125_000)
  })

  it('keeps a legacy holding when synthesizing the opening trade', () => {
    const legacy = asset({
      id: 'inv_gold_1',
      name: 'طلای آب‌شده / ۱۸ عیار',
      market: 'gold',
      purchaseAmount: 85_000_000,
      currentValue: 98_500_000,
      quantity: 21.5,
      purchaseDate: '2026-06-01',
      note: 'پوشش تورم',
      symbol: 'طلا',
      inscode: '123',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    const first = migrateInvestmentAsset(legacy)
    expect(first.changed).toBe(true)
    expect(first.asset.name).toBe(legacy.name)
    expect(first.asset.symbol).toBe('طلا')
    expect(first.asset.inscode).toBe('123')
    expect(first.asset.note).toBe('پوشش تورم')
    expect(first.asset.market).toBe('gold')
    expect(first.asset.purchaseAmount).toBe(85_000_000)
    expect(first.asset.currentValue).toBe(98_500_000)
    expect(first.asset.quantity).toBe(21.5)
    expect(first.asset.realizedProfit).toBe(0)
    expect(first.asset.transactions).toHaveLength(1)
    expect(first.asset.transactions?.[0]?.kind).toBe('buy')
    expect(first.asset.transactions?.[0]?.date).toBe('2026-06-01')
    expect(first.asset.createdAt).toBe(legacy.createdAt)
    expect(first.asset.updatedAt).toBe(legacy.updatedAt)

    const second = migrateInvestmentAsset(first.asset)
    expect(second.changed).toBe(false)
    expect(second.asset.purchaseAmount).toBe(85_000_000)
    expect(second.asset.currentValue).toBe(98_500_000)
    expect(second.asset.transactions).toHaveLength(1)

    const fund = migrateInvestmentAsset(
      asset({
        id: 'inv_fund_1',
        name: 'صندوق',
        market: 'fund',
        purchaseAmount: 50_000_000,
        currentValue: 56_200_000,
        purchaseDate: '2026-07-01',
      }),
    )
    expect(fund.asset.transactions?.[0]?.kind).toBe('issue')
    expect(fund.asset.purchaseAmount).toBe(50_000_000)
    expect(fund.asset.currentValue).toBe(56_200_000)
    expect(fund.asset.quantity).toBe(1)
  })

  it('prepares a list once and leaves an already migrated list untouched', () => {
    const legacy = asset({
      id: 'inv_gold_1',
      name: 'طلا',
      purchaseAmount: 10_000,
      currentValue: 12_000,
      quantity: 2,
    })
    const prepared = prepareInvestments([legacy])
    expect(prepared.changed).toBe(true)
    const again = prepareInvestments(prepared.assets)
    expect(again.changed).toBe(false)
    expect(again.assets[0]?.purchaseAmount).toBe(10_000)
    expect(again.assets[0]?.currentValue).toBe(12_000)
  })

  it('realizes profit only on the outflow row', () => {
    const rows = explainLedger([
      tx({ id: 'b', kind: 'buy', quantity: 1000, unitPrice: 2000, date: shahrivar1, createdAt: 1 }),
      tx({ id: 's', kind: 'sell', quantity: 250, unitPrice: 2320, date: shahrivar12, createdAt: 2 }),
    ])
    expect(rows[0]?.realizedProfit).toBeNull()
    expect(rows[1]?.realizedProfit).toBe(80_000)
    expect(rows[1]?.runningQuantity).toBe(750)
    expect(recomputeAsset(asset({ id: 'inv_stock', name: 'فولاد', transactions: rows.map((row) => row.tx) })).quantity).toBe(750)
  })
})
