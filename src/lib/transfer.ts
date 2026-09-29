import { validateAmount } from './money'
import type { Account, TransferInput } from '../types'

export function validateTransfer(
  input: TransferInput,
  accounts: Account[],
): string | null {
  const amountError = validateAmount(input.amount)
  if (amountError) return amountError
  if (input.fromAccountId === input.toAccountId) return 'مبدأ و مقصد باید متفاوت باشند'
  const from = accounts.find((a) => a.id === input.fromAccountId)
  const to = accounts.find((a) => a.id === input.toAccountId)
  if (!from || from.archived) return 'حساب مبدأ معتبر نیست'
  if (!to || to.archived) return 'حساب مقصد معتبر نیست'
  if (input.amount > from.balance) return 'مبلغ از موجودی قابل انتقال بیشتر است'
  return null
}
