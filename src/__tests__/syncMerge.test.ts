// Regression tests for the "last 3 weeks of transactions disappear" bug.
// The first block reproduces the scenarios that lost rows with the old LiveSync mergeCollection;
// they now keep every row.
import { describe, expect, it } from 'vitest'
import {
  TOMBSTONE_TTL_MS,
  isSuspiciousRemoval,
  mergePayload,
  mergeRows,
  mergeTombstones,
  stampChanged,
  type SyncPayload,
} from '../lib/syncMerge'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 26)
const tx = (id: string, t: number, extra: Record<string, unknown> = {}) => ({ id, accountId: 'acc1', createdAt: t, updatedAt: t, ...extra })
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort()

describe('regression: rows are never dropped because the other copy lacks them', () => {
  it('keeps rows created offline before another device pushed a stale whole snapshot', () => {
    const local = [tx('old', 100), tx('a1', 1000), tx('a2', 1010), tx('a3', 1020)]
    const remote = [tx('old', 100), tx('b1', 1990)] // pushed later by a device that never saw a1..a3
    expect(ids(mergeRows(local, remote, {}))).toEqual(['a1', 'a2', 'a3', 'b1', 'old'])
  })

  it('a device with a fast clock cannot erase other devices rows', () => {
    const local = [tx('old', 100), tx('new-today', NOW)]
    const remote = [tx('old', 100), tx('future', NOW + DAY)]
    expect(ids(mergeRows(local, remote, {}))).toEqual(['future', 'new-today', 'old'])
  })

  it('an empty or partial remote never wipes local transactions', () => {
    const local: SyncPayload = { transactions: [tx('t1', 1), tx('t2', 2)], accounts: [{ id: 'acc1', createdAt: 1 }] }
    const { merged, report } = mergePayload(local, { transactions: [], accounts: [] }, NOW)
    expect(ids(merged.transactions as never)).toEqual(['t1', 't2'])
    expect(report.removedCount).toBe(0)
    expect(report.changedRemote).toBe(true) // the merged copy is pushed back
  })

  it('old snapshots without updatedAt/tombstones still load and merge by createdAt', () => {
    const local: SyncPayload = { transactions: [{ id: 'x', createdAt: 5, amount: 1 }] }
    const remote: SyncPayload = { transactions: [{ id: 'x', createdAt: 5, amount: 1 }, { id: 'y', createdAt: 3 }], budgets: [{ id: 'b' }] }
    const { merged } = mergePayload(local, remote, NOW)
    expect(ids(merged.transactions as never)).toEqual(['x', 'y'])
    expect(ids(merged.budgets as never)).toEqual(['b'])
  })
})

describe('per-row conflict rules and tombstones', () => {
  it('newer updatedAt wins per row', () => {
    const merged = mergeRows<{ id: string; amount: number }>([tx('x', 10, { amount: 1 })], [tx('x', 20, { amount: 2 })], {})
    expect(merged[0].amount).toBe(2)
    const back = mergeRows<{ id: string; amount: number }>([tx('x', 30, { amount: 3 })], [tx('x', 20, { amount: 2 })], {})
    expect(back[0].amount).toBe(3)
  })

  it('ties are resolved the same way on every device', () => {
    const a = tx('x', 10, { amount: 1 })
    const b = tx('x', 10, { amount: 2 })
    expect(mergeRows([a], [b], {})).toEqual(mergeRows([b], [a], {}))
  })

  it('a tombstone deletes the row everywhere and wins ties', () => {
    const tombs = { x: 10 }
    expect(mergeRows([tx('x', 10)], [], tombs)).toEqual([])
    const { merged } = mergePayload(
      { transactions: [tx('x', 10), tx('y', 10)] },
      { transactions: [tx('y', 10)], tombstones: { transactions: { x: NOW - DAY } } },
      NOW,
    )
    expect(ids(merged.transactions as never)).toEqual(['y'])
    expect(merged.tombstones?.transactions?.x).toBe(NOW - DAY)
  })

  it('a row edited after its delete comes back and clears the tombstone', () => {
    const tombs: Record<string, number> = { x: 10 }
    expect(ids(mergeRows([tx('x', 20)], [], tombs))).toEqual(['x'])
    expect(tombs.x).toBeUndefined()
  })

  it('row-level deletedAt markers are honoured as tombstones', () => {
    const tombs: Record<string, number> = {}
    expect(mergeRows([tx('x', 5)], [{ ...tx('x', 5), deletedAt: 9 }], tombs)).toEqual([])
    expect(tombs.x).toBe(9)
  })

  it('tombstones older than 90 days are purged', () => {
    const t = mergeTombstones({ transactions: { old: NOW - TOMBSTONE_TTL_MS - 1, fresh: NOW - DAY } }, {}, NOW)
    expect(t.transactions).toEqual({ fresh: NOW - DAY })
  })

  it('scalar settings follow their own edit time', () => {
    const { merged } = mergePayload(
      { currencyUnit: 'IRT', scalarTimes: { currencyUnit: 5 } },
      { currencyUnit: 'IRR', scalarTimes: { currencyUnit: 9 } },
      NOW,
    )
    expect(merged.currencyUnit).toBe('IRR')
  })
})

