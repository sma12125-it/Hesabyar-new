import { itemEffectiveStatus, isDueSoon } from './installments'
import type { InstallmentItem, InstallmentPlan } from '../types'

export function dueReminderLines(
  plans: InstallmentPlan[],
  items: InstallmentItem[],
  today: string,
  leadDays: number,
): string[] {
  const lines: string[] = []
  for (const plan of plans) {
    if (plan.status !== 'active') continue
    for (const item of items.filter((row) => row.planId === plan.id)) {
      const status = itemEffectiveStatus(item, today)
      if (status === 'overdue') lines.push(`${plan.name}: قسط ${item.index} معوق است`)
      else if (isDueSoon(item, today, leadDays)) lines.push(`${plan.name}: قسط ${item.index} تا ${leadDays} روز دیگر`)
    }
  }
  return lines.slice(0, 5)
}

export async function notifyReminders(lines: string[]): Promise<void> {
  if (lines.length === 0 || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  const body = lines.join('\n')
  new Notification('یادآوری قسط', { body })
}
