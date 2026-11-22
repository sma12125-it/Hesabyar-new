import { memo } from 'react'
import type { Account, Transaction } from '../types'
import { getCategory } from '../lib/categories'
import { useExtras } from '../store/Extras'
import { useUiActions } from './UiActions'
import { formatPersianDate } from '../lib/dates'
import { txTitle } from './TxRow'

interface TransactionsTableProps {
  transactions: Transaction[]
  accounts: Account[]
  customCategories: Parameters<typeof getCategory>[1]
}

export const TransactionsTable = memo(function TransactionsTable({
  transactions,
  accounts,
  customCategories,
}: TransactionsTableProps) {
  const actions = useUiActions()
  const { formatMoney, unitLabel } = useExtras()

  if (transactions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--hy-muted)' }}>
        <span style={{ fontSize: '32px' }}>📊</span>
        <p style={{ marginTop: 8, fontSize: '13px' }}>تراکنشی برای نمایش در جدول وجود ندارد</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'right',
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}
      >
        <thead>
          <tr
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--hy-text-secondary)',
              fontWeight: 700,
            }}
          >
            <th style={{ padding: '10px 12px' }}>نوع</th>
            <th style={{ padding: '10px 12px' }}>شرح و عنوان</th>
            <th style={{ padding: '10px 12px' }}>دسته‌بندی</th>
            <th style={{ padding: '10px 12px' }}>حساب</th>
            <th style={{ padding: '10px 12px' }}>تاریخ</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>مبلغ ({unitLabel})</th>
            <th style={{ padding: '10px 12px', textAlign: 'center' }}>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const account = accounts.find((a) => a.id === tx.accountId)
            const cat = getCategory(tx.categoryId, customCategories)
            const positive = tx.kind === 'income' || tx.kind === 'transferIn'
            const isTransfer = tx.kind === 'transferOut' || tx.kind === 'transferIn'

            return (
              <tr
                key={tx.id}
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  transition: 'background 0.15s ease',
                }}
                className="table-row-hover"
              >
                {/* Kind Badge */}
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: isTransfer
                        ? 'rgba(124, 58, 237, 0.18)'
                        : positive
                          ? 'rgba(16, 185, 129, 0.18)'
                          : 'rgba(239, 68, 68, 0.18)',
                      color: isTransfer
                        ? 'var(--hy-accent)'
                        : positive
                          ? 'var(--hy-income)'
                          : 'var(--hy-expense)',
                    }}
                  >
                    {tx.kind === 'income'
                      ? 'درآمد'
                      : tx.kind === 'expense'
                        ? 'هزینه'
                        : tx.kind === 'transferOut'
                          ? 'انتقال به'
                          : 'واریز از'}
                  </span>
                </td>

                {/* Description */}
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--hy-text)', whiteSpace: 'normal', minWidth: 160 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{txTitle(tx, accounts, customCategories)}</span>
                    {tx.receiptPhoto ? <span title="دارای رسید">🧾</span> : null}
                  </div>
                  {tx.tags && tx.tags.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {tx.tags.map((t) => (
                        <span key={t} style={{ fontSize: '10px', color: 'var(--hy-accent)' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>

                {/* Category */}
                <td style={{ padding: '10px 12px', color: 'var(--hy-subtext)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>{cat?.icon || '💳'}</span>
                    <span>{cat?.name || 'عمومی'}</span>
                  </span>
                </td>

                {/* Account */}
                <td style={{ padding: '10px 12px', color: 'var(--hy-text)' }}>
                  {account?.name || tx.accountId}
                </td>

                {/* Date */}
                <td style={{ padding: '10px 12px', color: 'var(--hy-subtext)', fontSize: '11px' }}>
                  {formatPersianDate(tx.date)}
                </td>

                {/* Amount */}
                <td
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: isTransfer
                      ? 'var(--hy-text)'
                      : positive
                        ? 'var(--hy-income)'
                        : 'var(--hy-expense)',
                  }}
                >
                  <span dir="ltr">
                    {positive ? '+' : isTransfer ? '' : '−'}
                    {formatMoney(tx.amount, false)}
                  </span>
                </td>

                {/* Actions */}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => actions?.editTransaction(tx.id)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        color: 'var(--hy-text)',
                      }}
                      title="ویرایش"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => actions?.deleteTransaction(tx.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        color: '#ef4444',
                      }}
                      title="حذف"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
