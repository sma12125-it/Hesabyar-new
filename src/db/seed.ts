import { deriveOpeningBalance } from '../lib/balance'
import { INSTALLMENT_CATEGORY_ID } from '../lib/categories'
import { generateInstallmentItems, defaultPayNote } from '../lib/installments'
import { addCalendarMonths, addDaysIso, isoFromTimestamp, todayIso } from '../lib/iso'
import type { Account, InstallmentItem, InstallmentPlan, Transaction } from '../types'

const day = 24 * 60 * 60 * 1000

export function demoDataset(now = Date.now()): {
  accounts: Account[]
  transactions: Transaction[]
  plans: InstallmentPlan[]
  items: InstallmentItem[]
} {
  const today = todayIso(new Date(now))
  const walletId = 'acc_wallet'
  const mellatId = 'acc_mellat'
  const homeId = 'acc_home'

  const baseAccounts = [
    {
      id: walletId,
      name: 'کیف پول نقدی',
      type: 'cash' as const,
      archived: false,
      createdAt: now - 40 * day,
      updatedAt: now,
    },
    {
      id: mellatId,
      name: 'ملت — جاری',
      type: 'bank' as const,
      archived: false,
      createdAt: now - 80 * day,
      updatedAt: now,
    },
    {
      id: homeId,
      name: 'پس‌انداز مسکن',
      type: 'bank' as const,
      archived: false,
      createdAt: now - 120 * day,
      updatedAt: now,
    },
  ]

  const transferId = 'tr_demo_home'
  const transactions: Transaction[] = [
    {
      id: 'tx_market',
      kind: 'expense',
      amount: 450_000,
      accountId: walletId,
      categoryId: 'food',
      note: 'سوپرمارکت دیلی',
      date: isoFromTimestamp(now - 2 * 60 * 60 * 1000),
      createdAt: now - 2 * 60 * 60 * 1000,
    },
    {
      id: 'tx_salary',
      kind: 'income',
      amount: 185_000_000,
      accountId: mellatId,
      categoryId: 'salary',
      note: 'حقوق ماهانه',
      date: isoFromTimestamp(now - day),
      createdAt: now - day,
    },
    {
      id: 'tx_gas',
      kind: 'expense',
      amount: 1_200_000,
      accountId: mellatId,
      categoryId: 'transport',
      note: 'بنزین جایگاه آزادی',
      date: isoFromTimestamp(now - 2 * day),
      createdAt: now - 2 * day,
    },
    {
      id: 'tx_transfer_out',
      kind: 'transferOut',
      amount: 5_000_000,
      accountId: mellatId,
      counterpartyAccountId: homeId,
      transferId,
      categoryId: 'transfer',
      note: 'انتقال ماهانه به پس‌انداز',
      date: isoFromTimestamp(now - 3 * day),
      createdAt: now - 3 * day,
    },
    {
      id: 'tx_transfer_in',
      kind: 'transferIn',
      amount: 5_000_000,
      accountId: homeId,
      counterpartyAccountId: mellatId,
      transferId,
      categoryId: 'transfer',
      note: 'انتقال ماهانه به پس‌انداز',
      date: isoFromTimestamp(now - 3 * day),
      createdAt: now - 3 * day + 1,
    },
  ]

  const car: InstallmentPlan = {
    id: 'plan_car',
    name: 'وام خودرو',
    installmentAmount: 8_500_000,
    totalCount: 12,
    startDate: addCalendarMonths(addDaysIso(today, -3), -2),
    defaultAccountId: mellatId,
    categoryId: INSTALLMENT_CATEGORY_ID,
    status: 'active',
    createdAt: now - 90 * day,
    updatedAt: now,
  }
  const phone: InstallmentPlan = {
    id: 'plan_phone',
    name: 'قسط موبایل',
    installmentAmount: 3_200_000,
    totalCount: 12,
    startDate: addCalendarMonths(addDaysIso(today, 3), -6),
    defaultAccountId: mellatId,
    categoryId: INSTALLMENT_CATEGORY_ID,
    status: 'active',
    createdAt: now - 200 * day,
    updatedAt: now,
  }
  const gear: InstallmentPlan = {
    id: 'plan_gear',
    name: 'اجاره تجهیزات',
    installmentAmount: 4_000_000,
    totalCount: 6,
    startDate: addCalendarMonths(addDaysIso(today, 16), -4),
    defaultAccountId: mellatId,
    categoryId: INSTALLMENT_CATEGORY_ID,
    status: 'active',
    createdAt: now - 130 * day,
    updatedAt: now,
  }

  const carItems = generateInstallmentItems(car.id, car.installmentAmount, car.totalCount, car.startDate)
  const phoneItems = generateInstallmentItems(phone.id, phone.installmentAmount, phone.totalCount, phone.startDate)
  const gearItems = generateInstallmentItems(gear.id, gear.installmentAmount, gear.totalCount, gear.startDate)

  markPaid(carItems, 2, car, mellatId, transactions, now)
  markPaid(phoneItems, 6, phone, mellatId, transactions, now)
  markPaid(gearItems, 4, gear, mellatId, transactions, now)

  const targets: Record<string, number> = {
    [walletId]: 12_500_000,
    [mellatId]: 84_200_000,
    [homeId]: 320_000_000,
  }

  const accounts: Account[] = baseAccounts.map((a) => ({
    ...a,
    openingBalance: deriveOpeningBalance(targets[a.id], transactions, a.id),
    balance: targets[a.id],
  }))

  return {
    accounts,
    transactions,
    plans: [car, phone, gear],
    items: [...carItems, ...phoneItems, ...gearItems],
  }
}

function markPaid(
  items: InstallmentItem[],
  count: number,
  plan: InstallmentPlan,
  accountId: string,
  transactions: Transaction[],
  now: number,
) {
  for (let i = 0; i < count; i += 1) {
    const item = items[i]
    const txId = `tx_inst_${plan.id}_${item.index}`
    const createdAt = now - (count - i) * 28 * day - 8 * 60 * 60 * 1000
    item.status = 'paid'
    item.paidAt = isoFromTimestamp(createdAt)
    item.transactionId = txId
    transactions.push({
      id: txId,
      kind: 'expense',
      amount: item.amount,
      accountId,
      categoryId: INSTALLMENT_CATEGORY_ID,
      installmentItemId: item.id,
      note: defaultPayNote(plan.name, item.index, plan.totalCount),
      date: item.dueDate,
      createdAt,
    })
  }
}
