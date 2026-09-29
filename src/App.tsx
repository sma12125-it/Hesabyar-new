import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { PhoneShell } from './components/PhoneShell'
import { TabBar } from './components/TabBar'
import { Toast } from './components/Toast'
import { QuickEntrySheet } from './components/QuickEntrySheet'
import { AccountFormSheet } from './components/AccountFormSheet'
import { TransferSheet } from './components/TransferSheet'
import { InstallmentPlanSheet } from './components/InstallmentPlanSheet'
import { InstallmentPaySheet } from './components/InstallmentPaySheet'
import { InstallmentItemSheet } from './components/InstallmentItemSheet'
import { ConfirmSheet } from './components/ConfirmSheet'
import { UiActionsContext, type UiActions } from './components/UiActions'
import { HomePage } from './pages/HomePage'
import { AccountsPage } from './pages/AccountsPage'
import { AccountDetailPage } from './pages/AccountDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuthGate } from './components/AuthGate'
import { VoiceSheet } from './components/VoiceSheet'
import { SyncSheet } from './components/SyncSheet'
import { AllTransactionsPage } from './pages/AllTransactionsPage'
import { InstallmentsPage } from './pages/InstallmentsPage'
import { InstallmentsArchivePage } from './pages/InstallmentsArchivePage'
import { InstallmentDetailPage } from './pages/InstallmentDetailPage'
import { remainingAmount } from './lib/installments'
import { todayIso } from './lib/iso'
import { LiveSync } from './components/LiveSync'
import { SharedSync } from './components/SharedSync'
import { ShareSheet } from './components/ShareSheet'
import { SmsBridge } from './components/SmsBridge'
import { PendingTransactionsPage } from './pages/PendingTransactionsPage'
import { ExtrasProvider, useExtras } from './store/Extras'
import { StoreProvider, useStore } from './store/Store'

export type Sheet =
  | { type: 'quick'; kind: 'expense' | 'income'; accountId?: string }
  | { type: 'account'; accountId?: string }
  | { type: 'transfer'; fromId?: string; transferId?: string }
  | { type: 'installment-plan'; planId?: string }
  | { type: 'installment-pay'; itemId: string }
  | { type: 'installment-item'; itemId: string }
  | { type: 'tx-edit'; txId: string }
  | { type: 'all-tx' }
  | { type: 'settings' }
  | { type: 'voice' }
  | { type: 'sync' }
  | { type: 'share'; accountId: string }
  | { type: 'confirm'; title: string; message: string; confirmLabel?: string; run: () => Promise<void> }

