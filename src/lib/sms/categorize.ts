import type { SmsDirection } from './types'

const RULES: Array<{ pattern: RegExp; categoryId: string; direction?: SmsDirection }> = [
  { pattern: /حقوق/, categoryId: 'salary', direction: 'INCOME' },
  { pattern: /سوپر|خواربار|رستوران/, categoryId: 'food', direction: 'EXPENSE' },
  { pattern: /قبض|آب|برق|گاز|تلفن/, categoryId: 'bills', direction: 'EXPENSE' },
  { pattern: /بنزین|تاکسی|مترو|حمل/, categoryId: 'transport', direction: 'EXPENSE' },
  { pattern: /خرید|فروشگاه/, categoryId: 'shopping', direction: 'EXPENSE' },
  { pattern: /اجاره/, categoryId: 'other-exp', direction: 'EXPENSE' },
  { pattern: /هدیه/, categoryId: 'gift', direction: 'INCOME' },
]

/** Suggestion only. Confirm still requires the user. */
export function suggestCategory(text: string, direction: SmsDirection): string | null {
  if (direction === 'TRANSFER') return 'transfer'
  for (const rule of RULES) {
    if (rule.direction && rule.direction !== direction) continue
    if (rule.pattern.test(text)) return rule.categoryId
  }
  if (direction === 'INCOME') return 'other-inc'
  if (direction === 'EXPENSE') return 'other-exp'
  return null
}