describe('safety guard', () => {
  it('flags a remote that would remove many local rows, allows small deletes', () => {
    const local: SyncPayload = { transactions: Array.from({ length: 40 }, (_, i) => tx(`t${i}`, 100)) }
    const tombstones = { transactions: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`t${i}`, NOW - 1])) }
    const big = mergePayload(local, { tombstones }, NOW)
    expect(big.report.removedCount).toBe(30)
    expect(isSuspiciousRemoval(big.report)).toBe(true)
    const small = mergePayload(local, { tombstones: { transactions: { t0: NOW - 1 } } }, NOW)
    expect(isSuspiciousRemoval(small.report)).toBe(false)
  })
})

describe('updatedAt stamping', () => {
  it('stamps new and changed rows only, ignoring the stamp itself', () => {
    const prev = [{ id: 'a', v: 1, updatedAt: 5 }, { id: 'b', v: 1, updatedAt: 5 }]
    const next = [{ id: 'a', v: 1 }, { id: 'b', v: 2, updatedAt: 5 }, { id: 'c', v: 1 }]
    const out = stampChanged(prev as never, next as never, 100) as Array<{ id: string; updatedAt: number }>
    expect(out.map((r) => r.updatedAt)).toEqual([5, 100, 100])
  })
})

describe('two devices end to end (simulated cloud)', () => {
  // Mimics cloudSync.syncNow: pull → merge → apply → push merged.
  let cloud: SyncPayload | null = null
  const sync = (device: SyncPayload, now: number): SyncPayload => {
    const { merged } = mergePayload(device, cloud, now)
    cloud = merged
    return merged
  }

  it('the reported bug: phone rows survive a stale laptop push and both converge', () => {
    cloud = null
    let laptop: SyncPayload = { transactions: [tx('old', 100)] }
    let phone: SyncPayload = { transactions: [tx('old', 100)] }
    laptop = sync(laptop, 200)
    phone = sync(phone, 210)
    // phone enters 3 weeks of rows but is offline
    phone = { ...phone, transactions: [...(phone.transactions as never[]), tx('p1', 300), tx('p2', 310)] }
    // laptop edits something and syncs (it never saw p1, p2)
    laptop = { ...laptop, transactions: [...(laptop.transactions as never[]), tx('l1', 400)] }
    laptop = sync(laptop, 400)
    // phone comes online
    phone = sync(phone, 500)
    laptop = sync(laptop, 600)
    expect(ids(phone.transactions as never)).toEqual(['l1', 'old', 'p1', 'p2'])
    expect(ids(laptop.transactions as never)).toEqual(['l1', 'old', 'p1', 'p2'])
  })

  it('a delete on one device propagates instead of being resurrected', () => {
    cloud = null
    let a: SyncPayload = { transactions: [tx('x', 100), tx('y', 100)] }
    let b: SyncPayload = sync(a, 150)
    a = sync(a, 160)
    a = { ...a, transactions: [tx('y', 100)], tombstones: { transactions: { x: NOW - 1 } } }
    a = sync(a, NOW)
    b = sync(b, NOW)
    expect(ids(b.transactions as never)).toEqual(['y'])
  })
})
