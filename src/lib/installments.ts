import { INSTALLMENT_CATEGORY_ID } from './categories'
import { addJalaliMonthsIso } from './jalaali'
import { compareIso, daysUntil, isValidIsoDate } from './iso'
import { createId } from './ids'
import { buildLoanSchedule } from './loan'
import { validateAmount } from './money'
import type {
  Account,
  CreateInstallmentPlanInput,
  InstallmentItem,
  InstallmentPlan,
  PlanBadge,
  UpdateInstallmentPlanInput,
} from '../types'

export const DUE_SOON_DAYS = 7
export const MAX_INSTALLMENT_COUNT = 120

export function generateInstallmentItems(
  planId: string,
  amount: number | readonly number[],
  totalCount: number,
  startDate: string,
): InstallmentItem[] {
  const amounts = typeof amount === 'number' ? null : amount
  const count = amounts ? amounts.length : totalCount
  const items: InstallmentItem[] = []
  for (let i = 0; i < count; i += 1) {
    items.push({
      id: createId('ii'),
      planId,
      index: i + 1,
      dueDate: addJalaliMonthsIso(startDate, i),
      amount: amounts ? amounts[i]! : (amount as number),
      status: 'pending',
    })
  }
  return items
}

export function scheduleForPlanInput(input: {
  kind?: 'fixed' | 'loan'
  installmentAmount: number
  totalCount: number
  principal?: number
  annualRatePercent?: number
}): { installmentAmount: number; amounts: number[]; principal?: number; annualRatePercent?: number; kind: 'fixed' | 'loan' } {
  if (input.kind === 'loan') {
    const schedule = buildLoanSchedule(input.principal ?? 0, input.annualRatePercent ?? 0, input.totalCount)
    return {
      kind: 'loan',
      installmentAmount: schedule.monthlyPayment,
      amounts: schedule.amounts,
      principal: schedule.principal,
      annualRatePercent: schedule.annualRatePercent,
    }
  }
  return {
    kind: 'fixed',
    installmentAmount: input.installmentAmount,
    amounts: Array.from({ length: input.totalCount }, () => input.installmentAmount),
  }
}

export function itemEffectiveStatus(
  item: InstallmentItem,
  today: string,
): InstallmentItem['status'] {
  if (item.status === 'paid' || item.transactionId) return 'paid'
  if (compareIso(item.dueDate, today) < 0) return 'overdue'
  return 'pending'
}

export function isDueSoon(item: InstallmentItem, today: string, windowDays = DUE_SOON_DAYS): boolean {
  if (itemEffectiveStatus(item, today) !== 'pending') return false
  const days = daysUntil(item.dueDate, today)
  return days >= 0 && days <= windowDays
}

export function planBadge(items: InstallmentItem[], today: string): PlanBadge {
  const statuses = items.map((item) => itemEffectiveStatus(item, today))
  if (statuses.includes('overdue')) return 'overdue'
  if (items.some((item) => isDueSoon(item, today))) return 'due-soon'
  return 'ok'
}

export function paidCount(items: InstallmentItem[], today: string): number {
  return items.filter((item) => itemEffectiveStatus(item, today) === 'paid').length
}

export function remainingAmount(items: InstallmentItem[], today: string): number {
  return items
    .filter((item) => itemEffectiveStatus(item, today) !== 'paid')
    .reduce((sum, item) => sum + item.amount, 0)
}

export function nextPayableItem(items: InstallmentItem[], today: string): InstallmentItem | undefined {
  const unpaid = items
    .filter((item) => itemEffectiveStatus(item, today) !== 'paid')
    .sort((a, b) => a.index - b.index)
  const overdue = unpaid.find((item) => itemEffectiveStatus(item, today) === 'overdue')
  return overdue ?? unpaid[0]
}

export function planHasPayment(items: InstallmentItem[]): boolean {
  return items.some((item) => item.status === 'paid' || Boolean(item.transactionId))
}

