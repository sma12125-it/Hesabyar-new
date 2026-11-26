import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { dueReminderLines, notifyReminders } from '../lib/reminders'
import { useExtras } from '../store/Extras'
import { formatPersianDateFull } from '../lib/dates'
import { nextPayableItem, overdueCount, paidCount, planBadge } from '../lib/installments'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import {
  fetchIncomingShares,
  getStableUserId,
  isIncomingSharedAsset,
  respondIncomingShare,
  serializeChequeShareDetails,
  serializeDebtShareDetails,
  serializeInstallmentShareDetails,
  type IncomingSharedAsset,
} from '../lib/userShare'
import { useStore } from '../store/Store'
import { SharedAssetDetailSheet } from '../components/SharedAssetDetailSheet'
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
  const { plans, items, upsertSharedInstallmentPlan } = useStore()
  const {
    reminders,
    setReminders,
    cheques,
    debts,
    formatMoney,
    deleteCheque,
    saveCheque,
    deleteDebt,
    unsettleDebt,
    upsertSharedCheque,
    upsertSharedDebt,
  } = useExtras()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayIso()
  const myUserId = getStableUserId()
  const [incomingShares, setIncomingShares] = useState<IncomingSharedAsset[]>([])
  const [selectedSharedAsset, setSelectedSharedAsset] = useState<{
    kind: 'installment' | 'debt' | 'cheque'
    plan?: InstallmentPlan
    planItems?: InstallmentItem[]
    debt?: DebtLoan
    cheque?: Cheque
  } | null>(null)

  const loadIncomingShares = async () => {
    try {
      const list = await fetchIncomingShares()
      setIncomingShares(list)
    } catch {}
  }

  useEffect(() => {
    void loadIncomingShares()
    window.addEventListener('hy-share-assets-updated', loadIncomingShares)
    return () => window.removeEventListener('hy-share-assets-updated', loadIncomingShares)
  }, [])

  const pendingCommitmentShares = useMemo(() => {
    const myIdLower = myUserId.trim().toLowerCase()
    return incomingShares.filter((s) => {
      if (s.assetKind !== 'installment' && s.assetKind !== 'debt' && s.assetKind !== 'cheque') return false
      if (s.status === 'rejected') return false
      const ownerIdLower = (s.ownerUserId || '').trim().toLowerCase()
      if (ownerIdLower && ownerIdLower === myIdLower) return false
      if (s.assetKind === 'installment') {
        return !plans.some((p) => p.shareId === s.id || p.sourceAssetId === s.assetId || p.id === s.assetId)
      }
      if (s.assetKind === 'debt') {
        return !debts.some((d) => d.shareId === s.id || d.sourceAssetId === s.assetId || d.id === s.assetId)
      }
      return !cheques.some((c) => c.shareId === s.id || c.sourceAssetId === s.assetId || c.id === s.assetId)
    })
  }, [incomingShares, plans, debts, cheques, myUserId])

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

  // Sorting for Debts (بدهی‌ها)
  const [debtSort, setDebtSort] = useState<'due-date' | 'overdue' | 'amount' | 'manual'>('due-date')
  const [debtManualOrder, setDebtManualOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hy_debts_manual_order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sorting for Cheques (چک‌ها)
  const [chequeSort, setChequeSort] = useState<'due-date' | 'overdue' | 'amount' | 'manual'>('due-date')
  const [chequeManualOrder, setChequeManualOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hy_cheques_manual_order')
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

  // Cheque sorting (سورت چک‌ها بر اساس سررسید، معوق، مبلغ و جابجایی دستی)
  const sortedCheques = useMemo(() => {
    const list = filteredCheques.slice()
    if (chequeSort === 'due-date') {
      return list.sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))
    }
    if (chequeSort === 'overdue') {
      return list.sort((a, b) => {
        const isOverA = a.status === 'pending' && a.dueDate < today
        const isOverB = b.status === 'pending' && b.dueDate < today
        if (isOverA && !isOverB) return -1
        if (!isOverA && isOverB) return 1
        return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99')
      })
    }
    if (chequeSort === 'amount') {
      return list.sort((a, b) => b.amount - a.amount)
    }
    if (chequeSort === 'manual') {
      return list.sort((a, b) => {
        const idxA = chequeManualOrder.indexOf(a.id)
        const idxB = chequeManualOrder.indexOf(b.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    }
    return list
  }, [filteredCheques, chequeSort, chequeManualOrder, today])

  function moveChequeUp(id: string) {
    const currentList = sortedCheques.map((c) => c.id)
    const index = currentList.indexOf(id)
    if (index <= 0) return
    const next = [...currentList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setChequeManualOrder(next)
    try {
      localStorage.setItem('hy_cheques_manual_order', JSON.stringify(next))
    } catch {}
  }

  function moveChequeDown(id: string) {
    const currentList = sortedCheques.map((c) => c.id)
    const index = currentList.indexOf(id)
    if (index === -1 || index >= currentList.length - 1) return
    const next = [...currentList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setChequeManualOrder(next)
    try {
      localStorage.setItem('hy_cheques_manual_order', JSON.stringify(next))
    } catch {}
  }

  // Debt sorting (سورت بدهی‌ها بر اساس سررسید، معوق، مبلغ و جابجایی دستی)
  const sortedDebts = useMemo(() => {
    const list = filteredDebts.slice()
    if (debtSort === 'due-date') {
      return list.sort((a, b) => {
        const dueA = a.dueDate || '9999-99-99'
        const dueB = b.dueDate || '9999-99-99'
        return dueA.localeCompare(dueB)
      })
    }
    if (debtSort === 'overdue') {
      return list.sort((a, b) => {
        const isOverA = a.status === 'active' && a.dueDate && a.dueDate < today
        const isOverB = b.status === 'active' && b.dueDate && b.dueDate < today
        if (isOverA && !isOverB) return -1
        if (!isOverA && isOverB) return 1
        const dueA = a.dueDate || '9999-99-99'
        const dueB = b.dueDate || '9999-99-99'
        return dueA.localeCompare(dueB)
      })
    }
    if (debtSort === 'amount') {
      return list.sort((a, b) => b.amount - a.amount)
    }
    if (debtSort === 'manual') {
      return list.sort((a, b) => {
        const idxA = debtManualOrder.indexOf(a.id)
        const idxB = debtManualOrder.indexOf(b.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    }
    return list
  }, [filteredDebts, debtSort, debtManualOrder, today])

  function moveDebtUp(id: string) {
    const currentList = sortedDebts.map((d) => d.id)
    const index = currentList.indexOf(id)
    if (index <= 0) return
    const next = [...currentList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setDebtManualOrder(next)
    try {
      localStorage.setItem('hy_debts_manual_order', JSON.stringify(next))
    } catch {}
  }

  function moveDebtDown(id: string) {
    const currentList = sortedDebts.map((d) => d.id)
    const index = currentList.indexOf(id)
    if (index === -1 || index >= currentList.length - 1) return
    const next = [...currentList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setDebtManualOrder(next)
    try {
      localStorage.setItem('hy_debts_manual_order', JSON.stringify(next))
    } catch {}
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="icon-btn mobile-only-icon"
            onClick={() => window.dispatchEvent(new CustomEvent('hy:open-drawer'))}
            title="منوی ناوبری سایدبار"
            aria-label="منوی ناوبری سایدبار"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--hy-input-bg, rgba(255, 255, 255, 0.08))',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            ☰
          </button>
          <div>
            <h1>اقساط، وام‌ها و تعهدات</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
              مدیریت برنامه‌های اقساط، چک‌های صیادی، قرض‌الحسنه و بدهی‌ها
            </p>
          </div>
        </div>
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

      {/* Pending incoming commitment shares (installments / debts / cheques) */}
      {pendingCommitmentShares.length > 0 ? (
        <div
          style={{
            margin: '0 0 16px',
            padding: '12px 14px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.16) 0%, rgba(30, 27, 75, 0.25) 100%)',
            border: '1.5px solid var(--hy-teal)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: 'var(--hy-teal)' }}>
              <span>🔔</span>
              <span>دعوتنامه اشتراک قسط، بدهی یا چک جدید</span>
            </div>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--hy-income, #10b981)',
                fontWeight: 800,
              }}
            >
              {toFaDigits(pendingCommitmentShares.length)} مورد
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingCommitmentShares.map((share) => {
              const kindBadge =
                share.assetKind === 'installment'
                  ? '📅 قسط مشترک: '
                  : share.assetKind === 'debt'
                    ? '🤝 بدهی/طلب مشترک: '
                    : '🧾 چک مشترک: '
              return (
                <div
                  key={share.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {kindBadge}
                      {share.assetName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                      از طرف: <strong>{share.ownerDisplayName || `کاربر ${share.ownerUserId}`}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="cat-mini"
                      style={{
                        background: 'var(--hy-teal, #0ea5e9)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 800,
                        padding: '6px 12px',
                      }}
                      onClick={async () => {
                        await respondIncomingShare(share.id, 'accept')
                        const resolvedOwner = share.ownerDisplayName || `کاربر ${share.ownerUserId}`
                        const details = share.assetDetails ?? {}
                        if (share.assetKind === 'installment') {
                          const targetPlanId = `shared_plan_${share.id}`
                          const rawItems = Array.isArray(details.items) ? details.items : []
                          const mappedItems: InstallmentItem[] = rawItems.map((it, idx) => ({
                            id: `${targetPlanId}_i_${it.index ?? idx + 1}`,
                            planId: targetPlanId,
                            index: Number(it.index ?? idx + 1),
                            dueDate: String(it.dueDate ?? ''),
                            amount: Number(it.amount ?? details.installmentAmount ?? 0),
                            status: it.status === 'paid' || it.status === 'overdue' ? it.status : 'pending',
                            paidAt: typeof it.paidAt === 'string' ? it.paidAt : undefined,
                          }))
                          const statusRaw = details.status
                          const planStatus: InstallmentPlan['status'] =
                            statusRaw === 'completed' || statusRaw === 'archived' ? statusRaw : 'active'
                          await upsertSharedInstallmentPlan({
                            plan: {
                              id: targetPlanId,
                              name: String(details.name || share.assetName || 'برنامه اقساط مشترک'),
                              installmentAmount: Number(details.installmentAmount ?? mappedItems[0]?.amount ?? 0),
                              totalCount: Number(details.totalCount ?? mappedItems.length),
                              startDate: String(details.startDate ?? mappedItems[0]?.dueDate ?? today),
                              categoryId: 'installments',
                              status: planStatus,
                              kind: details.kind === 'loan' ? 'loan' : 'fixed',
                              principal: typeof details.principal === 'number' ? details.principal : undefined,
                              annualRatePercent: typeof details.annualRatePercent === 'number' ? details.annualRatePercent : undefined,
                              createdAt: Date.parse(share.sharedAt) || Date.now(),
                              updatedAt: Date.now(),
                              shareId: share.id,
                              sourceAssetId: share.assetId,
                              isShared: true,
                              ownerDisplayName: resolvedOwner,
                              ownerUserId: share.ownerUserId,
                              recipientUserId: myUserId,
                            },
                            items: mappedItems,
                          })
                          setActiveTab('plans')
                        } else if (share.assetKind === 'debt') {
                          await upsertSharedDebt({
                            id: `shared_debt_${share.id}`,
                            direction: details.direction === 'lent' ? 'lent' : 'borrowed',
                            party: String(details.party || share.assetName || 'طرف حساب'),
                            amount: Number(details.amount ?? 0),
                            dueDate: typeof details.dueDate === 'string' && details.dueDate ? details.dueDate : undefined,
                            note: typeof details.note === 'string' ? details.note : '',
                            status: details.status === 'settled' ? 'settled' : 'active',
                            settledAt: typeof details.settledAt === 'string' ? details.settledAt : undefined,
                            repaidAmount: typeof details.repaidAmount === 'number' ? details.repaidAmount : undefined,
                            createdAt: Date.parse(share.sharedAt) || Date.now(),
                            updatedAt: Date.now(),
                            shareId: share.id,
                            sourceAssetId: share.assetId,
                            isShared: true,
                            ownerDisplayName: resolvedOwner,
                            ownerUserId: share.ownerUserId,
                            recipientUserId: myUserId,
                          })
                          setActiveTab('debts')
                        } else {
                          const statusRaw = details.status
                          const chequeStatus: Cheque['status'] =
                            statusRaw === 'cleared' || statusRaw === 'bounced' ? statusRaw : 'pending'
                          await upsertSharedCheque({
                            id: `shared_cheque_${share.id}`,
                            direction: details.direction === 'receivable' ? 'receivable' : 'payable',
                            sayadId: String(details.sayadId ?? ''),
                            bankName: String(details.bankName || 'بانک'),
                            amount: Number(details.amount ?? 0),
                            dueDate: String(details.dueDate ?? today),
                            party: String(details.party || share.assetName || 'طرف حساب'),
                            status: chequeStatus,
                            note: typeof details.note === 'string' ? details.note : '',
                            clearedAt: typeof details.clearedAt === 'string' ? details.clearedAt : undefined,
                            createdAt: Date.parse(share.sharedAt) || Date.now(),
                            updatedAt: Date.now(),
                            shareId: share.id,
                            sourceAssetId: share.assetId,
                            isShared: true,
                            ownerDisplayName: resolvedOwner,
                            ownerUserId: share.ownerUserId,
                            recipientUserId: myUserId,
                          })
                          setActiveTab('cheques')
                        }
                        notifyUser(`«${share.assetName}» به لیست شما افزوده شد ✨`)
                        void loadIncomingShares()
                      }}
                    >
                      ✅ تأیید و افزودن
                    </button>

                    <button
                      type="button"
                      className="cat-mini danger"
                      style={{ padding: '6px 10px' }}
                      onClick={async () => {
                        await respondIncomingShare(share.id, 'reject')
                        notifyUser('دعوتنامه رد شد')
                        void loadIncomingShares()
                      }}
                    >
                      ✕ رد
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

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
                        {(() => {
                          const planItems = items.filter((i) => i.planId === plan.id)
                          return (
                            <PlanCard
                              plan={plan}
                              items={planItems}
                              today={today}
                              onClick={() => navigate(`/installments/${plan.id}`)}
                              onInspectShare={(p, pItems) =>
                                setSelectedSharedAsset({ kind: 'installment', plan: p, planItems: pItems })
                              }
                            />
                          )
                        })()}
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

          {/* Request 14: Debts Sorting Bar */}
          {debts.length > 0 && (
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
                🔄 سورت بدهی و طلب:
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`cat-mini${debtSort === 'due-date' ? ' active' : ''}`}
                  onClick={() => setDebtSort('due-date')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  نزدیک‌ترین سررسید
                </button>
                <button
                  type="button"
                  className={`cat-mini${debtSort === 'overdue' ? ' active' : ''}`}
                  onClick={() => setDebtSort('overdue')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  بیشترین اقساط معوق
                </button>
                <button
                  type="button"
                  className={`cat-mini${debtSort === 'amount' ? ' active' : ''}`}
                  onClick={() => setDebtSort('amount')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  مبلغ قسط
                </button>
                <button
                  type="button"
                  className={`cat-mini${debtSort === 'manual' ? ' active' : ''}`}
                  onClick={() => setDebtSort('manual')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  جابجایی دستی
                </button>
              </div>
            </div>
          )}

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
          ) : sortedDebts.length === 0 ? (
            <p className="sheet-sub">موردی در این دسته یافت نشد.</p>
          ) : (
            <div className="plan-list">
              {sortedDebts.map((d, idx, arr) => {
                const isOverdue = d.status === 'active' && d.dueDate && d.dueDate < today
                const isShared = isIncomingSharedAsset(d, myUserId)
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    {/* Manual Reordering Buttons for Debts */}
                    {debtSort === 'manual' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveDebtUp(d.id)
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
                          title="انتقال بدهی / طلب به بالا"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveDebtDown(d.id)
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
                          title="انتقال بدهی / طلب به پایین"
                        >
                          ▼
                        </button>
                      </div>
                    ) : null}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Swipe Row for Debts and Loans */}
                      <SwipeRow
                        onEdit={
                          isShared
                            ? undefined
                            : () => {
                                setEditingDebt(d)
                                setDebtSheetOpen(true)
                              }
                        }
                        onDelete={isShared ? undefined : () => void handleDeleteDebt(d.id)}
                      >
                        <div
                          className="plan-card lg-row"
                          style={{ textAlign: 'right', cursor: 'pointer', width: '100%' }}
                          onClick={() => {
                            if (isShared) {
                              setSelectedSharedAsset({ kind: 'debt', debt: d })
                            } else {
                              setEditingDebt(d)
                              setDebtSheetOpen(true)
                            }
                          }}
                        >
                          <div className="plan-top">
                            <div>
                              <div className="plan-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span>{d.direction === 'borrowed' ? '🔴' : '🟢'}</span>
                                <span>{d.party}</span>
                                <span style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', fontWeight: 'normal' }}>
                                  ({d.direction === 'borrowed' ? 'بدهی من' : 'طلب من'})
                                </span>
                                {isShared ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      background: 'rgba(16, 185, 129, 0.16)',
                                      color: 'var(--hy-income, #10b981)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    🤝 مشترک ({d.ownerDisplayName || 'کاربر'})
                                  </span>
                                ) : null}
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

                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {isShared ? (
                              <button
                                type="button"
                                className="cat-mini"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSharedAsset({ kind: 'debt', debt: d })
                                }}
                              >
                                ℹ️ جزئیات اشتراک
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="cat-mini"
                                style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--hy-teal)', fontSize: 11, padding: '4px 10px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.dispatchEvent(
                                    new CustomEvent('hy-open-share', {
                                      detail: {
                                        kind: 'debt',
                                        item: {
                                          id: d.id,
                                          name: `${d.direction === 'borrowed' ? 'بدهی به' : 'طلب از'} ${d.party}`,
                                          party: d.party,
                                          direction: d.direction,
                                          amount: d.amount,
                                          dueDate: d.dueDate,
                                          status: d.status,
                                          note: d.note,
                                          settledAt: d.settledAt,
                                          repaidAmount: d.repaidAmount,
                                          details: serializeDebtShareDetails(d),
                                        },
                                      },
                                    }),
                                  )
                                }}
                              >
                                🤝 اشتراک
                              </button>
                            )}

                            {/* Quick Revert to Active for Settled Debts */}
                            {d.status === 'settled' && !isShared ? (
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
                            ) : null}
                          </div>
                        </div>
                      </SwipeRow>
                    </div>
                  </div>
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

          {/* Request 14: Cheques Sorting Bar */}
          {cheques.length > 0 && (
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
                🔄 سورت چک‌ها:
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`cat-mini${chequeSort === 'due-date' ? ' active' : ''}`}
                  onClick={() => setChequeSort('due-date')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  نزدیک‌ترین سررسید
                </button>
                <button
                  type="button"
                  className={`cat-mini${chequeSort === 'overdue' ? ' active' : ''}`}
                  onClick={() => setChequeSort('overdue')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  بیشترین اقساط معوق
                </button>
                <button
                  type="button"
                  className={`cat-mini${chequeSort === 'amount' ? ' active' : ''}`}
                  onClick={() => setChequeSort('amount')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  مبلغ قسط
                </button>
                <button
                  type="button"
                  className={`cat-mini${chequeSort === 'manual' ? ' active' : ''}`}
                  onClick={() => setChequeSort('manual')}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  جابجایی دستی
                </button>
              </div>
            </div>
          )}

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
          ) : sortedCheques.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px', margin: '10px 0' }}>
              <p className="sheet-sub">
                {chequeFilter === 'cleared'
                  ? 'هنوز چکی به عنوان پاس‌شده در بایگانی چک‌ها ثبت نشده است.'
                  : 'چک فعالی در این دسته یافت نشد.'}
              </p>
            </div>
          ) : (
            <div className="plan-list">
              {sortedCheques.map((c, idx, arr) => {
                const statusMeta = CHEQUE_STATUS_LABEL[c.status]
                const isOverdue = c.status === 'pending' && c.dueDate < today
                const isCleared = c.status === 'cleared'
                const isShared = isIncomingSharedAsset(c, myUserId)

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    {/* Manual Reordering Buttons for Cheques */}
                    {chequeSort === 'manual' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveChequeUp(c.id)
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
                          title="انتقال چک به بالا"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveChequeDown(c.id)
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
                          title="انتقال چک به پایین"
                        >
                          ▼
                        </button>
                      </div>
                    ) : null}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Swipe Row for Cheques */}
                      <SwipeRow
                        onEdit={
                          isShared
                            ? undefined
                            : () => {
                                setEditingCheque(c)
                                setChequeSheetOpen(true)
                              }
                        }
                        onDelete={isShared ? undefined : () => void handleDeleteCheque(c.id)}
                      >
                        <div
                          className="plan-card lg-row"
                          style={{ textAlign: 'right', cursor: 'pointer', width: '100%' }}
                          onClick={() => {
                            if (isShared) {
                              setSelectedSharedAsset({ kind: 'cheque', cheque: c })
                            } else {
                              setEditingCheque(c)
                              setChequeSheetOpen(true)
                            }
                          }}
                        >
                          <div className="plan-top">
                            <div>
                              <div className="plan-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span>{c.direction === 'payable' ? '📤' : '📥'}</span>
                                <span>{c.party}</span>
                                <span style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', fontWeight: 'normal' }}>
                                  ({c.bankName})
                                </span>
                                {isShared ? (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      background: 'rgba(16, 185, 129, 0.16)',
                                      color: 'var(--hy-income, #10b981)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    🤝 مشترک ({c.ownerDisplayName || 'کاربر'})
                                  </span>
                                ) : null}
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

                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {isShared ? (
                              <button
                                type="button"
                                className="cat-mini"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSharedAsset({ kind: 'cheque', cheque: c })
                                }}
                              >
                                ℹ️ جزئیات اشتراک
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="cat-mini"
                                style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--hy-teal)', fontSize: 11, padding: '4px 10px' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.dispatchEvent(
                                    new CustomEvent('hy-open-share', {
                                      detail: {
                                        kind: 'cheque',
                                        item: {
                                          id: c.id,
                                          name: `چک ${c.party}`,
                                          party: c.party,
                                          bankName: c.bankName,
                                          direction: c.direction,
                                          amount: c.amount,
                                          dueDate: c.dueDate,
                                          status: c.status,
                                          sayadId: c.sayadId,
                                          note: c.note,
                                          clearedAt: c.clearedAt,
                                          details: serializeChequeShareDetails(c),
                                        },
                                      },
                                    }),
                                  )
                                }}
                              >
                                🤝 اشتراک
                              </button>
                            )}

                            {/* Restore Cleared Cheque to Active */}
                            {isCleared && !isShared ? (
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
                            ) : null}
                          </div>
                        </div>
                      </SwipeRow>
                    </div>
                  </div>
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

      {selectedSharedAsset ? (
        <SharedAssetDetailSheet
          kind={selectedSharedAsset.kind}
          plan={selectedSharedAsset.plan}
          planItems={selectedSharedAsset.planItems}
          debt={selectedSharedAsset.debt}
          cheque={selectedSharedAsset.cheque}
          onClose={() => setSelectedSharedAsset(null)}
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
  onInspectShare,
}: {
  plan: InstallmentPlan
  items: InstallmentItem[]
  today: string
  onClick: () => void
  onInspectShare?: (plan: InstallmentPlan, items: InstallmentItem[]) => void
}) {
  const actions = useUiActions()
  const { formatMoney } = useExtras()
  const isShared = isIncomingSharedAsset(plan, getStableUserId())
  const paid = paidCount(items, today)
  const overdue = overdueCount(items, today)
  const badge = plan.status === 'completed' ? 'ok' : planBadge(items, today)
  const next = items
    .filter((i) => i.status !== 'paid' && !i.transactionId)
    .sort((a, b) => a.index - b.index)[0]
  const percent = plan.totalCount > 0 ? Math.round((paid / plan.totalCount) * 100) : 0

  return (
    <SwipeRow
      onEdit={!isShared && actions ? () => actions.editPlan(plan.id) : undefined}
      onDelete={!isShared && actions ? () => actions.deletePlan(plan.id) : undefined}
    >
      <div
        className="plan-card lg-row"
        role="button"
        tabIndex={0}
        style={{ width: '100%', textAlign: 'right', cursor: 'pointer' }}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        <div className="plan-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="plan-name">{plan.name}</span>
              {isShared ? (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: 'var(--hy-income, #10b981)',
                    fontWeight: 700,
                  }}
                >
                  🤝 مشترک ({plan.ownerDisplayName || 'کاربر'})
                </span>
              ) : null}
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {overdue > 0 && plan.status === 'active' ? (
              <span style={{ color: 'var(--hy-expense)', fontWeight: 700 }}>
                {toFaDigits(overdue)} قسط معوق
              </span>
            ) : null}
            <span>مانده: {toFaDigits(Math.max(plan.totalCount - paid, 0))}</span>
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start' }}>
          {isShared ? (
            <button
              type="button"
              className="cat-mini"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={(e) => {
                e.stopPropagation()
                onInspectShare?.(plan, items)
              }}
            >
              ℹ️ جزئیات اشتراک
            </button>
          ) : (
            <button
              type="button"
              className="cat-mini"
              style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--hy-teal)', fontSize: 11, padding: '4px 10px' }}
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(
                  new CustomEvent('hy-open-share', {
                    detail: {
                      kind: 'installment',
                      item: {
                        id: plan.id,
                        name: plan.name,
                        installmentAmount: plan.installmentAmount,
                        totalCount: plan.totalCount,
                        startDate: plan.startDate,
                        status: plan.status,
                        planKind: plan.kind,
                        principal: plan.principal,
                        annualRatePercent: plan.annualRatePercent,
                        items,
                        details: serializeInstallmentShareDetails(plan, items),
                      },
                    },
                  }),
                )
              }}
            >
              🤝 اشتراک
            </button>
          )}
        </div>
      </div>
    </SwipeRow>
  )
}