function Shell() {
  const location = useLocation()
  const { ready, error, totalBalance, accounts, transactions, plans, items, resetDemo, wipeAll, deleteTransaction, deleteAccount, deleteInstallmentPlan, deleteInstallmentItem, unpayInstallment } = useStore()
  const { unlocked: vaultOpen, vaultConfigured } = useExtras()
  const [compact, setCompact] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const onScroll = useCallback((next: boolean) => setCompact(next), [])

  useEffect(() => {
    const onShare = (event: Event) => {
      const accountId = (event as CustomEvent<string>).detail
      if (accountId) setSheet({ type: 'share', accountId })
    }
    window.addEventListener('hy-share-account', onShare)
    return () => window.removeEventListener('hy-share-account', onShare)
  }, [])

  useEffect(() => {
    const onNotice = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message
      if (message) setToast(message)
    }
    window.addEventListener('hy-notice', onNotice)
    return () => window.removeEventListener('hy-notice', onNotice)
  }, [])

  useEffect(() => {
    setAddOpen(false)
  }, [location.pathname, sheet])

  const isHome = location.pathname === '/'
  const isAccountsList = location.pathname === '/accounts'
  const isInstallmentsList = location.pathname === '/installments'
  const sheetOpen = sheet !== null
  const hasPlans = plans.length > 0
  const editingAccount =
    sheet?.type === 'account' && sheet.accountId
      ? accounts.find((a) => a.id === sheet.accountId)
      : undefined
  const editingPlan =
    sheet?.type === 'installment-plan' && sheet.planId
      ? plans.find((p) => p.id === sheet.planId)
      : undefined
  const payingItem =
    sheet?.type === 'installment-pay' ? items.find((i) => i.id === sheet.itemId) : undefined
  const payingPlan = payingItem ? plans.find((p) => p.id === payingItem.planId) : undefined
  const editingItem =
    sheet?.type === 'installment-item' ? items.find((i) => i.id === sheet.itemId) : undefined
  const editingTx = sheet?.type === 'tx-edit' ? transactions.find((t) => t.id === sheet.txId) : undefined

  const uiActions = useMemo<UiActions>(
    () => ({
      editTransaction: (id) => {
        const tx = transactions.find((row) => row.id === id)
        if (!tx) return
        if (tx.kind === 'transferOut' || tx.kind === 'transferIn') {
          setSheet({ type: 'transfer', transferId: tx.transferId })
        } else {
          setSheet({ type: 'tx-edit', txId: id })
        }
      },
      deleteTransaction: (id) => {
        const tx = transactions.find((row) => row.id === id)
        if (!tx) return
        const transfer = tx.kind === 'transferOut' || tx.kind === 'transferIn'
        const linked = Boolean(tx.installmentItemId)
        setSheet({
          type: 'confirm',
          title: 'حذف تراکنش؟',
          message: transfer
            ? 'هر دو پایهٔ انتقال حذف می‌شود و موجودی مبدأ و مقصد اصلاح می‌گردد.'
            : linked
              ? 'پرداخت قسط لغو می‌شود؛ خود قسط در برنامه می‌ماند و موجودی برمی‌گردد.'
              : 'این تراکنش حذف می‌شود و موجودی حساب به‌روز می‌گردد.',
          run: () => deleteTransaction(id),
        })
      },
      editAccount: (id) => setSheet({ type: 'account', accountId: id }),
      deleteAccount: (id) =>
        setSheet({
          type: 'confirm',
          title: 'حذف حساب؟',
          message:
            'حساب و تراکنش‌هایش حذف می‌شوند. پایه‌های انتقال در حساب‌های دیگر هم پاک می‌شوند. پرداخت اقساط این حساب لغو می‌شود ولی خود اقساط می‌مانند.',
          run: () => deleteAccount(id),
        }),
      editPlan: (id) => setSheet({ type: 'installment-plan', planId: id }),
      deletePlan: (id) =>
        setSheet({
          type: 'confirm',
          title: 'حذف برنامه اقساط؟',
          message: 'برنامه، همه اقساط و هزینه‌های پرداخت‌شده حذف می‌شوند و موجودی حساب‌ها برمی‌گردد.',
          run: () => deleteInstallmentPlan(id),
        }),
      editItem: (id) => setSheet({ type: 'installment-item', itemId: id }),
      deleteItem: (id) => {
        const item = items.find((row) => row.id === id)
        const paid = Boolean(item?.transactionId || item?.status === 'paid')
        setSheet({
          type: 'confirm',
          title: 'حذف قسط؟',
          message: paid
            ? 'این قسط و هزینهٔ پرداخت‌شده حذف می‌شوند؛ موجودی حساب برمی‌گردد و قسط از جدول خارج می‌شود.'
            : 'این قسط از برنامه حذف می‌شود و شماره‌گذاری بقیه به‌روز می‌گردد.',
          run: () => deleteInstallmentItem(id),
        })
      },
      unpayItem: (id) =>
        setSheet({
          type: 'confirm',
          title: 'برگشت به پرداخت‌نشده؟',
          confirmLabel: 'برگشت',
          message: 'هزینهٔ این قسط حذف می‌شود، موجودی حساب برمی‌گردد و قسط دوباره مانده می‌شود. اگر برنامه تمام شده باشد به لیست فعال برمی‌گردد.',
          run: () => unpayInstallment(id),
        }),
    }),
    [transactions, items, deleteTransaction, deleteAccount, deleteInstallmentPlan, deleteInstallmentItem, unpayInstallment],
  )

  if (error) {
    return (
      <PhoneShell>
        <div className="loading-center">{error}</div>
      </PhoneShell>
    )
  }

  if (!ready) {
    return (
      <PhoneShell>
        <div className="loading-center">در حال بارگذاری…</div>
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <LiveSync />
      <SharedSync />
      <SmsBridge />
      <UiActionsContext.Provider value={uiActions}>
      <div className="app">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onScroll={onScroll}
                setToast={setToast}
                onQuickEntry={(kind) => setSheet({ type: 'quick', kind })}
                onTransfer={() => setSheet({ type: 'transfer' })}
                onAll={() => setSheet({ type: 'all-tx' })}
                onSettings={() => setSheet({ type: 'settings' })}
              />
            }
          />
          <Route
            path="/accounts"
            element={<AccountsPage onScroll={onScroll} />}
          />
          <Route path="/accounts/:id" element={<AccountDetailRoute onScroll={onScroll} setSheet={setSheet} />} />
          <Route
            path="/installments/archive"
            element={<InstallmentsArchivePage onScroll={onScroll} />}
          />
          <Route
            path="/installments"
            element={
              <InstallmentsPage onScroll={onScroll} onCreate={() => setSheet({ type: 'installment-plan' })} />
            }
          />
          <Route
            path="/installments/:id"
            element={
              <InstallmentDetailRoute
                onScroll={onScroll}
                onEdit={(planId) => setSheet({ type: 'installment-plan', planId })}
                onPay={(itemId) => setSheet({ type: 'installment-pay', itemId })}
              />
            }
          />
          <Route
            path="/reports"
            element={<ReportsPage onScroll={onScroll} />}
          />
          <Route path="/settings" element={<SettingsPage onScroll={onScroll} />} />
          <Route path="/transactions/pending" element={<PendingTransactionsPage onScroll={onScroll} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {!sheetOpen && isHome ? (
          <button
            className="mic-fab"
            type="button"
            title="ورودی صوتی"
            onClick={() => setSheet({ type: 'voice' })}
          >
            🎤
          </button>
        ) : null}

        {!sheetOpen && isAccountsList ? (
          <div className={`corner-add${addOpen ? ' is-open' : ''}`}>
            <button
              className="corner-scrim"
              type="button"
              aria-label="بستن منو"
              inert={!addOpen}
              onClick={() => setAddOpen(false)}
            />
            <div className="corner-menu" role="menu" aria-hidden={!addOpen} inert={!addOpen}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAddOpen(false)
                  if (vaultOpen) {
                    window.dispatchEvent(new Event('hy-new-card'))
                    return
                  }
                  setToast(vaultConfigured ? 'اول گاوصندوق را باز کنید' : 'اول رمز گاوصندوق را در تنظیمات مشخص کنید')
                }}
              >
                <span className="corner-item-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="M3 10h18" />
                  </svg>
                </span>
                <span>ساخت کارت</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAddOpen(false)
                  setSheet({ type: 'account' })
                }}
              >
                <span className="corner-item-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 10.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6.5" />
                    <path d="M4 10.5 12 5l8 5.5" />
                    <path d="M10 19v-4h4v4" />
                  </svg>
                </span>
                <span>حساب جدید</span>
              </button>
            </div>
            <button
              className="corner-add-btn"
              type="button"
              aria-expanded={addOpen}
              aria-label={addOpen ? 'بستن' : 'افزودن'}
              onClick={() => setAddOpen((open) => !open)}
            >
              <span className="corner-plus" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {!sheetOpen && isInstallmentsList && hasPlans ? (
          <button className="fab-pill" type="button" onClick={() => setSheet({ type: 'installment-plan' })}>
            <span>＋</span> برنامه جدید
          </button>
        ) : null}

        {!sheetOpen ? (
          <TabBar compact={compact} onQuickEntry={() => setSheet({ type: 'quick', kind: 'expense' })} />
        ) : null}
      </div>

      {sheet?.type === 'quick' ? (
        <QuickEntrySheet
          initialKind={sheet.kind}
          presetAccountId={sheet.accountId}
          totalBalance={totalBalance}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'tx-edit' && editingTx && (editingTx.kind === 'expense' || editingTx.kind === 'income') ? (
        <QuickEntrySheet
          initialKind={editingTx.kind}
          transaction={editingTx}
          totalBalance={totalBalance}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'account' ? (
        <AccountFormSheet account={editingAccount} totalBalance={totalBalance} onClose={() => setSheet(null)} />
      ) : null}

      {sheet?.type === 'transfer' ? (
        <TransferSheet
          presetFromId={sheet.fromId}
          transferId={sheet.transferId}
          totalBalance={totalBalance}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'installment-plan' ? (
        <InstallmentPlanSheet plan={editingPlan} onClose={() => setSheet(null)} />
      ) : null}

      {sheet?.type === 'installment-item' && editingItem ? (
        <InstallmentItemSheet item={editingItem} onClose={() => setSheet(null)} />
      ) : null}

      {sheet?.type === 'installment-pay' && payingItem && payingPlan ? (
        <InstallmentPaySheet
          plan={payingPlan}
          item={payingItem}
          remaining={remainingAmount(
            items.filter((i) => i.planId === payingPlan.id),
            todayIso(),
          )}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'all-tx' ? <AllTransactionsPage onBack={() => setSheet(null)} /> : null}

      {sheet?.type === 'confirm' ? (
        <ConfirmSheet
          title={sheet.title}
          message={sheet.message}
          confirmLabel={sheet.confirmLabel}
          onConfirm={sheet.run}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.type === 'voice' ? <VoiceSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.type === 'share' && accounts.some((account) => account.id === sheet.accountId) ? (
        <ShareSheet
          account={accounts.find((account) => account.id === sheet.accountId)!}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.type === 'sync' ? <SyncSheet onClose={() => setSheet(null)} /> : null}

      {sheet?.type === 'settings' ? (
        <>
          <div className="sheet-scrim" onClick={() => setSheet(null)} />
          <div className="glass-sheet" role="dialog" aria-label="داده محلی">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h1>داده محلی</h1>
              <button className="sheet-close" type="button" onClick={() => setSheet(null)} aria-label="بستن">
                ✕
              </button>
            </div>
            <p className="sheet-sub">همه چیز روی همین مرورگر در IndexedDB ذخیره می‌شود. واحد پول فقط ریال است.</p>
            <div className="confirm-actions">
              <button
                className="cta-confirm"
                type="button"
                onClick={() => {
                  void resetDemo()
                  setSheet(null)
                  setToast('داده نمونه بارگذاری شد')
                }}
              >
                بازنشانی داده نمونه
              </button>
              <button
                className="btn-ghost-danger"
                type="button"
                onClick={() => {
                  void wipeAll()
                  setSheet(null)
                  setToast('همه داده‌ها پاک شد')
                }}
              >
                شروع از صفر
              </button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
      </UiActionsContext.Provider>
    </PhoneShell>
  )
}

function AccountDetailRoute({
  onScroll,
  setSheet,
}: {
  onScroll: (compact: boolean) => void
  setSheet: (sheet: Sheet) => void
}) {
  const { id } = useParams()
  return (
    <AccountDetailPage
      onScroll={onScroll}
      onQuickEntry={() => setSheet({ type: 'quick', kind: 'expense', accountId: id })}
      onTransfer={() => setSheet({ type: 'transfer', fromId: id })}
      onEdit={() => setSheet({ type: 'account', accountId: id })}
      onShare={() => id && setSheet({ type: 'share', accountId: id })}
    />
  )
}

function InstallmentDetailRoute({
  onScroll,
  onEdit,
  onPay,
}: {
  onScroll: (compact: boolean) => void
  onEdit: (planId: string) => void
  onPay: (itemId: string) => void
}) {
  const { id } = useParams()
  return (
    <InstallmentDetailPage
      onScroll={onScroll}
      onEdit={() => id && onEdit(id)}
      onPay={onPay}
    />
  )
}

export default function App() {
  const [open, setOpen] = useState(false)
  if (typeof document !== 'undefined') {
    const theme = localStorage.getItem('hy-theme')
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme
  }
  return (
    <StoreProvider>
      <ExtrasProvider>
        {open ? <Shell /> : <AuthGate onUnlock={() => setOpen(true)} />}
      </ExtrasProvider>
    </StoreProvider>
  )
}
