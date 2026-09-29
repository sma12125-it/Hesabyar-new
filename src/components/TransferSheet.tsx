import { useState } from 'react'
import { formatRial } from '../lib/money'
import { todayIso } from '../lib/iso'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import { PickerSheet } from './PickerSheet'

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
  const over = Boolean(from && amount > available)
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
        await addTransfer({
          amount,
          fromAccountId: fromId,
          toAccountId: toId,
          note,
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
    <>
      <div className="peek-home">
        <div className="ph-title">خانه</div>
        <div className="ph-amt">{formatRial(totalBalance)} ریال</div>
      </div>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="انتقال">
        <div className="sheet-handle" />
        <div className="nav-sheet-head">
          <button className="back-btn" type="button" onClick={onClose} aria-label="بازگشت">
            ›
          </button>
          <h1>{existingOut ? 'ویرایش انتقال' : 'انتقال'}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>
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

          <div style={{ marginTop: 8 }}>
            <DateField label="تاریخ" value={date} onChange={setDate} />
          </div>

          <button
            className={`cta-confirm${disabled ? ' disabled' : ''}`}
            type="button"
            disabled={disabled}
            onClick={() => void submit()}
            style={{ marginTop: 'auto' }}
          >
            {saving ? 'در حال انتقال…' : existingOut ? 'ذخیره انتقال' : 'انتقال'}
          </button>
        </div>
      </div>
    </>
  )
}
