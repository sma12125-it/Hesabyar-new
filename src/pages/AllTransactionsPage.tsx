import { useMemo, useState } from 'react'
import { useStore } from '../store/Store'
import { TxRow, visibleLedger } from '../components/TxRow'
import { TransactionsTable } from '../components/TransactionsTable'
import { WindowPopup } from '../components/WindowPopup'
import { toFaDigits, toWesternDigits } from '../lib/money'
import { getCategory } from '../lib/categories'
import { formatPersianDateFull } from '../lib/dates'
import { useExtras } from '../store/Extras'
import { useUiActions } from '../components/UiActions'

export function AllTransactionsPage({
  onBack,
  initialSearch = '',
  onMinimize,
}: {
  onBack: () => void
  initialSearch?: string
  onMinimize?: () => void
}) {
  const { transactions, accounts, customCategories } = useStore()
  const actions = useUiActions()
  const { formatMoney, unitLabel } = useExtras()
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const [search, setSearch] = useState(initialSearch)
  const [kindFilter, setKindFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [isTableView, setIsTableView] = useState<boolean>(() => window.innerWidth >= 900)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)

  const baseRows = useMemo(() => visibleLedger(transactions), [transactions])

  const filteredRows = useMemo(() => {
    const q = toWesternDigits(search.trim().toLowerCase())
    return baseRows.filter((tx) => {
      // Kind filter
      if (kindFilter === 'expense' && tx.kind !== 'expense') return false
      if (kindFilter === 'income' && tx.kind !== 'income') return false
      if (kindFilter === 'transfer' && tx.kind !== 'transferOut' && tx.kind !== 'transferIn') return false

      // Account filter
      if (accountFilter !== 'all') {
        if (tx.accountId !== accountFilter && tx.counterpartyAccountId !== accountFilter) return false
      }

      // Search query: description (note), category name, account name, amount (Rial/Toman), tags
      if (q) {
        const cleanQ = q.replace(/[,،\s]/g, '')
        const noteMatch = (tx.note || '').toLowerCase().includes(q)
        const amountRialStr = String(tx.amount)
        const amountTomanStr = String(Math.floor(tx.amount / 10))
        const amountMatch =
          cleanQ.length > 0 &&
          !isNaN(Number(cleanQ)) &&
          (amountRialStr.includes(cleanQ) || amountTomanStr.includes(cleanQ))
        const account = accounts.find((a) => a.id === tx.accountId)
        const accountMatch = account?.name.toLowerCase().includes(q) ?? false
        const counterparty = tx.counterpartyAccountId ? accounts.find((a) => a.id === tx.counterpartyAccountId) : undefined
        const counterpartyMatch = counterparty?.name.toLowerCase().includes(q) ?? false
        const cat = getCategory(tx.categoryId, customCategories)
        const categoryMatch = cat ? cat.name.toLowerCase().includes(q) : false
        const categoryIdMatch = tx.categoryId.toLowerCase().includes(q)
        const tagsMatch = tx.tags ? tx.tags.some((t) => t.toLowerCase().includes(q)) : false

        if (
          !noteMatch &&
          !amountMatch &&
          !accountMatch &&
          !counterpartyMatch &&
          !categoryMatch &&
          !categoryIdMatch &&
          !tagsMatch
        )
          return false
      }

      return true
    })
  }, [baseRows, search, kindFilter, accountFilter, accounts, customCategories])

  // Total pages calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  // Paginated subset of rows
  const paginatedRows = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize
    return filteredRows.slice(startIndex, startIndex + pageSize)
  }, [filteredRows, safePage, pageSize])

  const startRecordNum = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endRecordNum = Math.min(safePage * pageSize, filteredRows.length)

  function handleFilterChange(updater: () => void) {
    updater()
    setCurrentPage(1)
  }

  const paginationFooter =
    totalPages > 1 ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Previous page arrow */}
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: safePage <= 1 ? 'transparent' : 'rgba(255, 255, 255, 0.12)',
            color: safePage <= 1 ? 'var(--hy-muted)' : 'var(--hy-text)',
            cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span>←</span>
          <span>صفحه قبل</span>
        </button>

        {/* Page indicator & quick jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
          <span>
            صفحه <strong>{toFaDigits(safePage)}</strong> از <strong>{toFaDigits(totalPages)}</strong>
          </span>
        </div>

        {/* Next page arrow */}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: safePage >= totalPages ? 'transparent' : 'rgba(255, 255, 255, 0.12)',
            color: safePage >= totalPages ? 'var(--hy-muted)' : 'var(--hy-text)',
            cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span>صفحه بعد</span>
          <span>→</span>
        </button>
      </div>
    ) : null

  const innerContent = (
    <>
      {/* Search input with clear button and icon */}
      <div style={{ position: 'relative', margin: '6px 0 8px', flexShrink: 0 }}>
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          className="field-input"
          autoFocus={isDesktop}
          style={{
            paddingRight: 38,
            paddingLeft: search ? 36 : 14,
            width: '100%',
            fontSize: '13px',
            height: '42px',
            borderRadius: '14px',
          }}
          placeholder="جستجو در شرح، مبلغ (ریال یا تومان)، حساب، تگ یا دسته‌بندی…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setCurrentPage(1)
            }}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              color: 'var(--hy-text-secondary)',
              cursor: 'pointer',
            }}
            aria-label="پاک کردن جستجو"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Filter Chips + Account Select */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          className={`cat-mini${kindFilter === 'all' ? ' active' : ''}`}
          type="button"
          onClick={() => handleFilterChange(() => setKindFilter('all'))}
        >
          همه
        </button>
        <button
          className={`cat-mini${kindFilter === 'expense' ? ' active' : ''}`}
          type="button"
          onClick={() => handleFilterChange(() => setKindFilter('expense'))}
        >
          هزینه‌ها
        </button>
        <button
          className={`cat-mini${kindFilter === 'income' ? ' active' : ''}`}
          type="button"
          onClick={() => handleFilterChange(() => setKindFilter('income'))}
        >
          درآمدها
        </button>
        <button
          className={`cat-mini${kindFilter === 'transfer' ? ' active' : ''}`}
          type="button"
          onClick={() => handleFilterChange(() => setKindFilter('transfer'))}
        >
          انتقال‌ها
        </button>

        {accounts.length > 1 ? (
          <select
            className="cat-mini"
            value={accountFilter}
            onChange={(e) => handleFilterChange(() => setAccountFilter(e.target.value))}
            style={{
              padding: '4px 8px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'transparent',
              fontSize: '11px',
            }}
          >
            <option value="all">تمام حساب‌ها</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Results summary & Items per page bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--hy-subtext)',
          padding: '4px 2px 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>
            نمایش {toFaDigits(startRecordNum)} تا {toFaDigits(endRecordNum)} از{' '}
            <strong style={{ color: 'var(--hy-text)' }}>{toFaDigits(filteredRows.length)}</strong> تراکنش
          </span>
          {search || kindFilter !== 'all' || accountFilter !== 'all' ? (
            <button
              className="link"
              type="button"
              style={{ fontSize: '11px' }}
              onClick={() => {
                setSearch('')
                setKindFilter('all')
                setAccountFilter('all')
                setCurrentPage(1)
              }}
            >
              (حذف فیلترها)
            </button>
          ) : null}
        </div>

        {/* Page size selector: 10, 20, 30, 40, 50 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>تعداد در صفحه:</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {[10, 20, 30, 40, 50].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  setPageSize(sz)
                  setCurrentPage(1)
                }}
                style={{
                  border: 'none',
                  borderRadius: 6,
                  padding: '2px 5px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  background: pageSize === sz ? 'var(--hy-teal)' : 'rgba(255, 255, 255, 0.1)',
                  color: pageSize === sz ? '#fff' : 'var(--hy-subtext)',
                  fontWeight: pageSize === sz ? 700 : 400,
                }}
              >
                {toFaDigits(sz)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Card List or Table View */}
      <div
        className="tx-list tx-list-scroll"
        style={{
          overflowY: 'auto',
          flex: '1 1 auto',
          minHeight: 0,
          padding: '8px 2px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isTableView ? (
          <TransactionsTable
            transactions={paginatedRows}
            accounts={accounts}
            customCategories={customCategories}
          />
        ) : paginatedRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--hy-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: 8 }}>🔍</div>
            <p style={{ margin: 0, fontSize: '13px' }}>تراکنشی مطابق با جستجو یا فیلتر یافت نشد</p>
          </div>
        ) : (
          paginatedRows.map((tx) => {
            const isSelected = selectedTxId === tx.id
            const account = accounts.find((a) => a.id === tx.accountId)
            const counterparty = tx.counterpartyAccountId ? accounts.find((a) => a.id === tx.counterpartyAccountId) : undefined
            const cat = getCategory(tx.categoryId, customCategories)

            return (
              <div key={tx.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <TxRow
                  tx={tx}
                  accounts={accounts}
                  onSelect={() => setSelectedTxId((prev) => (prev === tx.id ? null : tx.id))}
                />
                {isSelected && (
                  <div
                    style={{
                      margin: '2px 4px 6px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      animation: 'popIn 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ color: 'var(--hy-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📅</span>
                        <span>{formatPersianDateFull(tx.date)}</span>
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: tx.kind === 'income' ? 'var(--hy-income)' : tx.kind === 'expense' ? 'var(--hy-expense)' : 'var(--hy-text)' }}>
                        {formatMoney(tx.amount)} {unitLabel}
                      </span>
                    </div>

                    {tx.note ? (
                      <div style={{ fontSize: '12px', color: 'var(--hy-text)', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: 8 }}>
                        {tx.note}
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '11px', color: 'var(--hy-subtext)' }}>
                      <span>حساب: <strong style={{ color: 'var(--hy-text)' }}>{account?.name || tx.accountId}</strong></span>
                      {counterparty ? <span>مقصد: <strong style={{ color: 'var(--hy-text)' }}>{counterparty.name}</strong></span> : null}
                      <span>دسته: <strong style={{ color: 'var(--hy-text)' }}>{cat?.name || 'عمومی'}</strong></span>
                    </div>

                    {tx.receiptPhoto ? (
                      <div style={{ marginTop: 2 }}>
                        <img
                          src={tx.receiptPhoto}
                          alt="تصویر رسید"
                          style={{ maxHeight: 120, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                        />
                      </div>
                    ) : null}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => actions?.editTransaction(tx.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(56, 189, 248, 0.16)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38bdf8',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <span>✏️</span>
                        <span>ویرایش تراکنش</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => actions?.deleteTransaction(tx.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.16)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <span>🗑️</span>
                        <span>حذف</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTxId(null)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: 'var(--hy-subtext)',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        بستن
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )

  // Mobile layout: Full-page view with top navigation, returns to home, NO close 'X' button
  if (!isDesktop) {
    return (
      <div className="app-scroll page-all-tx-mobile" style={{ minHeight: '100%', padding: '0 0 84px' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--hy-text)',
                padding: '6px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>←</span>
              <span>بازگشت به خانه</span>
            </button>
            <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>دفتر کل تراکنش‌ها</h1>
          </div>
          <span style={{ fontSize: 12, color: 'var(--hy-subtext)' }}>
            {toFaDigits(filteredRows.length)} تراکنش
          </span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {innerContent}
          {paginationFooter ? <div style={{ marginTop: 14 }}>{paginationFooter}</div> : null}
        </div>
      </div>
    )
  }

  // Desktop layout: WindowPopup with full window controls (max/min/move/resize/table view)
  return (
    <WindowPopup
      title="دفتر کل تمام تراکنش‌ها"
      subtitle="امکان فیلتر، صفحه‌بندی، جابجایی پنجره، تمام صفحه و نمای جدولی"
      icon="📒"
      isOpen={true}
      onClose={onBack}
      onMinimize={onMinimize}
      defaultWidth={850}
      defaultHeight={680}
      allowTableViewToggle={true}
      isTableView={isTableView}
      onToggleTableView={() => setIsTableView((prev) => !prev)}
      footer={paginationFooter}
    >
      {innerContent}
    </WindowPopup>
  )
}
