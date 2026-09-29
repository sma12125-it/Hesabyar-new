import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dueReminderLines, notifyReminders } from '../lib/reminders'
import { useExtras } from '../store/Extras'
import { formatPersianDate } from '../lib/dates'
import { paidCount, planBadge } from '../lib/installments'
import { todayIso } from '../lib/iso'
import { formatRial, toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { SettingsButton } from '../components/SettingsButton'
import { SwipeRow } from '../components/SwipeRow'
import { useUiActions } from '../components/UiActions'
import type { InstallmentItem, InstallmentPlan, PlanBadge } from '../types'

const BADGE_LABEL: Record<PlanBadge, string> = {
  overdue: 'معوق',
  'due-soon': 'به‌زودی',
  ok: 'به‌روز',
}

export function InstallmentsPage({
  onScroll,
  onCreate,
}: {
  onScroll: (compact: boolean) => void
  onCreate: () => void
}) {
  const { plans, items } = useStore()
  const { reminders, setReminders } = useExtras()
  const navigate = useNavigate()
  const today = todayIso()
  const badgeRank: Record<PlanBadge, number> = { overdue: 0, 'due-soon': 1, ok: 2 }
  const active = plans
    .filter((p) => p.status === 'active')
    .slice()
    .sort((a, b) => {
      const aItems = items.filter((i) => i.planId === a.id)
      const bItems = items.filter((i) => i.planId === b.id)
      const rank = badgeRank[planBadge(aItems, today)] - badgeRank[planBadge(bItems, today)]
      if (rank !== 0) return rank
      return a.createdAt - b.createdAt
    })
  const finished = plans.filter((p) => p.status === 'completed' || p.status === 'archived')
  const empty = plans.length === 0
  const lines = dueReminderLines(plans, items, today, reminders.leadDays)

  useEffect(() => {
    if (reminders.enabled) void notifyReminders(lines)
  }, [reminders.enabled, reminders.leadDays, lines.join('|')])

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <h1>اقساط</h1>
        <SettingsButton />
        {empty ? <span style={{ width: 40 }} /> : (
          <button className="head-action" type="button" onClick={onCreate}>برنامه جدید</button>
        )}
      </div>

      <div className="lg-row reminder-bar">
        <div>
          <div className="plan-name">یادآوری قسط</div>
          <div className="plan-meta">{lines[0] ?? 'قسط نزدیکی برای یادآوری نیست'}</div>
        </div>
        <button
          className="cat-mini"
          type="button"
          onClick={() => {
            if (!reminders.enabled && typeof Notification !== 'undefined') void Notification.requestPermission()
            void setReminders({ ...reminders, enabled: !reminders.enabled })
          }}
        >
          {reminders.enabled ? 'روشن' : 'فعال‌سازی'}
        </button>
      </div>

      <button className="archive-entry" type="button" onClick={() => navigate('/installments/archive')}>
        <span>بایگانی اقساط</span>
        <span className="plan-meta">{toFaDigits(finished.length)} برنامه</span>
      </button>

      {empty ? (
        <div className="empty-state lg">
          <div className="empty-ico">📅</div>
          <h2>برنامه قسطی نداری</h2>
          <p>وام، خرید اقساطی یا اجاره را به‌صورت برنامه ثبت کن تا سررسیدها یادآوری شوند.</p>
          <button className="cta-confirm" type="button" onClick={onCreate}>
            ＋ ساخت برنامه اقساط
          </button>
        </div>
      ) : active.length === 0 ? (
        <div className="empty-state lg">
          <div className="empty-ico">📦</div>
          <h2>برنامه فعالی نیست</h2>
          <p>اقساط پایان‌یافته از این لیست برداشته شده‌اند و در بایگانی هستند.</p>
        </div>
      ) : (
        <>
          <div className="section-head" style={{ marginTop: 14 }}>
            <h2>برنامه‌های فعال</h2>
            <span className="link">{toFaDigits(active.length)} مورد</span>
          </div>
          <div className="plan-list">
            {active.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                items={items.filter((i) => i.planId === plan.id)}
                today={today}
                onClick={() => navigate(`/installments/${plan.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function PlanCard({
  plan,
  items,
  today,
  onClick,
}: {
  plan: InstallmentPlan
  items: InstallmentItem[]
  today: string
  onClick: () => void
}) {
  const actions = useUiActions()
  const paid = paidCount(items, today)
  const badge = plan.status === 'completed' ? 'ok' : planBadge(items, today)
  const next = items
    .filter((i) => i.status !== 'paid' && !i.transactionId)
    .sort((a, b) => a.index - b.index)[0]
  const percent = plan.totalCount > 0 ? Math.round((paid / plan.totalCount) * 100) : 0

  return (
    <SwipeRow
      onEdit={actions ? () => actions.editPlan(plan.id) : undefined}
      onDelete={actions ? () => actions.deletePlan(plan.id) : undefined}
    >
      <button className="plan-card lg-row" type="button" onClick={onClick}>
      <div className="plan-top">
        <div>
          <div className="plan-name">{plan.name}</div>
          <div className="plan-meta">
            {plan.status === 'archived'
              ? 'آرشیو شده'
              : plan.status === 'completed'
                ? 'همه اقساط پرداخت شد'
                : next
                  ? `سررسید بعدی: ${formatPersianDate(next.dueDate)}`
                  : 'بدون سررسید مانده'}
          </div>
        </div>
        <div className="plan-right">
          <span className={`badge ${plan.status === 'archived' ? 'pending' : badge}`}>
            {plan.status === 'archived' ? 'آرشیو' : plan.status === 'completed' ? 'تمام' : BADGE_LABEL[badge]}
          </span>
          <div className="plan-amount">
            {formatRial(plan.installmentAmount)}
            <span className="unit">ریال</span>
          </div>
        </div>
      </div>
      <div className={`progress-bar${badge === 'overdue' && plan.status === 'active' ? ' overdue' : ''}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-label">
        <span>
          {toFaDigits(paid)} از {toFaDigits(plan.totalCount)} قسط
        </span>
        <span>مانده: {toFaDigits(Math.max(plan.totalCount - paid, 0))}</span>
      </div>
    </button>
    </SwipeRow>
  )
}
