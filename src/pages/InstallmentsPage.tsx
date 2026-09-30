import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dueReminderLines, notifyReminders } from '../lib/reminders'
import { useExtras } from '../store/Extras'
import { formatPersianDate } from '../lib/dates'
import { overdueCount, paidCount, planBadge } from '../lib/installments'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { SettingsButton } from '../components/SettingsButton'
import { SwipeRow } from '../components/SwipeRow'
import { useUiActions } from '../components/UiActions'
import { ChequeSheet } from '../components/ChequeSheet'
import type { Cheque, InstallmentItem, InstallmentPlan, PlanBadge } from '../types'

const BADGE_LABEL: Record<PlanBadge, string> = {
  overdue: 'معوق',
  'due-soon': 'به‌زودی',
  ok: 'به‌روز',
}

const CHEQUE_STATUS_LABEL: Record<Cheque['status'], { label: string; className: string }> = {
  pending: { label: 'در جریان وصول', className: 'pending' },
  cleared: { label: 'پاس‌شده', className: 'ok' },
  bounced: { label: 'برگشتی', className: 'overdue' },
}

export function InstallmentsPage({
  onScroll,
  onCreate,
}: {
  onScroll: (compact: boolean) => void
  onCreate: () => void
}) {
  const { plans, items } = useStore()
  const { reminders, setReminders, cheques, formatMoney } = useExtras()
  const navigate = useNavigate()
  const today = todayIso()

  const [activeTab, setActiveTab] = useState<'plans' | 'cheques'>('plans')
  const [chequeSheetOpen, setChequeSheetOpen] = useState(false)
  const [editingCheque, setEditingCheque] = useState<Cheque | undefined>(undefined)
  const [chequeFilter, setChequeFilter] = useState<'all' | 'payable' | 'receivable'>('all')

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

  const filteredCheques = cheques.filter((c) => {
    if (chequeFilter === 'all') return true
    return c.direction === chequeFilter
  })

  const totalPayablePending = cheques
    .filter((c) => c.direction === 'payable' && c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  const totalReceivablePending = cheques
    .filter((c) => c.direction === 'receivable' && c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <h1>{activeTab === 'plans' ? 'اقساط و وام' : 'چک‌های صیادی'}</h1>
        <SettingsButton />
        {activeTab === 'plans' ? (
          empty ? (
            <span style={{ width: 40 }} />
          ) : (
            <button className="head-action" type="button" onClick={onCreate}>
              برنامه جدید
            </button>
          )
        ) : (
          <button
            className="head-action"
            type="button"
            onClick={() => {
              setEditingCheque(undefined)
              setChequeSheetOpen(true)
            }}
          >
            ＋ ثبت چک
          </button>
        )}
      </div>

      {/* Main Tab Toggle */}
      <div className="seg" role="tablist" style={{ margin: '10px 0 16px' }}>
        <button
          className={`seg-btn${activeTab === 'plans' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('plans')}
        >
          📅 برنامه‌های اقساط ({toFaDigits(plans.length)})
        </button>
        <button
          className={`seg-btn${activeTab === 'cheques' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('cheques')}
        >
          🧾 چک‌های صیادی ({toFaDigits(cheques.length)})
        </button>
      </div>

      {activeTab === 'plans' ? (
        <>
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
        </>
      ) : (
        /* Cheques View */
        <div>
          {/* Cheque Totals KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>چک‌های پرداختی معلق</span>
              <strong className="down" style={{ fontSize: 18 }}>{formatMoney(totalPayablePending)}</strong>
              <small>{toFaDigits(cheques.filter((c) => c.direction === 'payable' && c.status === 'pending').length)} فقره</small>
            </div>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>چک‌های دریافتی معلق</span>
              <strong className="up" style={{ fontSize: 18 }}>{formatMoney(totalReceivablePending)}</strong>
              <small>{toFaDigits(cheques.filter((c) => c.direction === 'receivable' && c.status === 'pending').length)} فقره</small>
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button
              className={`cat-mini${chequeFilter === 'all' ? ' active' : ''}`}
              type="button"
              onClick={() => setChequeFilter('all')}
            >
              همه ({toFaDigits(cheques.length)})
            </button>
            <button
              className={`cat-mini${chequeFilter === 'payable' ? ' active' : ''}`}
              type="button"
              onClick={() => setChequeFilter('payable')}
            >
              پرداختی ({toFaDigits(cheques.filter((c) => c.direction === 'payable').length)})
            </button>
            <button
              className={`cat-mini${chequeFilter === 'receivable' ? ' active' : ''}`}
              type="button"
              onClick={() => setChequeFilter('receivable')}
            >
              دریافتی ({toFaDigits(cheques.filter((c) => c.direction === 'receivable').length)})
            </button>
          </div>

          {cheques.length === 0 ? (
            <div className="empty-state lg">
              <div className="empty-ico">🧾</div>
              <h2>چک صیادی ثبت نشده</h2>
              <p>چک‌های پرداختی یا دریافتی را برای یادآوری سررسید و ثبت وضعیت وصول اینجا مدیریت کن.</p>
              <button
                className="cta-confirm"
                type="button"
                onClick={() => {
                  setEditingCheque(undefined)
                  setChequeSheetOpen(true)
                }}
              >
                ＋ ثبت اولین چک
              </button>
            </div>
          ) : filteredCheques.length === 0 ? (
            <p className="sheet-sub">چکی در این دسته یافت نشد.</p>
          ) : (
            <div className="plan-list">
              {filteredCheques.map((c) => {
                const statusMeta = CHEQUE_STATUS_LABEL[c.status]
                const isOverdue = c.status === 'pending' && c.dueDate < today
                return (
                  <button
                    key={c.id}
                    className="plan-card lg-row"
                    type="button"
                    onClick={() => {
                      setEditingCheque(c)
                      setChequeSheetOpen(true)
                    }}
                    style={{ textAlign: 'right', cursor: 'pointer' }}
                  >
                    <div className="plan-top">
                      <div>
                        <div className="plan-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{c.direction === 'payable' ? '📤' : '📥'}</span>
                          <span>{c.party}</span>
                          <span style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', fontWeight: 'normal' }}>
                            ({c.bankName})
                          </span>
                        </div>
                        <div className="plan-meta">
                          سررسید: {formatPersianDate(c.dueDate)}
                          {c.sayadId ? ` · صیاد: ${toFaDigits(c.sayadId.slice(-4))}` : ''}
                        </div>
                      </div>
                      <div className="plan-right">
                        <span className={`badge ${isOverdue ? 'overdue' : statusMeta.className}`}>
                          {isOverdue ? 'معوق' : statusMeta.label}
                        </span>
                        <div className={`plan-amount ${c.direction === 'payable' ? 'down' : 'up'}`}>
                          {formatMoney(c.amount)}
                        </div>
                      </div>
                    </div>
                    {c.note ? (
                      <div style={{ fontSize: 12, color: 'var(--hy-text-secondary)', marginTop: 6 }}>
                        بابت: {c.note}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {chequeSheetOpen ? (
        <ChequeSheet
          cheque={editingCheque}
          onClose={() => {
            setChequeSheetOpen(false)
            setEditingCheque(undefined)
          }}
        />
      ) : null}
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
  const { formatMoney } = useExtras()
  const paid = paidCount(items, today)
  const overdue = overdueCount(items, today)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="plan-name">{plan.name}</span>
              {overdue > 0 && plan.status === 'active' ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 8,
                    background: 'rgba(220, 38, 38, 0.16)',
                    color: 'var(--hy-expense)',
                    border: '0.5px solid rgba(220, 38, 38, 0.35)',
                  }}
                  title="تعداد اقساط معوق"
                >
                  ⚠️ {toFaDigits(overdue)} معوق
                </span>
              ) : null}
            </div>
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
              {formatMoney(plan.installmentAmount)}
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
          <div style={{ display: 'flex', gap: 8 }}>
            {overdue > 0 && plan.status === 'active' ? (
              <span style={{ color: 'var(--hy-expense)', fontWeight: 700 }}>
                {toFaDigits(overdue)} قسط معوق
              </span>
            ) : null}
            <span>مانده: {toFaDigits(Math.max(plan.totalCount - paid, 0))}</span>
          </div>
        </div>
      </button>
    </SwipeRow>
  )
}
