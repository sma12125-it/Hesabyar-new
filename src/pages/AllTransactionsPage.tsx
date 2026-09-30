import { useMemo, useState } from 'react'
import { useStore } from '../store/Store'
import { TxRow, visibleLedger } from '../components/TxRow'
import { toFaDigits, toWesternDigits } from '../lib/money'
import { getCategory } from '../lib/categories'

export function AllTransactionsPage({ onBack }: { onBack: () => void }) {
  const { transactions, accounts, customCategories } = useStore()
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')

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

      // Search query: description (note), category name, account name, amount
      if (q) {
        const noteMatch = (tx.note || '').toLowerCase().includes(q)
        const amountMatch = String(tx.amount).includes(q)
        const account = accounts.find((a) => a.id === tx.accountId)
        const accountMatch = account?.name.toLowerCase().includes(q) ?? false
        const counterparty = tx.counterpartyAccountId ? accounts.find((a) => a.id === tx.counterpartyAccountId) : undefined
        const counterpartyMatch = counterparty?.name.toLowerCase().includes(q) ?? false
        const cat = getCategory(tx.categoryId, customCategories)
        const categoryMatch = cat ? cat.name.toLowerCase().includes(q) : false
        const categoryIdMatch = tx.categoryId.toLowerCase().includes(q)
        if (!noteMatch && !amountMatch && !accountMatch && !counterpartyMatch && !categoryMatch && !categoryIdMatch) return false
      }

      return true
    })
  }, [baseRows, search, kindFilter, accountFilter, accounts, customCategories])

  return (
    <>
      <div className="sheet-scrim" onClick={onBack} />
      <div className="glass-sheet" role="dialog" aria-label="همه تراکنش‌ها">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>همه تراکنش‌ها</h1>
          <button className="sheet-close" type="button" onClick={onBack} aria-label="بستن">
            ✕
          </button>
        </div>

        {/* Search input with clear button and icon */}
        <div style={{ position: 'relative', margin: '8px 0 10px' }}>
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 15,
              opacity: 0.6,
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            className="field-input"
            style={{ paddingRight: 36, paddingLeft: search ? 36 : 14, width: '100%' }}
            placeholder="جستجو در شرح تراکنش، دسته‌بندی، حساب، مبلغ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 23, 42, 0.12)',
                border: 'none',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                color: 'var(--hy-text-secondary)',
                cursor: 'pointer',
              }}
              aria-label="پاک کردن جستجو"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
          <button
            className={`cat-mini${kindFilter === 'all' ? ' active' : ''}`}
            type="button"
            onClick={() => setKindFilter('all')}
          >
            همه
          </button>
          <button
            className={`cat-mini${kindFilter === 'expense' ? ' active' : ''}`}
            type="button"
            onClick={() => setKindFilter('expense')}
          >
            هزینه‌ها
          </button>
          <button
            className={`cat-mini${kindFilter === 'income' ? ' active' : ''}`}
            type="button"
            onClick={() => setKindFilter('income')}
          >
            درآمدها
          </button>
          <button
            className={`cat-mini${kindFilter === 'transfer' ? ' active' : ''}`}
            type="button"
            onClick={() => setKindFilter('transfer')}
          >
            انتقال‌ها
          </button>

          {accounts.length > 1 ? (
            <select
              className="cat-mini"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent' }}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--hy-text-tertiary)', marginBottom: 6 }}>
          <span>تعداد نتایج: {toFaDigits(filteredRows.length)} تراکنش</span>
          {search || kindFilter !== 'all' || accountFilter !== 'all' ? (
            <button
              className="link"
              type="button"
              onClick={() => {
                setSearch('')
                setKindFilter('all')
                setAccountFilter('all')
              }}
            >
              پاک کردن فیلترها
            </button>
          ) : null}
        </div>

        <div className="tx-list" style={{ overflowY: 'auto', flex: 1 }}>
          {filteredRows.length === 0 ? (
            <p className="sheet-sub">تراکنشی مطابق با فیلتر یافت نشد</p>
          ) : (
            filteredRows.map((tx) => <TxRow key={tx.id} tx={tx} accounts={accounts} />)
          )}
        </div>
      </div>
    </>
  )
}
