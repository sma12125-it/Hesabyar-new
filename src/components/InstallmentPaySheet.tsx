import { useState } from 'react'
import { INSTALLMENT_CATEGORY_ID, getCategory } from '../lib/categories'
import { formatPersianDate } from '../lib/dates'
import { defaultPayNote } from '../lib/installments'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { PickerSheet } from './PickerSheet'
import type { InstallmentItem, InstallmentPlan } from '../types'

export function InstallmentPaySheet({
  plan,
  item,
  remaining,
  onClose,
}: {
  plan: InstallmentPlan
  item: InstallmentItem
  remaining: number
  onClose: () => void
}) {
  const { activeAccounts, payInstallment } = useStore()
  const [accountId, setAccountId] = useState(plan.defaultAccountId)
  const [note, setNote] = useState(defaultPayNote(plan.name, item.index, plan.totalCount))
  const [picker, setPicker] = useState<'account' | 'note' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const account = activeAccounts.find((a) => a.id === accountId)
  const category = getCategory(INSTALLMENT_CATEGORY_ID)
  const insufficient = Boolean(account && item.amount > account.balance)
  const disabled = saving || !account || insufficient

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await payInstallment(item.id, accountId, note)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'پرداخت نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  if (picker === 'account') {
    return (
      <PickerSheet title="حساب پرداخت" onClose={() => setPicker(null)}>
        {activeAccounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className="option-item lg-light"
            onClick={() => {
              setAccountId(a.id)
              setPicker(null)
            }}
          >
            <span className="oico">💳</span>
            <div>
              <div className="otitle">{a.name}</div>
              <div className="osub">موجودی قابل پرداخت: {formatRial(a.balance)} ریال</div>
            </div>
          </button>
        ))}
      </PickerSheet>
    )
  }

  return (
    <>
      <div className="peek-home">
        <div className="ph-title">{plan.name}</div>
        <div className="ph-amt">{formatRial(remaining)} ریال</div>
      </div>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="پرداخت قسط">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>پرداخت قسط</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>
        <p className="sheet-sub">
          قسط {item.index} از {plan.totalCount} · سررسید {formatPersianDate(item.dueDate)}
          {insufficient ? '' : ' · ثبت به‌عنوان هزینه'}
        </p>
        <div className="sheet-body-scroll">
          {(error || insufficient) && (
            <div className="banner error">
              <span className="bico">⛔</span>
              <span>{error || 'موجودی حساب برای پرداخت این قسط کافی نیست'}</span>
            </div>
          )}
          <div className="amount-block" style={{ margin: '4px 0 18px' }}>
            <div className="hint">مبلغ</div>
            <div className="big" style={insufficient ? { color: 'var(--hy-expense)' } : undefined}>
              {formatRial(item.amount)}
              <span className="cur">ریال</span>
            </div>
          </div>
          <div className="field-stack">
            <button
              className={`field-chip${insufficient ? ' invalid' : ''}`}
              type="button"
              style={{ alignItems: 'flex-start' }}
              onClick={() => setPicker('account')}
            >
              <span className="ficon">💳</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">حساب پرداخت</div>
                <div className={account ? 'fvalue' : 'fvalue placeholder-val'}>
                  {account?.name ?? 'انتخاب حساب…'}
                </div>
                {account ? (
                  <div className="avail-hint">
                    موجودی قابل پرداخت:{' '}
                    <strong style={insufficient ? { color: 'var(--hy-expense)' } : undefined}>
                      {formatRial(account.balance)} ریال
                    </strong>
                  </div>
                ) : null}
              </div>
              <span className="fchev">‹</span>
            </button>
            <div className="field-chip chip-readonly">
              <span className="ficon">{category?.icon ?? '📂'}</span>
              <div>
                <div className="flabel">دسته‌بندی</div>
                <div className="fvalue">{category?.name ?? 'اقساط'}</div>
              </div>
              <span className="readonly-tag">ثابت</span>
            </div>
            {!insufficient ? (
              <button
                className="field-chip"
                type="button"
                onClick={() => setPicker(picker === 'note' ? null : 'note')}
              >
                <span className="ficon">📝</span>
                <div style={{ flex: 1 }}>
                  <div className="flabel">توضیح</div>
                  {picker === 'note' ? (
                    <input
                      className="field-input"
                      value={note}
                      autoFocus
                      onChange={(e) => setNote(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="fvalue">{note}</div>
                  )}
                </div>
              </button>
            ) : null}
          </div>
          <button
            className={`cta-confirm expense-cta${disabled ? ' disabled' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => void submit()}
            style={{ marginTop: 'auto' }}
          >
            {saving ? 'در حال پرداخت…' : 'پرداخت قسط'}
          </button>
        </div>
      </div>
    </>
  )
}
