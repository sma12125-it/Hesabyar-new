import { useState } from 'react'
import { DateField } from './DateField'
import { AmountField } from './AmountField'
import { todayIso } from '../lib/iso'
import { digitsOnly } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import type { Cheque, ChequeDirection, ChequeStatus } from '../types'

const COMMON_BANKS = [
  'بانک ملی',
  'بانک ملت',
  'بانک صادرات',
  'بانک تجارت',
  'بانک سپه',
  'بانک پاسارگاد',
  'بانک سامان',
  'بانک پارسیان',
  'بلوبانک',
  'بانک رسالت',
  'بانک آینده',
  'بانک شهر',
  'بانک مسکن',
  'بانک کشاورزی',
  'بانک رفاه',
]

export function ChequeSheet({
  cheque,
  onClose,
}: {
  cheque?: Cheque
  onClose: () => void
}) {
  const { saveCheque, deleteCheque } = useExtras()
  const { activeAccounts, addQuickEntry } = useStore()

  const [direction, setDirection] = useState<ChequeDirection>(cheque?.direction ?? 'payable')
  const [amount, setAmount] = useState(cheque?.amount ?? 0)
  const [sayadId, setSayadId] = useState(cheque?.sayadId ?? '')
  const [bankName, setBankName] = useState(cheque?.bankName ?? COMMON_BANKS[0])
  const [dueDate, setDueDate] = useState(cheque?.dueDate ?? todayIso())
  const [party, setParty] = useState(cheque?.party ?? '')
  const [status, setStatus] = useState<ChequeStatus>(cheque?.status ?? 'pending')
  const [accountId, setAccountId] = useState(cheque?.accountId ?? activeAccounts[0]?.id ?? '')
  const [note, setNote] = useState(cheque?.note ?? '')
  const [createTxOnClear, setCreateTxOnClear] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isEdit = Boolean(cheque)

  async function handleSave() {
    setError(null)
    if (amount <= 0) {
      setError('لطفاً مبلغ معتبری وارد کنید.')
      return
    }
    if (!party.trim()) {
      setError(direction === 'payable' ? 'نام گیرنده را وارد کنید.' : 'نام صادرکننده را وارد کنید.')
      return
    }

    setSaving(true)
    try {
      let txId = cheque?.transactionId

      // If user marks as cleared right now and wants an expense/income record
      if (createTxOnClear && status === 'cleared' && !txId && accountId) {
        const kind = direction === 'payable' ? 'expense' : 'income'
        const txNote = `وصول چک صیادی (${party}) - ${note || bankName}`
        await addQuickEntry({
          kind,
          amount,
          accountId,
          categoryId: direction === 'payable' ? 'other-exp' : 'other-inc',
          note: txNote,
          date: dueDate,
        })
      }

      await saveCheque({
        id: cheque?.id,
        direction,
        amount,
        sayadId: digitsOnly(sayadId),
        bankName,
        dueDate,
        party: party.trim(),
        status,
        accountId: accountId || undefined,
        note: note.trim(),
        transactionId: txId,
        clearedAt: status === 'cleared' ? (cheque?.clearedAt ?? todayIso()) : undefined,
      })

      notifyUser(isEdit ? 'چک به‌روزرسانی شد' : 'چک جدید ثبت شد')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت چک')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!cheque) return
    if (!confirm('آیا از حذف این چک مطمئن هستید؟')) return
    setSaving(true)
    try {
      await deleteCheque(cheque.id)
      notifyUser('چک حذف شد')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet sheet-sticky-cta" role="dialog" aria-label="مدیریت چک صیادی">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{isEdit ? 'ویرایش چک صیادی' : 'ثبت چک صیادی'}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        <div className="sheet-body-scroll">
          {error ? <div className="banner error"><span>{error}</span></div> : null}

          {/* Direction toggle */}
          <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
            <button
              className={`seg-btn${direction === 'payable' ? ' active' : ''}`}
              type="button"
              onClick={() => setDirection('payable')}
            >
              چک پرداختی (صادره)
            </button>
            <button
              className={`seg-btn${direction === 'receivable' ? ' active' : ''}`}
              type="button"
              onClick={() => setDirection('receivable')}
            >
              چک دریافتی
            </button>
          </div>

          {/* Amount */}
          <AmountField
            variant="hero"
            value={amount}
            onChange={setAmount}
            hint={direction === 'payable' ? 'مبلغ چک پرداختی' : 'مبلغ چک دریافتی'}
            caret={direction === 'payable' ? 'expense' : 'income'}
          />

          <div className="field-stack" style={{ marginTop: 12 }}>
            <label className="field-stack">
              <span>طرف حساب ({direction === 'payable' ? 'در وجه / گیرنده' : 'صادرکننده'})</span>
              <input
                className="field-input"
                placeholder={direction === 'payable' ? 'مثلاً: شرکت الف، آقای محمدی' : 'مثلاً: علی رضایی'}
                value={party}
                onChange={(e) => setParty(e.target.value)}
              />
            </label>

            <DateField label="تاریخ سررسید چک" value={dueDate} onChange={setDueDate} />

            <label className="field-stack">
              <span>شناسه ۱۶ رقمی صیاد (اختیاری)</span>
              <input
                className="field-input"
                inputMode="numeric"
                maxLength={16}
                placeholder="مثلاً: 1234567890123456"
                value={sayadId}
                onChange={(e) => setSayadId(e.target.value)}
              />
            </label>

            <label className="field-stack">
              <span>بانک صادرکننده</span>
              <select
                className="field-input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              >
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>

            {activeAccounts.length > 0 ? (
              <label className="field-stack">
                <span>حساب بانکی متصل</span>
                <select
                  className="field-input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">-- بدون اتصال به حساب --</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'bank' ? 'بانکی' : 'نقد'})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field-stack">
              <span>وضعیت چک</span>
              <select
                className="field-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ChequeStatus)}
              >
                <option value="pending">در انتظار سررسید / در جریان وصول</option>
                <option value="cleared">پاس‌شده / وصول‌شده</option>
                <option value="bounced">برگشت‌خورده</option>
              </select>
            </label>

            {status === 'cleared' && !cheque?.transactionId ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--hy-text)' }}>
                <input
                  type="checkbox"
                  checked={createTxOnClear}
                  onChange={(e) => setCreateTxOnClear(e.target.checked)}
                />
                <span>ثبت خودکار تراکنش {direction === 'payable' ? 'هزینه' : 'درآمد'} در دفتر حساب</span>
              </label>
            ) : null}

            <label className="field-stack">
              <span>بابت / توضیحات</span>
              <input
                className="field-input"
                placeholder="مثلاً: قسط قرارداد، رهن خانه، خرید تجهیزات"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="sheet-footer" style={{ display: 'flex', gap: 8 }}>
          {isEdit ? (
            <button
              className="cat-mini danger"
              type="button"
              disabled={saving}
              style={{ minWidth: 70 }}
              onClick={() => void handleDelete()}
            >
              حذف
            </button>
          ) : null}
          <button
            className="cta-confirm"
            type="button"
            disabled={saving || amount <= 0 || !party.trim()}
            onClick={() => void handleSave()}
            style={{ flex: 1 }}
          >
            {saving ? 'در حال ثبت…' : isEdit ? 'ذخیره تغییرات' : 'ثبت چک'}
          </button>
        </div>
      </div>
    </>
  )
}