export function validatePlanInput(input: CreateInstallmentPlanInput, accounts: Account[]): string | null {
  if (!input.name.trim()) return 'نام برنامه الزامی است'
  if (input.name.trim().length > 48) return 'نام برنامه خیلی طولانی است'
  if (!Number.isInteger(input.totalCount) || input.totalCount < 1) return 'تعداد اقساط باید حداقل ۱ باشد'
  if (input.totalCount > MAX_INSTALLMENT_COUNT) return 'تعداد اقساط خیلی زیاد است'
  if (!isValidIsoDate(input.startDate)) return 'تاریخ شروع نامعتبر است'
  const account = accounts.find((a) => a.id === input.defaultAccountId)
  if (!account || account.archived) return 'حساب پرداخت معتبر نیست'
  if (input.kind === 'loan') {
    try {
      buildLoanSchedule(input.principal ?? 0, input.annualRatePercent ?? -1, input.totalCount)
    } catch (err) {
      return err instanceof Error ? err.message : 'وام نامعتبر است'
    }
    return null
  }
  const amountError = validateAmount(input.installmentAmount)
  if (amountError) return amountError
  return null
}

export function validatePlanUpdate(
  patch: UpdateInstallmentPlanInput,
  items: InstallmentItem[],
  accounts: Account[],
): string | null {
  const locked = planHasPayment(items)
  if (
    locked &&
    (patch.installmentAmount != null ||
      patch.totalCount != null ||
      patch.startDate != null ||
      patch.kind != null ||
      patch.principal != null ||
      patch.annualRatePercent != null)
  ) {
    return 'پس از اولین پرداخت فقط نام و حساب قابل ویرایش است'
  }
  const name = patch.name
  if (name != null) {
    if (!name.trim()) return 'نام برنامه الزامی است'
    if (name.trim().length > 48) return 'نام برنامه خیلی طولانی است'
  }
  if (patch.kind === 'loan') {
    try {
      buildLoanSchedule(patch.principal ?? 0, patch.annualRatePercent ?? -1, patch.totalCount ?? 1)
    } catch (err) {
      return err instanceof Error ? err.message : 'وام نامعتبر است'
    }
  }
  if (patch.installmentAmount != null) {
    const amountError = validateAmount(patch.installmentAmount)
    if (amountError) return amountError
  }
  if (patch.totalCount != null) {
    if (!Number.isInteger(patch.totalCount) || patch.totalCount < 1) return 'تعداد اقساط باید حداقل ۱ باشد'
    if (patch.totalCount > MAX_INSTALLMENT_COUNT) return 'تعداد اقساط خیلی زیاد است'
  }
  if (patch.startDate != null && !isValidIsoDate(patch.startDate)) return 'تاریخ شروع نامعتبر است'
  if (patch.defaultAccountId != null) {
    const account = accounts.find((a) => a.id === patch.defaultAccountId)
    if (!account || account.archived) return 'حساب پرداخت معتبر نیست'
  }
  return null
}

export function defaultPayNote(planName: string, index: number, total: number): string {
  return `پرداخت قسط ${planName} ${index}/${total}`
}

export function categoryId(): typeof INSTALLMENT_CATEGORY_ID {
  return INSTALLMENT_CATEGORY_ID
}

export function homeInstallmentHints(
  plans: InstallmentPlan[],
  items: InstallmentItem[],
  today: string,
): Array<{ plan: InstallmentPlan; item: InstallmentItem; kind: 'overdue' | 'upcoming' }> {
  const active = plans.filter((p) => p.status === 'active')
  const hints: Array<{ plan: InstallmentPlan; item: InstallmentItem; kind: 'overdue' | 'upcoming' }> = []
  for (const plan of active) {
    const planItems = items.filter((i) => i.planId === plan.id)
    for (const item of planItems) {
      const status = itemEffectiveStatus(item, today)
      if (status === 'overdue') hints.push({ plan, item, kind: 'overdue' })
      else if (isDueSoon(item, today)) hints.push({ plan, item, kind: 'upcoming' })
    }
  }
  hints.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'overdue' ? -1 : 1
    return compareIso(a.item.dueDate, b.item.dueDate) || a.item.index - b.item.index
  })
  return hints
}
