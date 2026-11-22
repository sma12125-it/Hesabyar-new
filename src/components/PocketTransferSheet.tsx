import { useState } from 'react'
import { WindowPopup } from './WindowPopup'
import { AmountField } from './AmountField'
import { DateField } from './DateField'
import { PickerSheet } from './PickerSheet'
import { useStore } from '../store/Store'
import { computePocketBalances } from '../lib/balance'
import { formatRial } from '../lib/money'
import { todayIso } from '../lib/iso'
import { notifyUser } from '../lib/sync'

export function PocketTransferSheet({
  accountId,
  presetFromPocketId,
  presetToPocketId,
  onClose,
  onMinimize,
}: {
  accountId: string
  presetFromPocketId?: string
  presetToPocketId?: string
  onClose: () => void
  onMinimize?: () => void
}) {
  const { accounts, transactions, pockets, pocketTransfers, addPocketTransfer } = useStore()
  const account = accounts.find((a) => a.id === accountId)
  const accountPockets = pockets.filter((p) => p.accountId === accountId && !p.archived)

  const [fromPocketId, setFromPocketId] = useState<string>(() => {
    if (presetFromPocketId && accountPockets.some((p) => p.id === presetFromPocketId)) {
      return presetFromPocketId
    }
    return accountPockets[0]?.id ?? ''
  })

  const [toPocketId, setToPocketId] = useState<string>(() => {
    if (presetToPocketId && accountPockets.some((p) => p.id === presetToPocketId)) {
      return presetToPocketId
    }
    const other = accountPockets.find((p) => p.id !== fromPocketId)
    return other?.id ?? ''
  })

  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayIso())
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const balances = account ? computePocketBalances(account, transactions, pockets, pocketTransfers) : {}
  const fromPocket = accountPockets.find((p) => p.id === fromPocketId)
  const toPocket = accountPockets.find((p) => p.id === toPocketId)

  const availableFrom = fromPocket ? (balances[fromPocket.id] ?? 0) : 0
  const over = amount > 0 && amount > availableFrom
  const same = Boolean(fromPocketId && toPocketId && fromPocketId === toPocketId)
  const disabled = saving || amount <= 0 || !fromPocket || !toPocket || same

  async function handleSubmit() {
    if (!fromPocket || !toPocket) {
      setError('جیب‌های مبدأ و مقصد را مشخص کنید')
      return
    }
    if (same) {
      setError('جیب مبدأ و مقصد نمی‌تواند یکی باشد')
      return
    }
    if (amount <= 0) {
      setError('مبلغ انتقال را وارد کنید')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await addPocketTransfer({
        accountId,
        fromPocketId,
        toPocketId,
        amount,
        note: note.trim() || undefined,
        date,
      })
      notifyUser('انتقال بین جیب‌ها با موفقیت انجام شد')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت انتقال'
      setError(msg)
      notifyUser(msg)
    } finally {
      setSaving(false)
    }
  }

  if (picker === 'from' || picker === 'to') {
    const excluding = picker === 'from' ? toPocketId : fromPocketId
    return (
      <PickerSheet
        title={picker === 'from' ? 'انتخاب جیب مبدأ' : 'انتخاب جیب مقصد'}
        onClose={() => setPicker(null)}
      >
        {accountPockets
          .filter((p) => p.id !== excluding)
          .map((p) => {
            const bal = balances[p.id] ?? 0
            return (
              <button
                key={p.id}
                type="button"
                className="option-item lg-light"
                onClick={() => {
                  if (picker === 'from') setFromPocketId(p.id)
                  else setToPocketId(p.id)
                  setPicker(null)
                }}
              >
                <span className="oico">{p.isMain ? '⭐' : p.isOwn ? '👛' : '🤝'}</span>
                <div>
                  <div className="otitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{p.name}</span>
                    {p.isMain ? <span className="badge">اصلی</span> : null}
                    {!p.isOwn ? <span className="badge" style={{ background: '#ea580c', color: '#fff' }}>امانی</span> : null}
                  </div>
                  <div className="osub" style={{ color: bal < 0 ? '#ef4444' : undefined }}>
                    موجودی: {formatRial(bal)} ریال
                  </div>
                </div>
              </button>
            )
          })}
      </PickerSheet>
    )
  }

  return (
    <WindowPopup
      title="انتقال بین جیب‌ها"
      subtitle={account ? `حساب: ${account.name}` : undefined}
      icon="⇄"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={500}
      defaultHeight={580}
      footer={
        <button
          className={`cta-confirm${disabled ? ' disabled' : ''}`}
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          {saving ? 'در حال انتقال…' : 'انتقال وجه بین جیب‌ها'}
        </button>
      }
    >
      <div className="sheet-body-scroll">
        {(error || over) && (
          <div className="banner error">
            <span className="bico">⛔</span>
            <span>{error || 'مبلغ انتقال از موجودی جیب مبدأ بیشتر است (جیب به موجودی منفی می‌رود)'}</span>
          </div>
        )}

        <div className="field-stack">
          {/* From Pocket */}
          <button
            className="field-chip"
            type="button"
            style={{ alignItems: 'flex-start' }}
            onClick={() => setPicker('from')}
          >
            <span className="ficon">↑</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">جیب مبدأ (برداشت از)</div>
              <div className={fromPocket ? 'fvalue' : 'fvalue placeholder-val'}>
                {fromPocket?.name ?? 'انتخاب جیب مبدأ…'}
              </div>
              {fromPocket ? (
                <div className="avail-hint" style={{ color: availableFrom < 0 ? '#ef4444' : undefined }}>
                  موجودی جیب: <strong>{formatRial(availableFrom)} ریال</strong>
                </div>
              ) : null}
            </div>
            <span className="fchev">‹</span>
          </button>

          {/* To Pocket */}
          <button className="field-chip" type="button" onClick={() => setPicker('to')}>
            <span className="ficon">↓</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">جیب مقصد (واریز به)</div>
              <div className={toPocket ? 'fvalue' : 'fvalue placeholder-val'}>
                {toPocket?.name ?? 'انتخاب جیب مقصد…'}
              </div>
              {toPocket ? (
                <div className="avail-hint">
                  موجودی فعلی: <strong>{formatRial(balances[toPocket.id] ?? 0)} ریال</strong>
                </div>
              ) : null}
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
          style={{ marginTop: 16 }}
        />

        <div className="field-stack" style={{ marginTop: 12 }}>
          {/* Note */}
          <div className="field-chip" style={{ cursor: 'text' }}>
            <span className="ficon">📝</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">شرح و یادداشت انتقال</div>
              <input
                className="field-input"
                placeholder="توضیح اختیاری..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <DateField label="تاریخ انتقال" value={date} onChange={setDate} />
        </div>
      </div>
    </WindowPopup>
  )
}
