import { useState } from 'react'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import { WindowPopup } from './WindowPopup'
import { formatPersianDateFull } from '../lib/dates'
import { formatRial, toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import type { InstallmentItem } from '../types'

export function InstallmentItemSheet({
  item,
  onClose,
}: {
  item: InstallmentItem
  onClose: () => void
}) {
  const { plans, accounts, transactions, updateInstallmentItem } = useStore()
  const plan = plans.find((p) => p.id === item.planId)
  const tx = transactions.find((t) => t.id === item.transactionId || t.installmentItemId === item.id)
  const account = tx ? accounts.find((a) => a.id === tx.accountId) : undefined
  const isPaid = item.status === 'paid' || Boolean(item.transactionId)
  const effectivePaidDate = tx?.date || item.paidAt

  const [amount, setAmount] = useState(item.amount)
  const [dueDate, setDueDate] = useState(item.dueDate)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await updateInstallmentItem(item.id, { amount, dueDate })
      notifyUser('اطلاعات قسط با موفقیت ذخیره شد')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ذخیره نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <WindowPopup
      title={`مشخصات قسط ${toFaDigits(item.index)}${plan ? ` · ${plan.name}` : ''}`}
      subtitle={`سررسید: ${formatPersianDateFull(item.dueDate)}`}
      icon="📅"
      isOpen={true}
      onClose={onClose}
      defaultWidth={480}
      defaultHeight={540}
    >
      <div className="sheet-body-scroll" style={{ padding: '6px 0 16px' }}>
        {error ? (
          <div className="banner error" style={{ marginBottom: 12 }}>
            <span className="bico">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        {isPaid ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.28)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 700, fontSize: 13 }}>
              <span>✓</span>
              <span>این قسط پرداخت و تسویه شده است</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hy-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--hy-text-tertiary)' }}>تاریخ پرداخت قسط:</span>
              <strong style={{ color: '#059669' }}>
                {formatPersianDateFull(effectivePaidDate || item.dueDate)}
              </strong>
            </div>
            {account ? (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--hy-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--hy-text-tertiary)' }}>حساب کسرشده:</span>
                <span>{account.name}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="field-stack">
          <div className="field-chip">
            <span className="ficon">💰</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">مبلغ قسط</div>
              <AmountField
                value={amount}
                onChange={setAmount}
                autoFocus={!isPaid}
                ariaLabel="مبلغ قسط به ریال"
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>ریال</span>
          </div>

          <DateField label="سررسید قسط" value={dueDate} onChange={setDueDate} />
          
          <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', padding: '2px 8px' }}>
            موعد سررسید شمسی: <strong>{formatPersianDateFull(dueDate)}</strong>
          </div>
        </div>

        <p className="avail-hint" style={{ marginTop: 12, marginBottom: 16 }}>
          مبلغ نمایشی: <strong>{formatRial(amount)} ریال</strong>
        </p>

        <button
          className="cta-confirm"
          type="button"
          style={{ marginTop: 'auto' }}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات قسط'}
        </button>
      </div>
    </WindowPopup>
  )
}
