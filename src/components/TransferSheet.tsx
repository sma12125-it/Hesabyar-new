import { useState } from 'react'
import { formatRial } from '../lib/money'
import { todayIso } from '../lib/iso'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import { PickerSheet } from './PickerSheet'
import { WindowPopup } from './WindowPopup'

export function TransferSheet({
  presetFromId,
  totalBalance,
  transferId,
  onClose,
}: {
  presetFromId?: string
  totalBalance: number
  transferId?: string
  onClose: () => void
}) {
  const { activeAccounts, addTransfer, updateTransaction, transactions } = useStore()
  const existingOut = transferId
    ? transactions.find((t) => t.transferId === transferId && t.kind === 'transferOut')
    : undefined
  const existingIn = transferId
    ? transactions.find((t) => t.transferId === transferId && t.kind === 'transferIn')
    : undefined
  const [fromId, setFromId] = useState(existingOut?.accountId ?? presetFromId ?? activeAccounts[0]?.id ?? '')
  const [toId, setToId] = useState(
    () =>
      existingIn?.accountId ??
      activeAccounts.find((a) => a.id !== (existingOut?.accountId ?? presetFromId ?? activeAccounts[0]?.id))?.id ??
      '',
  )
  const [amount, setAmount] = useState(existingOut?.amount ?? 0)
  const [fee, setFee] = useState<number>(0)
  const [hasFee, setHasFee] = useState(false)
  const [note, setNote] = useState(existingOut?.note ?? '')
  const [date, setDate] = useState(() => existingOut?.date ?? todayIso())
  const [picker, setPicker] = useState<'from' | 'to' | 'note' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const from = activeAccounts.find((a) => a.id === fromId)
  const to = activeAccounts.find((a) => a.id === toId)
  const available = from
    ? from.balance + (existingOut && existingOut.accountId === from.id ? existingOut.amount : 0)
    : 0
  const totalDeduction = amount + (hasFee ? fee : 0)
  const over = Boolean(from && totalDeduction > available)
  const empty = !from || !to || amount <= 0
  const same = Boolean(from && to && from.id === to.id)
  const disabled = saving || empty || over || same

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      if (existingOut) {
        await updateTransaction(existingOut.id, {
          amount,
          fromAccountId: fromId,
          toAccountId: toId,
          note,
          date,
        })
      } else {
        const transferNote = hasFee && fee > 0 ? `${note ? note + ' · ' : ''}کارمزد: ${formatRial(fee)} ریال` : note
        await addTransfer({
          amount,
          fromAccountId: fromId,
          toAccountId: toId,
          note: transferNote,
          date,
        })
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'انتقال نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  if (picker === 'from' || picker === 'to') {
    const excluding = picker === 'from' ? toId : fromId
    return (
      <PickerSheet title={picker === 'from' ? 'حساب مبدأ' : 'حساب مقصد'} onClose={() => setPicker(null)}>
        {activeAccounts.filter((a) => a.id !== excluding).length === 0 ? (
          <p className="sheet-sub">حساب فعال دیگری نیست</p>
        ) : (
          activeAccounts
            .filter((a) => a.id !== excluding)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                className="option-item lg-light"
                onClick={() => {
                  if (picker === 'from') setFromId(a.id)
                  else setToId(a.id)
                  setPicker(null)
                }}
              >
                <span className="oico">{picker === 'from' ? '↑' : '↓'}</span>
                <div>
                  <div className="otitle">{a.name}</div>
                  <div className="osub">موجودی قابل انتقال: {formatRial(a.balance)} ریال</div>
                </div>
              </button>
            ))
        )}
      </PickerSheet>
    )
  }

  return (
    <WindowPopup
      title={existingOut ? 'ویرایش انتقال' : 'انتقال بین حساب‌ها'}
      subtitle="انتقال وجه بین حساب‌های فعال شما"
      icon="⇄"
      isOpen={true}
      onClose={onClose}
      defaultWidth={520}
      defaultHeight={620}
      footer={
        <button
          className={`cta-confirm${disabled ? ' disabled' : ''}`}
          type="button"
          disabled={disabled}
          onClick={() => void submit()}
          style={{ width: '100%' }}
        >
          {saving ? 'در حال انتقال…' : existingOut ? 'ذخیره انتقال' : 'انتقال'}
        </button>
      }
    >
      <div className="sheet-body-scroll">
        {(error || over) && (
          <div className="banner error">
            <span className="bico">⛔</span>
            <span>{error || 'مبلغ از موجودی قابل انتقال بیشتر است'}</span>
          </div>
        )}
        <div className="field-stack">
          <button
            className="field-chip"
            type="button"
            style={{ alignItems: 'flex-start' }}
            onClick={() => setPicker('from')}
          >
            <span className="ficon">↑</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">مبدأ</div>
              <div className={from ? 'fvalue' : 'fvalue placeholder-val'}>
                {from?.name ?? 'انتخاب حساب مبدأ…'}
              </div>
              {from ? (
                <div className="avail-hint">
                  موجودی قابل انتقال: <strong>{formatRial(available)} ریال</strong>
                </div>
              ) : null}
            </div>
            <span className="fchev">‹</span>
          </button>
          <button className="field-chip" type="button" onClick={() => setPicker('to')}>
            <span className="ficon">↓</span>
            <div>
              <div className="flabel">مقصد</div>
              <div className={to ? 'fvalue' : 'fvalue placeholder-val'}>
                {to?.name ?? 'انتخاب حساب مقصد…'}
              </div>
            </div>
            <span className="fchev">‹</span>
          </button>
        </div>

        <AmountField
          variant="hero"
          value={amount}
          onChange={setAmount}
          autoFocus
          over={over}
          ariaLabel="مبلغ انتقال به ریال"
          style={{ marginTop: over ? 16 : 20 }}
        />

        <button
          className="field-chip"
          type="button"
          style={{ marginTop: 8 }}
          onClick={() => setPicker(picker === 'note' ? null : 'note')}
        >
          <span className="ficon">📝</span>
          <div style={{ flex: 1 }}>
            <div className="flabel">توضیح</div>
            {picker === 'note' ? (
              <input
                className="field-input"
                placeholder="اختیاری…"
                value={note}
                autoFocus
                onChange={(e) => setNote(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className={note ? 'fvalue' : 'fvalue placeholder-val'}>{note || 'اختیاری…'}</div>
            )}
          </div>
        </button>

        {/* Transfer Fee Toggle */}
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '0.5px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💳</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>کارمزد انتقال بانکی</span>
            </div>
            <button
              type="button"
              className={`cat-mini${hasFee ? ' active' : ''}`}
              onClick={() => {
                setHasFee((v) => !v)
                if (!hasFee && fee === 0) setFee(12000)
              }}
            >
              {hasFee ? 'فعال' : 'ندارد'}
            </button>
          </div>
          {hasFee ? (
            <div style={{ marginTop: 6, padding: '0 4px' }}>
              <input
                className="field-input"
                type="number"
                placeholder="مبلغ کارمزد به ریال (مثلاً ۱۲,۰۰۰)"
                value={fee || ''}
                onChange={(e) => setFee(Number(e.target.value) || 0)}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 8 }}>
          <DateField label="تاریخ" value={date} onChange={setDate} />
        </div>
      </div>
    </WindowPopup>
  )
}
