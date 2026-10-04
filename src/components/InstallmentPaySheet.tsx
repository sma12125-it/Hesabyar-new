import { useState } from 'react'
import { INSTALLMENT_CATEGORY_ID, categoriesFor, getCategory } from '../lib/categories'
import { formatPersianDateFull } from '../lib/dates'
import { defaultPayNote } from '../lib/installments'
import { formatRial, toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { PickerSheet } from './PickerSheet'
import { WindowPopup } from './WindowPopup'
import type { InstallmentItem, InstallmentPlan } from '../types'

export function InstallmentPaySheet({
  plan,
  item,
  remaining,
  onClose,
  onMinimize,
}: {
  plan: InstallmentPlan
  item: InstallmentItem
  remaining: number
  onClose: () => void
  onMinimize?: () => void
}) {
  const { activeAccounts, customCategories, payInstallment } = useStore()
  const [accountId, setAccountId] = useState(plan.defaultAccountId)
  const [categoryId, setCategoryId] = useState<string>(plan.categoryId ?? INSTALLMENT_CATEGORY_ID)
  const [note, setNote] = useState(defaultPayNote(plan.name, item.index, plan.totalCount))
  const [picker, setPicker] = useState<'account' | 'category' | 'note' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const account = activeAccounts.find((a) => a.id === accountId)
  const category = getCategory(categoryId, customCategories) || getCategory(INSTALLMENT_CATEGORY_ID)
  const insufficient = Boolean(account && item.amount > account.balance)
  const disabled = saving || !account || insufficient

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await payInstallment(item.id, accountId, note)
      notifyUser(`قسط ${toFaDigits(item.index)} پرداخت شد`)
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

  if (picker === 'category') {
    const expenseCats = categoriesFor('expense', customCategories)
    return (
      <PickerSheet title="انتخاب دسته‌بندی پرداخت" onClose={() => setPicker(null)}>
        {expenseCats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`option-item lg-row${cat.id === categoryId ? ' active' : ''}`}
            onClick={() => {
              setCategoryId(cat.id)
              setPicker(null)
            }}
          >
            <span className="oico">{cat.icon}</span>
            <div>
              <div className="otitle">{cat.name}</div>
              {cat.id === 'installments' ? <div className="osub">پیش‌فرض اقساط</div> : null}
            </div>
          </button>
        ))}
      </PickerSheet>
    )
  }

  return (
    <WindowPopup
      title={`پرداخت قسط ${toFaDigits(item.index)} از ${toFaDigits(plan.totalCount)}`}
      subtitle={`${plan.name} · سررسید: ${formatPersianDateFull(item.dueDate)}`}
      icon="💳"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={490}
      defaultHeight={600}
    >
      <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
        {(error || insufficient) && (
          <div className="banner error" style={{ marginBottom: 12 }}>
            <span className="bico">⛔</span>
            <span>{error || 'موجودی حساب برای پرداخت این قسط کافی نیست'}</span>
          </div>
        )}

        <div className="amount-block" style={{ margin: '4px 0 16px' }}>
          <div className="hint">مبلغ قسط</div>
          <div className="big" style={insufficient ? { color: 'var(--hy-expense)' } : undefined}>
            {formatRial(item.amount)}
            <span className="cur">ریال</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', marginTop: 4 }}>
            مانده کل برنامه: {formatRial(remaining)} ریال
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

          {/* Changeable Category */}
          <button className="field-chip" type="button" onClick={() => setPicker('category')}>
            <span className="ficon">{category?.icon ?? '📂'}</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">دسته‌بندی (قابل تغییر)</div>
              <div className="fvalue">{category?.name ?? 'اقساط'}</div>
            </div>
            <span className="fchev">‹</span>
          </button>

          {!insufficient ? (
            <button
              className="field-chip"
              type="button"
              onClick={() => setPicker(picker === 'note' ? null : 'note')}
            >
              <span className="ficon">📝</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">توضیح تراکنش</div>
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

        <div style={{ marginTop: 20 }}>
          <button
            className={`cta-confirm expense-cta${disabled ? ' disabled' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => void submit()}
          >
            {saving ? 'در حال پرداخت…' : `پرداخت و ثبت هزینه (${formatRial(item.amount)} ریال)`}
          </button>
        </div>
      </div>
    </WindowPopup>
  )
}
