import { describe, expect, it } from 'vitest'
import {
  generateInstallmentItems,
  homeInstallmentHints,
  isDueSoon,
  itemEffectiveStatus,
  nextPayableItem,
  planBadge,
  planHasPayment,
  validatePlanInput,
  validatePlanUpdate,
} from '../lib/installments'
import { isoToJalali, jalaliToIso, jalaaliMonthLength } from '../lib/jalaali'
import type { Account, InstallmentPlan } from '../types'

const today = '2026-09-15'
const account: Account = {
  id: 'acc',
  name: 'ملت',
  type: 'bank',
  archived: false,
  openingBalance: 90_000_000,
  balance: 90_000_000,
  createdAt: 1,
  updatedAt: 1,
}

describe('installment generation', () => {
  it('creates N monthly items on the same Jalali day', () => {
    const start = jalaliToIso(1405, 1, 6)!
    const items = generateInstallmentItems('p1', 3_200_000, 12, start)
    expect(items).toHaveLength(12)
    expect(items[0]?.index).toBe(1)
    expect(items[0]?.dueDate).toBe(start)
    expect(isoToJalali(items[1]!.dueDate)).toEqual({ jy: 1405, jm: 2, jd: 6 })
    expect(isoToJalali(items[11]!.dueDate)).toEqual({ jy: 1405, jm: 12, jd: 6 })
    expect(items.every((i) => i.amount === 3_200_000 && i.status === 'pending')).toBe(true)
  })

  it('keeps Jalali day 31 and only clamps months that lack that day', () => {
    const start = jalaliToIso(1403, 1, 31)!
    const items = generateInstallmentItems('p', 1, 13, start)
    for (let month = 1; month <= 6; month += 1) {
      expect(isoToJalali(items[month - 1]!.dueDate)).toEqual({ jy: 1403, jm: month, jd: 31 })
    }
    for (let month = 7; month <= 11; month += 1) {
      expect(isoToJalali(items[month - 1]!.dueDate)).toEqual({ jy: 1403, jm: month, jd: 30 })
    }
    expect(isoToJalali(items[11]!.dueDate)).toEqual({
      jy: 1403,
      jm: 12,
      jd: jalaaliMonthLength(1403, 12),
    })
    expect(isoToJalali(items[12]!.dueDate)).toEqual({ jy: 1404, jm: 1, jd: 31 })
  })

  it('clamps Esfand 31 in a non-leap year then returns to day 31', () => {
    const start = jalaliToIso(1404, 1, 31)!
    const items = generateInstallmentItems('p', 1, 13, start)
    expect(jalaaliMonthLength(1404, 12)).toBe(29)
    expect(isoToJalali(items[11]!.dueDate)).toEqual({ jy: 1404, jm: 12, jd: 29 })
    expect(isoToJalali(items[6]!.dueDate)).toEqual({ jy: 1404, jm: 7, jd: 30 })
    expect(isoToJalali(items[12]!.dueDate)).toEqual({ jy: 1405, jm: 1, jd: 31 })
  })
})

describe('installment status badges', () => {
  it('marks unpaid past-due items overdue and upcoming within 7 days as due-soon', () => {
    const items = generateInstallmentItems('p', 100, 3, '2026-08-12')
    items[0]!.dueDate = '2026-09-12'
    items[1]!.dueDate = '2026-09-18'
    items[2]!.dueDate = '2026-10-18'
    expect(itemEffectiveStatus(items[0]!, today)).toBe('overdue')
    expect(isDueSoon(items[1]!, today)).toBe(true)
    expect(planBadge(items, today)).toBe('overdue')

    items[0]!.status = 'paid'
    items[0]!.transactionId = 'tx1'
    expect(planBadge(items, today)).toBe('due-soon')
    expect(nextPayableItem(items, today)?.index).toBe(2)
  })

  it('locks amount/count/date edits after the first payment', () => {
    const items = generateInstallmentItems('p', 100, 3, today)
    expect(planHasPayment(items)).toBe(false)
    items[0]!.status = 'paid'
    items[0]!.transactionId = 'tx'
    expect(planHasPayment(items)).toBe(true)
    expect(
      validatePlanUpdate({ installmentAmount: 200 }, items, [account]),
    ).toBe('پس از اولین پرداخت فقط نام و حساب قابل ویرایش است')
    expect(validatePlanUpdate({ name: 'قسط موبایل' }, items, [account])).toBeNull()
  })

  it('builds loan items with a possibly different last payment', () => {
    expect(
      validatePlanInput(
        {
          name: 'وام خودرو',
          installmentAmount: 1,
          totalCount: 12,
          startDate: today,
          defaultAccountId: 'acc',
          kind: 'loan',
          principal: 12_000_000,
          annualRatePercent: 18,
        },
        [account],
      ),
    ).toBeNull()
    const items = generateInstallmentItems('p', [100, 100, 120], 3, today)
    expect(items.map((i) => i.amount)).toEqual([100, 100, 120])
  })

  it('validates create input', () => {
    expect(
      validatePlanInput(
        { name: 'لپ‌تاپ', installmentAmount: 5_500_000, totalCount: 12, startDate: today, defaultAccountId: 'acc' },
        [account],
      ),
    ).toBeNull()
    expect(
      validatePlanInput(
        { name: '', installmentAmount: 1, totalCount: 1, startDate: today, defaultAccountId: 'acc' },
        [account],
      ),
    ).toBe('نام برنامه الزامی است')
    expect(
      validatePlanInput(
        { name: 'x', installmentAmount: 1, totalCount: 1, startDate: today, defaultAccountId: 'missing' },
        [account],
      ),
    ).toBe('حساب پرداخت معتبر نیست')
  })

  it('lists overdue and 7-day upcoming hints for home', () => {
    const plan: InstallmentPlan = {
      id: 'p',
      name: 'وام',
      installmentAmount: 100,
      totalCount: 2,
      startDate: today,
      defaultAccountId: 'acc',
      categoryId: 'installments',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    }
    const items = generateInstallmentItems('p', 100, 2, '2026-09-10')
    items[1]!.dueDate = '2026-09-18'
    const hints = homeInstallmentHints([plan], items, today)
    expect(hints.map((h) => h.kind)).toEqual(['overdue', 'upcoming'])
  })
})
