import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { BalanceHero } from '../components/BalanceHero'
import { TxRow } from '../components/TxRow'
import { PocketFormSheet } from '../components/PocketFormSheet'
import { PocketTransferSheet } from '../components/PocketTransferSheet'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { computePocketBalances } from '../lib/balance'
import { pocketHasOpenLoan } from '../lib/cascade'
import { toFaDigits } from '../lib/money'
import { formatRelativeFromIso } from '../lib/dates'
import { notifyUser } from '../lib/sync'

export function PocketDetailPage({
  onScroll,
}: {
  onScroll?: (compact: boolean) => void
}) {
  const { accountId, pocketId } = useParams()
  const navigate = useNavigate()
  const { accounts, transactions, pockets, pocketTransfers, deletePocket, deletePocketTransfer } = useStore()
  const { debts, formatMoney, unitLabel } = useExtras()

  const [formOpen, setFormOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const account = accounts.find((a) => a.id === accountId)
  const pocket = pockets.find((p) => p.id === pocketId && p.accountId === accountId && !p.archived)

  const balances = useMemo(() => {
    if (!account) return {}
    return computePocketBalances(account, transactions, pockets, pocketTransfers)
  }, [account, transactions, pockets, pocketTransfers])

  const pocketBalance = pocket ? (balances[pocket.id] ?? 0) : 0

  // Filter transactions belonging to this pocket
  const pocketTxs = useMemo(() => {
    if (!account || !pocket) return []
    return transactions.filter(
      (tx) =>
        tx.accountId === account.id &&
        (pocket.isMain ? !tx.pocketId || tx.pocketId === pocket.id : tx.pocketId === pocket.id),
    )
  }, [account, pocket, transactions])

  // Filter transfers involving this pocket
  const relatedTransfers = useMemo(() => {
    if (!pocket) return []
    return (pocketTransfers ?? []).filter(
      (tr) => tr.accountId === accountId && (tr.fromPocketId === pocket.id || tr.toPocketId === pocket.id),
    )
  }, [pocketTransfers, accountId, pocket])

  // Check open loans associated with this pocket
  const activeLoans = useMemo(() => {
    if (!pocket) return []
    return (debts ?? []).filter(
      (d) => d.pocketId === pocket.id && d.status === 'active' && d.direction === 'borrowed',
    )
  }, [debts, pocket])

  const totalOpenLoan = useMemo(() => {
    return activeLoans.reduce((sum, d) => sum + Math.max(0, d.amount - (d.repaidAmount || 0)), 0)
  }, [activeLoans])

  if (!account || !pocket) {
    return (
      <div className="app-scroll">
        <div className="empty-state lg">
          <h2>جیب پیدا نشد</h2>
          <button
            className="cta-confirm"
            type="button"
            onClick={() => navigate(accountId ? `/accounts/${accountId}` : '/accounts')}
          >
            بازگشت به حساب
          </button>
        </div>
      </div>
    )
  }

  const hasOpenLoan = pocketHasOpenLoan(pocket.id, debts)

  return (
    <div className="app-scroll" onScroll={(e) => onScroll?.(e.currentTarget.scrollTop > 28)}>
      {/* Top Bar */}
      <div className="detail-top">
        <button
          className="back-btn"
          type="button"
          onClick={() => navigate(`/accounts/${account.id}`)}
          aria-label="بازگشت"
        >
          ›
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pocket.name}
          </h1>
          <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>حساب: {account.name}</span>
        </div>
        <button
          className="action-chip lg-light"
          type="button"
          onClick={() => setFormOpen(true)}
          style={{ height: 34, padding: '0 10px', fontSize: 12 }}
        >
          ✎ ویرایش
        </button>
      </div>

      {/* Negative Balance Warning */}
      {pocketBalance < 0 ? (
        <div className="banner error" style={{ margin: '8px 2px 12px' }}>
          <span className="bico">⚠️</span>
          <span>
            هشدار: موجودی این جیب <strong>{formatMoney(pocketBalance, true)}</strong> منفی است!
          </span>
        </div>
      ) : null}

      {/* Open Loan Card / Banner */}
      {totalOpenLoan > 0 ? (
        <div
          className="home-card lg"
          style={{
            margin: '8px 0 14px',
            background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15), rgba(249, 115, 22, 0.05))',
            border: '1px solid rgba(234, 88, 12, 0.4)',
            padding: '12px 16px',
            borderRadius: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ea580c', display: 'flex', alignItems: 'center', gap: 6 }}>
              🤝 قرض باز از این جیب
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ea580c' }}>
              {formatMoney(totalOpenLoan, true)}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--hy-text-secondary)', lineHeight: 1.5 }}>
            از پول این جیب هزینه شخصی پرداخت شده و به عنوان قرض ثبت گردیده است. با ثبت درآمد و انتخاب گزینه بازپرداخت بدهی تسویه خواهد شد.
          </p>
        </div>
      ) : null}

      {/* Hero Balance */}
      <BalanceHero
        label={`موجودی ${pocket.name}`}
        amount={pocketBalance}
        sub={
          <>
            <span className={`badge ${pocket.isMain ? 'bank' : 'cash'}`}>
              {pocket.isMain ? 'جیب اصلی حساب' : 'جیب فرعی'}
            </span>
            {' · '}
            <span
              className="badge"
              style={{
                background: pocket.isOwn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 88, 12, 0.2)',
                color: pocket.isOwn ? '#10b981' : '#ea580c',
              }}
            >
              {pocket.isOwn ? 'شخصی' : 'امانی / دیگران'}
            </span>
            {!pocket.isMain && pocket.openingBalance > 0 ? (
              <span style={{ fontSize: 11, opacity: 0.85, marginRight: 6 }}>
                (مبلغ شروع: {formatMoney(pocket.openingBalance, true)})
              </span>
            ) : null}
          </>
        }
      />

      {/* Action Row */}
      <div className="action-row" style={{ marginTop: 12 }}>
        <button
          className="action-chip lg-light"
          type="button"
          onClick={() => setTransferOpen(true)}
        >
          <span className="aico">⇄</span>انتقال بین جیب‌ها
        </button>
        <button
          className="action-chip lg-light"
          type="button"
          onClick={() => setFormOpen(true)}
        >
          <span className="aico">✎</span>ویرایش جیب
        </button>
        {!pocket.isMain ? (
          <button
            className="action-chip lg-light"
            type="button"
            style={{ color: '#ef4444' }}
            onClick={() => setConfirmDelete(true)}
          >
            <span className="aico">🗑</span>حذف جیب
          </button>
        ) : null}
      </div>

      {/* Internal Transfers section */}
      {relatedTransfers.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <div className="section-head">
            <h2>انتقال‌های این جیب</h2>
            <span className="link">{toFaDigits(relatedTransfers.length)} مورد</span>
          </div>
          <div className="tx-list">
            {relatedTransfers.map((tr) => {
              const isOut = tr.fromPocketId === pocket.id
              const otherId = isOut ? tr.toPocketId : tr.fromPocketId
              const otherPocket = pockets.find((p) => p.id === otherId)
              const otherName = otherPocket ? otherPocket.name : 'جیب دیگر'

              return (
                <div
                  key={tr.id}
                  className="tx-row lg-row"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="tx-ico">{isOut ? '📤' : '📥'}</div>
                    <div>
                      <div className="tx-title" style={{ fontSize: 13, fontWeight: 600 }}>
                        {isOut ? `انتقال به ${otherName}` : `دریافت از ${otherName}`}
                      </div>
                      <div className="tx-sub" style={{ fontSize: 11 }}>
                        {formatRelativeFromIso(tr.date)}
                        {tr.note ? ` · ${tr.note}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={`tx-amt ${isOut ? 'expense' : 'income'}`}>
                      {formatMoney(tr.amount, false)}
                      <span className="unit">{unitLabel}</span>
                    </div>
                    <button
                      type="button"
                      className="cat-mini danger"
                      onClick={() => {
                        void deletePocketTransfer(tr.id).then(() => {
                          notifyUser('انتقال حذف شد')
                        })
                      }}
                      title="حذف انتقال"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Transactions list */}
      <div style={{ marginTop: 20 }}>
        <div className="section-head">
          <h2>تراکنش‌های این جیب</h2>
          {pocketTxs.length > 0 ? (
            <span className="link">{toFaDigits(pocketTxs.length)} مورد</span>
          ) : null}
        </div>

        <div className="tx-list">
          {pocketTxs.length === 0 ? (
            <div className="empty-state lg" style={{ marginTop: 8 }}>
              <div className="empty-ico">🧾</div>
              <h2>تراکنشی روی این جیب ثبت نشده است</h2>
              <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                هنگام ثبت سریع درآمد یا هزینه، این جیب را انتخاب کنید.
              </p>
            </div>
          ) : (
            pocketTxs.map((tx) => (
              <TxRow key={tx.id} tx={tx} accounts={accounts} forAccountId={account.id} />
            ))
          )}
        </div>
      </div>

      {/* Modals & Sheets */}
      {formOpen ? (
        <PocketFormSheet
          accountId={account.id}
          pocket={pocket}
          onClose={() => setFormOpen(false)}
        />
      ) : null}

      {transferOpen ? (
        <PocketTransferSheet
          accountId={account.id}
          presetFromPocketId={pocket.id}
          onClose={() => setTransferOpen(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmSheet
          title="حذف جیب؟"
          message={
            hasOpenLoan
              ? 'هشدار: این جیب دارای قرض یا بدهی باز است! با حذف این جیب، آن به عنوان بایگانی ثبت شده و تمام تراکنش‌ها و مانده موجودی به جیب اصلی حساب منتقل می‌گردند.'
              : 'این جیب بایگانی شده و تمام تراکنش‌ها و مانده موجودی آن به جیب اصلی حساب منتقل می‌گردند. آیا مطمئن هستید؟'
          }
          confirmLabel="حذف و انتقال به جیب اصلی"
          onConfirm={async () => {
            await deletePocket(pocket.id)
            notifyUser('جیب حذف شد و تراکنش‌ها به جیب اصلی منتقل شدند')
            navigate(`/accounts/${account.id}`)
          }}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  )
}
