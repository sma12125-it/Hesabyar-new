import { describe, expect, it } from 'vitest'
import {
  computeDongSettlement,
  defaultDongPayerId,
  isMadreKharjEnabled,
  MADRE_KHARJ_PAYER_ID,
  memberHasPotRole,
} from '../lib/dong'
import type { DongEvent } from '../types'

function event(partial: Partial<DongEvent> = {}): DongEvent {
  return {
    id: 'e1',
    title: 'شام',
    date: '2026-03-20',
    participants: [
      { id: 'a', name: 'علی' },
      { id: 'b', name: 'بهار' },
      { id: 'c', name: 'کامران' },
    ],
    expenses: [],
    createdAt: 1,
    ...partial,
  }
}

describe('computeDongSettlement without مادرخرج', () => {
  it('splits an equal expense the same way as before', () => {
    const summary = computeDongSettlement(
      event({
        expenses: [
          { id: 'x', title: 'شام', amount: 100, paidById: 'a', splitAmongIds: ['a', 'b', 'c'] },
        ],
      }),
    )
    expect(summary.potActive).toBe(false)
    expect(summary.potBalance).toBe(0)
    expect(summary.totalDeposits).toBe(0)
    expect(summary.ledger).toEqual([])
    expect(summary.balances.map((b) => [b.id, b.paid, b.deposits, b.share, b.net])).toEqual([
      ['a', 100, 0, 34, 66],
      ['b', 0, 0, 33, -33],
      ['c', 0, 0, 33, -33],
    ])
    expect(summary.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([
      ['b', 'a', 33],
      ['c', 'a', 33],
    ])
  })

  it('keeps custom shares and group settlement unchanged', () => {
    const summary = computeDongSettlement(
      event({
        groups: [{ id: 'g', name: 'خانواده', memberIds: ['a', 'b'] }],
        expenses: [
          {
            id: 'x',
            title: 'میوه',
            amount: 100,
            paidById: 'a',
            splitAmongIds: ['a', 'b'],
            splitMode: 'custom',
            customShares: { a: 70, b: 30 },
          },
          { id: 'y', title: 'نان', amount: 90, paidById: 'c', splitAmongIds: ['a', 'b', 'c'] },
        ],
      }),
    )
    const byId = Object.fromEntries(summary.balances.map((b) => [b.id, b]))
    expect(byId.a).toMatchObject({ paid: 100, share: 70 + 30, net: 100 - 100 })
    expect(byId.b).toMatchObject({ paid: 0, share: 30 + 30, net: -60 })
    expect(byId.c).toMatchObject({ paid: 90, share: 30, net: 60 })
    expect(summary.groupBalances.map((g) => [g.id, g.paid, g.share, g.net])).toEqual([['g', 100, 160, -60]])
    expect(summary.groupTransfers.map((t) => [t.id, t.fromName, t.toName, t.amount])).toEqual([
      ['grp_g_to_c', 'گروه خانواده', 'کامران', 60],
    ])
  })

  it('ignores a skipped مادرخرج even if amounts were typed and stored', () => {
    const plain = computeDongSettlement(
      event({
        expenses: [{ id: 'x', title: 'شام', amount: 90, paidById: 'a', splitAmongIds: ['a', 'b', 'c'] }],
      }),
    )
    const skippedEvent = event({
      madreKharj: {
        enabled: false,
        responsibleId: 'a',
        contributions: { a: 500_000, b: 500_000 },
        deposits: [{ id: 'd1', memberId: 'c', amount: 80_000, date: '2026-03-21', note: 'علی‌الحساب' }],
      },
      expenses: [{ id: 'x', title: 'شام', amount: 90, paidById: 'a', splitAmongIds: ['a', 'b', 'c'] }],
    })
    const skipped = computeDongSettlement(skippedEvent)
    expect(isMadreKharjEnabled(skippedEvent)).toBe(false)
    expect(skipped.potActive).toBe(false)
    expect(skipped.balances.map((b) => b.net)).toEqual(plain.balances.map((b) => b.net))
    expect(skipped.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual(
      plain.transfers.map((t) => [t.fromId, t.toId, t.amount]),
    )
    expect(defaultDongPayerId(event({ madreKharj: { enabled: false, responsibleId: 'b' } }))).toBe('a')
  })
})

describe('computeDongSettlement with مادرخرج', () => {
  it('counts each member amount and later deposits as contributions', () => {
    const summary = computeDongSettlement(
      event({
        madreKharj: {
          enabled: true,
          responsibleId: 'c',
          contributions: { a: 100, b: 0 },
          deposits: [{ id: 'd1', memberId: 'a', amount: 50, date: '2026-03-22', note: 'بقیه' }],
        },
      }),
    )
    expect(summary.potActive).toBe(true)
    expect(summary.potBalance).toBe(150)
    expect(summary.potSpent).toBe(0)
    expect(summary.balances.find((b) => b.id === 'a')).toMatchObject({ paid: 0, deposits: 150, share: 0, net: 150 })
    expect(summary.balances.find((b) => b.id === 'b')).toMatchObject({ deposits: 0, net: 0 })
    expect(summary.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([
      [MADRE_KHARJ_PAYER_ID, 'a', 150],
    ])
  })

  it('treats pot-paid expenses as consumption and leaves personal payments in place', () => {
    const summary = computeDongSettlement(
      event({
        madreKharj: {
          enabled: true,
          responsibleId: 'c',
          contributions: { a: 60 },
          deposits: [],
        },
        expenses: [
          { id: 'p', title: 'شام', amount: 90, paidById: 'b', splitAmongIds: ['a', 'b', 'c'] },
          { id: 'pot', title: 'تاکسی', amount: 30, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b', 'c'], date: '2026-03-21' },
        ],
      }),
    )
    expect(summary.potBalance).toBe(30)
    expect(summary.potSpent).toBe(30)
    expect(summary.totalCost).toBe(120)
    expect(summary.balances.map((b) => [b.id, b.paid, b.deposits, b.share, b.net])).toEqual([
      ['a', 0, 60, 40, 20],
      ['b', 90, 0, 40, 50],
      ['c', 0, 0, 40, -40],
    ])
    expect(summary.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([
      ['c', 'b', 40],
      [MADRE_KHARJ_PAYER_ID, 'b', 10],
      [MADRE_KHARJ_PAYER_ID, 'a', 20],
    ])
  })

  it('credits the مسئول for a short pot and does not ask them to pay themselves', () => {
    const summary = computeDongSettlement(
      event({
        madreKharj: { enabled: true, responsibleId: 'c', contributions: {} },
        expenses: [
          { id: 'pot', title: 'ویلا', amount: 300, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b', 'c'] },
        ],
      }),
    )
    expect(summary.potBalance).toBe(-300)
    expect(summary.balances.map((b) => [b.id, b.deficitCovered, b.net])).toEqual([
      ['a', 0, -100],
      ['b', 0, -100],
      ['c', 300, 200],
    ])
    expect(summary.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([
      ['a', 'c', 100],
      ['b', 'c', 100],
    ])
    expect(summary.transfers.some((t) => t.fromId === MADRE_KHARJ_PAYER_ID || t.toId === MADRE_KHARJ_PAYER_ID)).toBe(false)
  })

  it('settles a pot-funded equal split back to the depositor', () => {
    const summary = computeDongSettlement(
      event({
        madreKharj: { enabled: true, responsibleId: 'a', contributions: { a: 300 } },
        expenses: [
          { id: 'pot', title: 'ناهار', amount: 300, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b', 'c'] },
        ],
      }),
    )
    expect(summary.potBalance).toBe(0)
    expect(summary.balances.find((b) => b.id === 'a')?.paid).toBe(0)
    expect(summary.balances.map((b) => b.net)).toEqual([200, -100, -100])
    expect(summary.transfers.map((t) => [t.fromId, t.toName, t.amount])).toEqual([
      ['b', 'علی', 100],
      ['c', 'علی', 100],
    ])
  })

  it('folds deposits into group nets and still returns leftover pot cash', () => {
    const summary = computeDongSettlement(
      event({
        groups: [{ id: 'g', name: 'دوستان', memberIds: ['a', 'b'] }],
        madreKharj: { enabled: true, responsibleId: 'b', contributions: { a: 300 } },
        expenses: [
          { id: 'pot', title: 'بنزین', amount: 150, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b'] },
        ],
      }),
    )
    expect(summary.potBalance).toBe(150)
    expect(summary.groupBalances[0]).toMatchObject({ deposits: 300, net: 150 })
    expect(summary.balances.find((b) => b.id === 'c')?.net).toBe(0)
    expect(summary.groupTransfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual([
      [MADRE_KHARJ_PAYER_ID, 'g', 150],
    ])
  })

  it('builds a pot ledger in Jalali-backed date order with a running balance', () => {
    const summary = computeDongSettlement(
      event({
        date: '2026-01-01',
        madreKharj: {
          enabled: true,
          responsibleId: 'a',
          contributions: { a: 100 },
          deposits: [{ id: 'd1', memberId: 'b', amount: 40, date: '2026-01-03', note: 'کارت' }],
        },
        expenses: [
          { id: 'pot', title: 'قهوه', amount: 50, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b'], date: '2026-01-02' },
        ],
      }),
    )
    expect(summary.ledger.map((row) => [row.kind, row.date, row.signed, row.runningBalance])).toEqual([
      ['contribution', '2026-01-01', 100, 100],
      ['expense', '2026-01-02', -50, 50],
      ['deposit', '2026-01-03', 40, 90],
    ])
    expect(summary.potBalance).toBe(90)
    expect(summary.ledger[2]?.detail).toBe('کارت')
  })

  it('keeps books when مادرخرج is turned off after a pot payment', () => {
    const summary = computeDongSettlement(
      event({
        madreKharj: {
          enabled: false,
          responsibleId: 'c',
          contributions: { a: 100, b: 100 },
        },
        expenses: [
          { id: 'pot', title: 'هتل', amount: 300, paidById: MADRE_KHARJ_PAYER_ID, splitAmongIds: ['a', 'b', 'c'] },
        ],
      }),
    )
    expect(summary.potActive).toBe(true)
    expect(summary.potBalance).toBe(-100)
    expect(summary.balances.find((b) => b.id === 'c')?.deficitCovered).toBe(100)
    expect(summary.balances.map((b) => b.net).reduce((s, n) => s + n, 0)).toBe(0)
  })

  it('does not change nets when مادرخرج is on but nobody has paid into it', () => {
    const base = event({
      expenses: [{ id: 'x', title: 'شام', amount: 90, paidById: 'b', splitAmongIds: ['a', 'b', 'c'] }],
    })
    const plain = computeDongSettlement(base)
    const armedEvent: DongEvent = {
      ...base,
      madreKharj: { enabled: true, responsibleId: 'a', contributions: {} },
    }
    const armed = computeDongSettlement(armedEvent)
    expect(armed.potActive).toBe(true)
    expect(armed.potBalance).toBe(0)
    expect(armed.balances.map((b) => [b.paid, b.share, b.net])).toEqual(
      plain.balances.map((b) => [b.paid, b.share, b.net]),
    )
    expect(armed.transfers.map((t) => [t.fromId, t.toId, t.amount])).toEqual(
      plain.transfers.map((t) => [t.fromId, t.toId, t.amount]),
    )
    expect(defaultDongPayerId(armedEvent)).toBe(MADRE_KHARJ_PAYER_ID)
  })
})

describe('مادرخرج helpers', () => {
  it('defaults the payer to the pot only after a مسئول is chosen', () => {
    const bare = event()
    expect(defaultDongPayerId(bare)).toBe('a')
    expect(isMadreKharjEnabled(bare)).toBe(false)
    const set = event({ madreKharj: { enabled: true, responsibleId: 'b', contributions: { a: 10 } } })
    expect(isMadreKharjEnabled(set)).toBe(true)
    expect(defaultDongPayerId(set)).toBe(MADRE_KHARJ_PAYER_ID)
    expect(memberHasPotRole(set, 'b')).toBe(true)
    expect(memberHasPotRole(set, 'a')).toBe(true)
    expect(memberHasPotRole(set, 'c')).toBe(false)
  })

  it('ignores a مسئول who is no longer a member', () => {
    const orphan = event({ madreKharj: { enabled: true, responsibleId: 'missing' } })
    expect(isMadreKharjEnabled(orphan)).toBe(false)
    expect(defaultDongPayerId(orphan)).toBe('a')
  })
})
