import { useState } from 'react'
import { formatPersianDateFull } from '../lib/dates'
import { toFaDigits } from '../lib/money'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { WindowPopup } from './WindowPopup'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import type { DebtLoan, DebtLoanDirection } from '../types'

interface DebtSheetProps {
  debt?: DebtLoan
  onClose: () => void
}

export function DebtSheet({ debt, onClose }: DebtSheetProps) {
  const { debts, saveDebt, deleteDebt, settleDebt, formatMoney } = useExtras()
  const { activeAccounts } = useStore()

  const isEdit = Boolean(debt)
  const [direction, setDirection] = useState<DebtLoanDirection>(debt?.direction ?? 'borrowed')
  const [party, setParty] = useState(debt?.party ?? '')
  const [amount, setAmount] = useState(debt?.amount ?? 0)
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '')
  const [hasDueDate, setHasDueDate] = useState(Boolean(debt?.dueDate))
  const [accountId, setAccountId] = useState(debt?.accountId ?? activeAccounts[0]?.id ?? '')
  const [note, setNote] = useState(debt?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSettled = debt?.status === 'settled'

  async function handleSave() {
    setError(null)
    if (!party.trim()) {
      setError('نام شخص یا طرف‌حساب الزامی است')
      return
    }
    if (amount <= 0) {
      setError('مبلغ باید بیشتر از صفر باشد')
      return
    }

    setSaving(true)
    try {
      await saveDebt({
        id: debt?.id,
        direction,
        party: party.trim(),
        amount,
        dueDate: hasDueDate && dueDate ? dueDate : undefined,
        accountId: accountId || undefined,
        note: note.trim(),
        status: debt?.status ?? 'active',
        settledAt: debt?.settledAt,
        transactionId: debt?.transactionId,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره‌سازی')
    } finally {
      setSaving(false)
    }
  }

  async function handleSettle() {
    if (!debt) return
    if (!confirm('آیا از تسویه کامل این بدهی / طلب اطمینان دارید؟')) return
    setSaving(true)
    try {
      await settleDebt(debt.id, accountId || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت تسویه')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!debt) return
    if (!confirm('آیا از حذف این ردیف اطمینان دارید؟')) return
    setSaving(true)
    try {
      await deleteDebt(debt.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WindowPopup
      title={isEdit ? (direction === 'borrowed' ? 'ویرایش بدهی (قرض گرفته)' : 'ویرایش طلب (قرض داده)') : 'ثبت بدهی یا طلب جدید'}
      subtitle="مدیریت قرض‌الحسنه و مبالغ غیرقسطی"
      icon="🤝"
      isOpen={true}
      onClose={onClose}
      defaultWidth={520}
      defaultHeight={640}
    >
      <div className="sheet-body-scroll" style={{ padding: '4px 0' }}>
        {error ? (
          <div className="banner error" style={{ marginBottom: 12 }}>
            <span className="bico">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        {isSettled ? (
          <div className="banner ok" style={{ marginBottom: 12 }}>
            <span className="bico">✓</span>
            <span>این مورد در تاریخ {formatPersianDateFull(debt.settledAt || '')} به طور کامل تسویه شده است.</span>
          </div>
        ) : null}

        {/* Direction Toggle */}
        {!isSettled ? (
          <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
            <button
              className={`seg-btn${direction === 'borrowed' ? ' active' : ''}`}
              type="button"
              onClick={() => setDirection('borrowed')}
              style={direction === 'borrowed' ? { background: 'rgba(239, 68, 68, 0.18)', color: 'var(--hy-expense)' } : undefined}
            >
              🔴 بدهی من (قرض گرفتم)
            </button>
            <button
              className={`seg-btn${direction === 'lent' ? ' active' : ''}`}
              type="button"
              onClick={() => setDirection('lent')}
              style={direction === 'lent' ? { background: 'rgba(16, 185, 129, 0.18)', color: 'var(--hy-income)' } : undefined}
            >
              🟢 طلب من (قرض دادم)
            </button>
          </div>
        ) : null}

        <div className="field-stack">
          {/* Party Name */}
          <div className="field-chip">
            <span className="ficon">👤</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">{direction === 'borrowed' ? 'طلبکار (از چه کسی قرض گرفتید؟)' : 'بدهکار (به چه کسی قرض دادید؟)'}</div>
              <input
                className="field-input"
                placeholder="مثلاً علی رضایی، دایی، دوست..."
                value={party}
                onChange={(e) => setParty(e.target.value)}
                autoFocus={!isEdit}
                disabled={isSettled}
              />
            </div>
          </div>

          {/* Amount */}
          <div className="field-chip">
            <span className="ficon">💰</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">مبلغ قرض</div>
              <AmountField
                value={amount}
                onChange={setAmount}
                ariaLabel="مبلغ به ریال"
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>ریال</span>
          </div>

          {/* Due date toggle */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '0.5px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📅</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>تعیین تاریخ موعد بازپرداخت</span>
              </div>
              <button
                type="button"
                className={`cat-mini${hasDueDate ? ' active' : ''}`}
                onClick={() => {
                  setHasDueDate((v) => !v)
                  if (!hasDueDate && !dueDate) {
                    const nextMonth = new Date()
                    nextMonth.setMonth(nextMonth.getMonth() + 1)
                    setDueDate(nextMonth.toISOString().slice(0, 10))
                  }
                }}
                disabled={isSettled}
              >
                {hasDueDate ? 'دارد' : 'بدون موعد مشخص'}
              </button>
            </div>
            {hasDueDate ? (
              <div style={{ marginTop: 10 }}>
                <DateField label="تاریخ سررسید بازپرداخت" value={dueDate} onChange={setDueDate} />
              </div>
            ) : null}
          </div>

          {/* Account Selection */}
          {activeAccounts.length > 0 ? (
            <div className="field-chip">
              <span className="ficon">💳</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">حساب بانکی / نقدی مرتبط</div>
                <select
                  className="field-input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={isSettled}
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                >
                  <option value="">بدون انتخاب حساب</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {/* Notes */}
          <div className="field-chip">
            <span className="ficon">📝</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">شرح یا توضیحات تکمیلی</div>
              <input
                className="field-input"
                placeholder="توضیح دلخواه، بابت چی..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isSettled}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {!isSettled ? (
            <button
              className="cta-confirm"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'در حال ذخیره…' : isEdit ? 'ذخیره تغییرات' : 'ثبت بدهی / طلب'}
            </button>
          ) : null}

          {isEdit && !isSettled ? (
            <button
              className="action-chip lg-light"
              type="button"
              style={{
                justifyContent: 'center',
                height: 44,
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--hy-income)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                fontWeight: 700,
              }}
              onClick={() => void handleSettle()}
              disabled={saving}
            >
              ✓ تسویه کامل و مختومه کردن
            </button>
          ) : null}

          {isEdit ? (
            <button
              className="btn-ghost-danger"
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              style={{ height: 40 }}
            >
              🗑️ حذف این ردیف
            </button>
          ) : null}
        </div>
      </div>
    </WindowPopup>
  )
}
