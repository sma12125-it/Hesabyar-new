import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { dueReminderLines, notifyReminders } from '../lib/reminders'
import { useExtras } from '../store/Extras'
import { formatPersianDateFull } from '../lib/dates'
import { nextPayableItem, overdueCount, paidCount, planBadge } from '../lib/installments'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { SettingsButton } from '../components/SettingsButton'
import { SwipeRow } from '../components/SwipeRow'
import { useUiActions } from '../components/UiActions'
import { ChequeSheet } from '../components/ChequeSheet'
import { DebtSheet } from '../components/DebtSheet'
import type { Cheque, DebtLoan, InstallmentItem, InstallmentPlan, PlanBadge } from '../types'

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
  initialTab,
}: {
  onScroll: (compact: boolean) => void
  onCreate: () => void
  initialTab?: 'plans' | 'cheques' | 'debts'
}) {
  const { plans, items } = useStore()
  const { reminders, setReminders, cheques, debts, formatMoney, deleteCheque, saveCheque, deleteDebt, unsettleDebt } = useExtras()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayIso()

  const pathTab = location.pathname.includes('/debts')
    ? 'debts'
    : location.pathname.includes('/cheques')
      ? 'cheques'
      : undefined
  const queryTab = searchParams.get('tab') as 'plans' | 'cheques' | 'debts' | null

  const [activeTab, setActiveTabState] = useState<'plans' | 'cheques' | 'debts'>(
    initialTab || pathTab || queryTab || 'plans',
  )

  const setActiveTab = (tab: 'plans' | 'cheques' | 'debts') => {
    setActiveTabState(tab)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true },
    )
  }

  // Modals
  const [chequeSheetOpen, setChequeSheetOpen] = useState(false)
  const [editingCheque, setEditingCheque] = useState<Cheque | undefined>(undefined)
  const [chequeFilter, setChequeFilter] = useState<'all' | 'payable' | 'receivable' | 'cleared'>('all')

  const [debtSheetOpen, setDebtSheetOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<DebtLoan | undefined>(undefined)
  const [debtFilter, setDebtFilter] = useState<'all' | 'borrowed' | 'lent' | 'settled'>('all')
  const [planFilter, setPlanFilter] = useState<'all' | 'fixed' | 'loans'>('all')

  // Sorting for Installments (Request 14)
  const [planSort, setPlanSort] = useState<'due-date' | 'overdue' | 'amount' | 'manual'>('due-date')
  const [planManualOrder, setPlanManualOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hy_plans_manual_order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Listen for event from InstallmentPlanSheet when user converts plan to debt
  useEffect(() => {
    const onOpenDebt = (event: Event) => {
      const detail = (event as CustomEvent<{ amount?: number; party?: string }>).detail
      if (detail) {
        setEditingDebt({
          id: '',
          direction: 'borrowed',
          party: detail.party || '',
          amount: detail.amount || 0,
          note: '',
          status: 'active',
          createdAt: Date.now(),
        })
      } else {
        setEditingDebt(undefined)
      }
      setActiveTabState('debts')
      setDebtSheetOpen(true)
    }
    window.addEventListener('hy-open-debt-sheet', onOpenDebt)
    return () => window.removeEventListener('hy-open-debt-sheet', onOpenDebt)
  }, [])

  // Active plans and sorting (Request 14)
  const activePlans = useMemo(() => {
    const raw = plans.filter((p) => p.status === 'active')

    if (planSort === 'due-date') {
      return raw.slice().sort((a, b) => {
        const aItems = items.filter((i) => i.planId === a.id)
        const bItems = items.filter((i) => i.planId === b.id)
        const nextA = nextPayableItem(aItems, today)?.dueDate || '9999-99-99'
        const nextB = nextPayableItem(bItems, today)?.dueDate || '9999-99-99'
        return nextA.localeCompare(nextB)
      })
    }
    if (planSort === 'overdue') {
      return raw.slice().sort((a, b) => {
        const aItems = items.filter((i) => i.planId === a.id)
        const bItems = items.filter((i) => i.planId === b.id)
        const overA = overdueCount(aItems, today)
        const overB = overdueCount(bItems, today)
        return overB - overA
      })
    }
    if (planSort === 'amount') {
      return raw.slice().sort((a, b) => b.installmentAmount - a.installmentAmount)
    }
    if (planSort === 'manual') {
      return raw.slice().sort((a, b) => {
        const idxA = planManualOrder.indexOf(a.id)
        const idxB = planManualOrder.indexOf(b.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    }
    return raw
  }, [plans, items, today, planSort, planManualOrder])

  function movePlanUp(id: string) {
    const currentList = activePlans.map((p) => p.id)
    const index = currentList.indexOf(id)
    if (index <= 0) return
    const next = [...currentList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setPlanManualOrder(next)
    try {
      localStorage.setItem('hy_plans_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  function movePlanDown(id: string) {
    const currentList = activePlans.map((p) => p.id)
    const index = currentList.indexOf(id)
    if (index === -1 || index >= currentList.length - 1) return
    const next = [...currentList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setPlanManualOrder(next)
    try {
      localStorage.setItem('hy_plans_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const finished = plans.filter((p) => p.status === 'completed' || p.status === 'archived')
  const empty = plans.length === 0
  const lines = dueReminderLines(plans, items, today, reminders.leadDays)

  useEffect(() => {
    if (reminders.enabled) void notifyReminders(lines)
  }, [reminders.enabled, reminders.leadDays, lines.join('|')])

  // Request 7: Separate cleared cheques from active/pending cheques
  const activeCheques = useMemo(() => cheques.filter((c) => c.status !== 'cleared'), [cheques])
  const clearedCheques = useMemo(() => cheques.filter((c) => c.status === 'cleared'), [cheques])

  const filteredCheques = useMemo(() => {
    if (chequeFilter === 'cleared') return clearedCheques
    if (chequeFilter === 'payable') return activeCheques.filter((c) => c.direction === 'payable')
    if (chequeFilter === 'receivable') return activeCheques.filter((c) => c.direction === 'receivable')
    return activeCheques
  }, [activeCheques, clearedCheques, chequeFilter])

  const totalPayablePending = activeCheques
    .filter((c) => c.direction === 'payable' && c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  const totalReceivablePending = activeCheques
    .filter((c) => c.direction === 'receivable' && c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)

  // Debt calculations
  const filteredDebts = useMemo(() => {
    if (debtFilter === 'settled') return debts.filter((d) => d.status === 'settled')
    if (debtFilter === 'borrowed') return debts.filter((d) => d.status === 'active' && d.direction === 'borrowed')
    if (debtFilter === 'lent') return debts.filter((d) => d.status === 'active' && d.direction === 'lent')
    return debts.filter((d) => d.status === 'active')
  }, [debts, debtFilter])

  const totalBorrowedActive = debts
    .filter((d) => d.direction === 'borrowed' && d.status === 'active')
    .reduce((sum, d) => sum + d.amount, 0)

  const totalLentActive = debts
    .filter((d) => d.direction === 'lent' && d.status === 'active')
    .reduce((sum, d) => sum + d.amount, 0)

  // Quick Action Handlers for Debts & Cheques
  async function handleDeleteDebt(id: string) {
    if (confirm('آیا از حذف این مورد بدهی / طلب مطمئن هستید؟')) {
      await deleteDebt(id)
      notifyUser('مورد بدهی / طلب حذف شد')
    }
  }

  async function handleUnsettleDebtQuick(id: string) {
    await unsettleDebt(id)
    notifyUser('بدهی / طلب به وضعیت پرداخت‌نشده (جاری) بازگردانده شد')
  }

  async function handleDeleteCheque(id: string) {
    if (confirm('آیا از حذف این چک اطمینان دارید؟')) {
      await deleteCheque(id)
      notifyUser('چک حذف شد')
    }
  }

  async function handleRestoreChequeToPending(cheque: Cheque) {
    await saveCheque({
      ...cheque,
      status: 'pending',
      clearedAt: undefined,
    })
    notifyUser('چک از بایگانی خارج و به چک‌های جاری معلق بازگردانده شد')
  }

  return (
    <div className="app-scroll page-installments" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      {/* Top Header */}
      <div className="top-row">
        <div>
          <h1>اقساط، وام‌ها و تعهدات</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
            مدیریت برنامه‌های اقساط، چک‌های صیادی، قرض‌الحسنه و بدهی‌ها
          </p>
        </div>
        <SettingsButton showLabel={true} />
      </div>

      {/* Main 3 Tabs */}
      <div className="seg" role="tablist" style={{ margin: '14px 0 16px' }}>
        <button
          className={`seg-btn${activeTab === 'plans' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('plans')}
          style={{ fontSize: '11px', padding: '7px 4px', fontWeight: 700 }}
        >
          📅 اقساط ({toFaDigits(plans.length)})
        </button>
        <button
          className={`seg-btn${activeTab === 'debts' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('debts')}
          style={{ fontSize: '11px', padding: '7px 4px', fontWeight: 700 }}
        >
          🤝 بدهی و طلب ({toFaDigits(debts.filter((d) => d.status === 'active').length)})
        </button>
        <button
          className={`seg-btn${activeTab === 'cheques' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('cheques')}
          style={{ fontSize: '11px', padding: '7px 4px', fontWeight: 700 }}
        >
          🧾 چک‌ها ({toFaDigits(activeCheques.length)})
        </button>
      </div>

      {/* TAB 1: INSTALLMENT PLANS */}
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
          ) : activePlans.length === 0 ? (
            <div className="empty-state lg">
              <div className="empty-ico">📦</div>
              <h2>برنامه فعالی نیست</h2>
              <p>اقساط پایان‌یافته از این لیست برداشته شده‌اند و در بایگانی هستند.</p>
              <button className="cta-confirm" type="button" onClick={onCreate} style={{ width: 'auto', marginTop: 12 }}>
                ＋ ساخت برنامه جدید
              </button>
            </div>
          ) : (
            <>
              {/* Filter and Sorting Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 8 }}>
                <div className="section-head" style={{ margin: 0 }}>
                  <h2>برنامه‌های فعال اقساط و وام ({toFaDigits(activePlans.length)})</h2>
                </div>
                <button className="cat-mini" type="button" onClick={onCreate} style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(15, 118, 110, 0.2)', color: 'var(--hy-teal)' }}>
                  ＋ برنامه جدید
                </button>
              </div>

              {/* Sub-filter pills (Fixed vs Loans) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
                <button
                  type="button"
                  className={`cat-mini${planFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setPlanFilter('all')}
                >
                  همه ({toFaDigits(activePlans.length)})
                </button>
                <button
                  type="button"
                  className={`cat-mini${planFilter === 'fixed' ? ' active' : ''}`}
                  onClick={() => setPlanFilter('fixed')}
                >
                  اقساط ثابت ({toFaDigits(activePlans.filter((p) => !p.name.includes('وام') && !p.name.includes('بانک') && !p.name.includes('تسهیلات')).length)})
                </button>
                <button
                  type="button"
                  className={`cat-mini${planFilter === 'loans' ? ' active' : ''}`}
                  onClick={() => setPlanFilter('loans')}
                >
                  وام‌های بانکی ({toFaDigits(activePlans.filter((p) => p.name.includes('وام') || p.name.includes('بانک') || p.name.includes('تسهیلات')).length)})
                </button>
              </div>

              {/* Request 14: Installments Sorting Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                  🔄 سورت اقساط:
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`cat-mini${planSort === 'due-date' ? ' active' : ''}`}
                    onClick={() => setPlanSort('due-date')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    نزدیک‌ترین سررسید
                  </button>
                  <button
                    type="button"
                    className={`cat-mini${planSort === 'overdue' ? ' active' : ''}`}
                    onClick={() => setPlanSort('overdue')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    بیشترین اقساط معوق
                  </button>
                  <button
                    type="button"
                    className={`cat-mini${planSort === 'amount' ? ' active' : ''}`}
                    onClick={() => setPlanSort('amount')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    مبلغ قسط
                  </button>
                  <button
                    type="button"
                    className={`cat-mini${planSort === 'manual' ? ' active' : ''}`}
                    onClick={() => setPlanSort('manual')}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    جابجایی دستی
                  </button>
                </div>
              </div>

              {/* Plan List */}
              <div className="plan-list">
                {activePlans
                  .filter((p) => {
                    if (planFilter === 'loans') {
                      return p.name.includes('وام') || p.name.includes('بانک') || p.name.includes('تسهیلات')
                    }
                    if (planFilter === 'fixed') {
                      return !p.name.includes('وام') && !p.name.includes('بانک') && !p.name.includes('تسهیلات')
                    }
                    return true
                  })
                  .map((plan, idx, arr) => (
                    <div
                      key={plan.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                      }}
                    >
                      {/* Manual Reordering Buttons for Plans (Request 14) */}
                      {planSort === 'manual' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              movePlanUp(plan.id)
                            }}
                            disabled={idx === 0}
                            style={{
                              width: 26,
                              height: 24,
                              borderRadius: 6,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: idx === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                              cursor: idx === 0 ? 'default' : 'pointer',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10,
                            }}
                            title="انتقال برنامه به بالا"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              movePlanDown(plan.id)
                            }}
                            disabled={idx === arr.length - 1}
                            style={{
                              width: 26,
                              height: 24,
                              borderRadius: 6,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: idx === arr.length - 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                              cursor: idx === arr.length - 1 ? 'default' : 'pointer',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10,
                            }}
                            title="انتقال برنامه به پایین"
                          >
                            ▼
                          </button>
                        </div>
                      ) : null}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <PlanCard
                          plan={plan}
                          items={items.filter((i) => i.planId === plan.id)}
                          today={today}
                          onClick={() => navigate(`/installments/${plan.id}`)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      ) : activeTab === 'debts' ? (
        /* TAB 2: DEBTS AND LOANS VIEW */
        <div>
          {/* Debt Totals KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>بدهی فعال (قرض گرفته‌ام)</span>
              <strong className="down" style={{ fontSize: 18 }}>{formatMoney(totalBorrowedActive)}</strong>
              <small>{toFaDigits(debts.filter((d) => d.direction === 'borrowed' && d.status === 'active').length)} مورد</small>
            </div>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>طلب فعال (قرض داده‌ام)</span>
              <strong className="up" style={{ fontSize: 18 }}>{formatMoney(totalLentActive)}</strong>
              <small>{toFaDigits(debts.filter((d) => d.direction === 'lent' && d.status === 'active').length)} مورد</small>
            </div>
          </div>

          {/* Filter pills & Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                className={`cat-mini${debtFilter === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setDebtFilter('all')}
              >
                فعال‌ها ({toFaDigits(debts.filter((d) => d.status === 'active').length)})
              </button>
              <button
                className={`cat-mini${debtFilter === 'borrowed' ? ' active' : ''}`}
                type="button"
                onClick={() => setDebtFilter('borrowed')}
              >
                بدهی‌های من ({toFaDigits(debts.filter((d) => d.direction === 'borrowed' && d.status === 'active').length)})
              </button>
              <button
                className={`cat-mini${debtFilter === 'lent' ? ' active' : ''}`}
                type="button"
                onClick={() => setDebtFilter('lent')}
              >
                طلب‌های من ({toFaDigits(debts.filter((d) => d.direction === 'lent' && d.status === 'active').length)})
              </button>
              <button
                className={`cat-mini${debtFilter === 'settled' ? ' active' : ''}`}
                type="button"
                onClick={() => setDebtFilter('settled')}
              >
                تسویه‌شده‌ها ({toFaDigits(debts.filter((d) => d.status === 'settled').length)})
              </button>
            </div>

            <button
              type="button"
              className="cat-mini"
              onClick={() => {
                setEditingDebt(undefined)
                setDebtSheetOpen(true)
              }}
              style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(15, 118, 110, 0.2)', color: 'var(--hy-teal)' }}
            >
              ＋ ثبت بدهی / طلب
            </button>
          </div>

          {debts.length === 0 ? (
            <div className="empty-state lg">
              <div className="empty-ico">🤝</div>
              <h2>قرض یا بدهی ثبت نشده است</h2>
              <p>اگر پولی از کسی قرض گرفته‌اید یا به دوستی قرض داده‌اید و حالت اقساطی ندارد، اینجا به راحتی ثبت و سررسید آن را ردیابی کنید.</p>
              <button
                className="cta-confirm"
                type="button"
                onClick={() => {
                  setEditingDebt(undefined)
                  setDebtSheetOpen(true)
                }}
              >
                ＋ ثبت اولین بدهی / طلب
              </button>
            </div>
          ) : filteredDebts.length === 0 ? (
            <p className="sheet-sub">موردی در این دسته یافت نشد.</p>
          ) : (
            <div className="plan-list">
              {filteredDebts.map((d) => {
                const isOverdue = d.status === 'active' && d.dueDate && d.dueDate < today
                return (
                  /* Request 5: Swipe Row for Debts and Loans */
                  <SwipeRow
                    key={d.id}
                    onEdit={() => {
                      setEditingDebt(d)
                      setDebtSheetOpen(true)
                    }}
                    onDelete={() => void handleDeleteDebt(d.id)}
                  >
                    <div
                      className="plan-card lg-row"
                      style={{ textAlign: 'right', cursor: 'pointer', width: '100%' }}
                      onClick={() => {
                        setEditingDebt(d)
                        setDebtSheetOpen(true)
                      }}
                    >
                      <div className="plan-top">
                        <div>
                          <div className="plan-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{d.direction === 'borrowed' ? '🔴' : '🟢'}</span>
                            <span>{d.party}</span>
                            <span style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', fontWeight: 'normal' }}>
                              ({d.direction === 'borrowed' ? 'بدهی من' : 'طلب من'})
                            </span>
                          </div>
                          <div className="plan-meta">
                            {d.status === 'settled'
                              ? `تسویه شده در تاریخ ${d.settledAt ? formatPersianDateFull(d.settledAt) : 'نامشخص'}`
                              : d.dueDate
                                ? `موعد سررسید بازپرداخت: ${formatPersianDateFull(d.dueDate)}`
                                : 'بدون موعد بازپرداخت مشخص'}
                          </div>
                        </div>
                        <div className="plan-right">
                          <span className={`badge ${d.status === 'settled' ? 'ok' : isOverdue ? 'overdue' : 'pending'}`}>
                            {d.status === 'settled' ? 'تسویه شده' : isOverdue ? 'سررسید گذشته' : 'جاری'}
                          </span>
                          <div className={`plan-amount ${d.direction === 'borrowed' ? 'down' : 'up'}`}>
                            {formatMoney(d.amount)}
                          </div>
                        </div>
                      </div>
                      {d.note ? (
                        <div style={{ fontSize: 12, color: 'var(--hy-text-secondary)', marginTop: 6 }}>
                          شرح: {d.note}
                        </div>
                      ) : null}

                      {/* Request 6: Quick Revert to Active for Settled Debts */}
                      {d.status === 'settled' ? (
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cat-mini"
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', fontSize: 11, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleUnsettleDebtQuick(d.id)
                            }}
                          >
                            ↩️ بازگردانی به وضعیت پرداخت‌نشده (جاری)
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </SwipeRow>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 3: CHEQUES VIEW */
        <div>
          {/* Cheque Totals KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>چک‌های پرداختی معلق</span>
              <strong className="down" style={{ fontSize: 18 }}>{formatMoney(totalPayablePending)}</strong>
              <small>{toFaDigits(activeCheques.filter((c) => c.direction === 'payable' && c.status === 'pending').length)} فقره</small>
            </div>
            <div className="home-kpi lg" style={{ padding: '12px 14px' }}>
              <span style={{ fontSize: 12 }}>چک‌های دریافتی معلق</span>
              <strong className="up" style={{ fontSize: 18 }}>{formatMoney(totalReceivablePending)}</strong>
              <small>{toFaDigits(activeCheques.filter((c) => c.direction === 'receivable' && c.status === 'pending').length)} فقره</small>
            </div>
          </div>

          {/* Request 7: Cheque Filter Pills with Cleared Archive */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                className={`cat-mini${chequeFilter === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setChequeFilter('all')}
              >
                جاری ({toFaDigits(activeCheques.length)})
              </button>
              <button
                className={`cat-mini${chequeFilter === 'payable' ? ' active' : ''}`}
                type="button"
                onClick={() => setChequeFilter('payable')}
              >
                پرداختی ({toFaDigits(activeCheques.filter((c) => c.direction === 'payable').length)})
              </button>
              <button
                className={`cat-mini${chequeFilter === 'receivable' ? ' active' : ''}`}
                type="button"
                onClick={() => setChequeFilter('receivable')}
              >
                دریافتی ({toFaDigits(activeCheques.filter((c) => c.direction === 'receivable').length)})
              </button>
              <button
                className={`cat-mini${chequeFilter === 'cleared' ? ' active' : ''}`}
                type="button"
                onClick={() => setChequeFilter('cleared')}
                style={{
                  background: chequeFilter === 'cleared' ? 'rgba(16, 185, 129, 0.25)' : undefined,
                  borderColor: chequeFilter === 'cleared' ? '#10b981' : undefined,
                }}
              >
                🗄️ بایگانی چک‌های پاس‌شده ({toFaDigits(clearedCheques.length)})
              </button>
            </div>

            <button
              type="button"
              className="cat-mini"
              onClick={() => {
                setEditingCheque(undefined)
                setChequeSheetOpen(true)
              }}
              style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(15, 118, 110, 0.2)', color: 'var(--hy-teal)' }}
            >
              ＋ ثبت چک صیادی
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
            <div className="empty-state" style={{ padding: '24px 16px', margin: '10px 0' }}>
              <p className="sheet-sub">
                {chequeFilter === 'cleared'
                  ? 'هنوز چکی به عنوان پاس‌شده در بایگانی چک‌ها ثبت نشده است.'
                  : 'چک فعالی در این دسته یافت نشد.'}
              </p>
            </div>
          ) : (
            <div className="plan-list">
              {filteredCheques.map((c) => {
                const statusMeta = CHEQUE_STATUS_LABEL[c.status]
                const isOverdue = c.status === 'pending' && c.dueDate < today
                const isCleared = c.status === 'cleared'

                return (
                  /* Request 8: Swipe Row for Cheques */
                  <SwipeRow
                    key={c.id}
                    onEdit={() => {
                      setEditingCheque(c)
                      setChequeSheetOpen(true)
                    }}
                    onDelete={() => void handleDeleteCheque(c.id)}
                  >
                    <div
                      className="plan-card lg-row"
                      style={{ textAlign: 'right', cursor: 'pointer', width: '100%' }}
                      onClick={() => {
                        setEditingCheque(c)
                        setChequeSheetOpen(true)
                      }}
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
                            {isCleared
                              ? `وصول شده در تاریخ: ${c.clearedAt ? formatPersianDateFull(c.clearedAt) : 'نامشخص'}`
                              : `سررسید: ${formatPersianDateFull(c.dueDate)}`}
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

                      {/* Restore Cleared Cheque to Active */}
                      {isCleared ? (
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cat-mini"
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', fontSize: 11, padding: '4px 10px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRestoreChequeToPending(c)
                            }}
                          >
                            ↩️ بازگردانی به چک‌های جاری (معلق)
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </SwipeRow>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sheets */}
      {chequeSheetOpen ? (
        <ChequeSheet
          cheque={editingCheque}
          onClose={() => {
            setChequeSheetOpen(false)
            setEditingCheque(undefined)
          }}
        />
      ) : null}

      {debtSheetOpen ? (
        <DebtSheet
          debt={editingDebt}
          onClose={() => {
            setDebtSheetOpen(false)
            setEditingDebt(undefined)
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
                    ? `سررسید بعدی: ${formatPersianDateFull(next.dueDate)}`
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
