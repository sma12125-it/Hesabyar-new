import { useState } from 'react'
import { toJalaali } from '../lib/jalaali'
import { validateCard } from '../lib/vault'
import { digitsOnly } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { detectBankFromPan } from '../lib/bankDetector'
import { WindowPopup } from './WindowPopup'
import type { AccountClassification, BankCard } from '../types'

const COLORS = [
  'linear-gradient(135deg, #0f766e 0%, #115e59 48%, #1e1b4b 100%)',
  'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 50%, #0f172a 100%)',
  'linear-gradient(135deg, #b45309 0%, #9a3412 50%, #7c2d12 100%)',
  'linear-gradient(135deg, #be123c 0%, #9f1239 48%, #4c0519 100%)',
  'linear-gradient(135deg, #6d28d9 0%, #4c1d95 50%, #1e1b4b 100%)',
  'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
]

export const IRAN_BANKS = [
  'بانک ملی ایران',
  'بانک سپه',
  'بانک ملت',
  'بانک تجارت',
  'بانک صادرات',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک رفاه کارگران',
  'پست بانک',
  'بانک پاسارگاد',
  'بانک پارسیان',
  'بانک اقتصاد نوین',
  'بانک سامان',
  'بانک سرمایه',
  'بانک سینا',
  'بانک کارآفرین',
  'بانک شهر',
  'بانک دی',
  'بانک آینده',
  'بانک گردشگری',
  'بانک ایران زمین',
  'بانک خاورمیانه',
  'بانک قرض‌الحسنه مهر ایران',
  'بانک قرض‌الحسنه رسالت',
]

function groupPan(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const today = new Date()
const jalaliYear = toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate()).jy
const years = Array.from({ length: 12 }, (_, i) => ({
  value: String((jalaliYear + i) % 100).padStart(2, '0'),
  label: String(jalaliYear + i),
}))

export function CardFormSheet({
  card,
  onClose,
  onMinimize,
}: {
  card?: BankCard
  onClose: () => void
  onMinimize?: () => void
}) {
  const { saveCard } = useExtras()
  const known = card ? IRAN_BANKS.includes(card.bankName) : true
  const [bankChoice, setBankChoice] = useState(card ? (known ? card.bankName : 'سایر') : IRAN_BANKS[0]!)
  const [customBank, setCustomBank] = useState(card && !known ? card.bankName : '')
  const [holder, setHolder] = useState(card?.holder ?? '')
  const [pan, setPan] = useState(card ? groupPan(card.pan) : '')
  const [accountNumber, setAccountNumber] = useState(card?.accountNumber ?? '')
  const [classification, setClassification] = useState<AccountClassification>(card?.classification ?? 'cash')
  const [month, setMonth] = useState(card?.expiry.slice(0, 2) || months[0]!)
  const [year, setYear] = useState(card?.expiry.slice(3, 5) || years[0]!.value)
  const [cvv, setCvv] = useState(card?.cvv ?? '')
  const [shebaDigits, setShebaDigits] = useState(card?.sheba.replace(/^IR/i, '') ?? '')
  const [color, setColor] = useState(card?.color || COLORS[0]!)
  const [error, setError] = useState<string | null>(null)
  const bankName = bankChoice === 'سایر' ? customBank : bankChoice

  function onPanChange(rawVal: string) {
    const formatted = groupPan(rawVal)
    setPan(formatted)
    const detected = detectBankFromPan(formatted)
    if (detected) {
      if (IRAN_BANKS.includes(detected.name)) {
        setBankChoice(detected.name)
      } else {
        setBankChoice('سایر')
        setCustomBank(detected.name)
      }
      setColor(detected.color)
    }
  }

  async function save() {
    const expiry = `${month}/${year}`
    const sheba = shebaDigits ? `IR${shebaDigits}` : ''
    const problem = validateCard({ bankName, holder, pan, expiry, cvv })
    if (problem) {
      setError(problem)
      return
    }
    if (sheba && !/^IR\d{24}$/.test(sheba)) {
      setError('شبا بعد از IR باید ۲۴ رقم باشد')
      return
    }
    try {
      await saveCard({
        id: card?.id,
        bankName,
        holder,
        pan: digitsOnly(pan),
        expiry,
        cvv,
        sheba,
        note: card?.note ?? '',
        color,
        accountNumber: accountNumber.trim() || undefined,
        classification,
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'کارت ذخیره نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <WindowPopup
      title={card ? 'ویرایش کارت بانکی' : 'کارت بانکی جدید'}
      subtitle={bankChoice !== 'سایر' ? bankChoice : undefined}
      icon="💳"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={520}
      defaultHeight={680}
      footer={
        <button
          className="cta-confirm"
          type="button"
          onClick={() => void save()}
        >
          {card ? 'ذخیره تغییرات' : 'ثبت کارت'}
        </button>
      }
    >
      <div className="sheet-body-scroll" style={{ padding: '8px 2px' }}>
        {error ? <div className="banner error"><span>{error}</span></div> : null}
        <div className="field-stack">
          {/* Classification segment - Request 6 */}
          <div style={{ margin: '2px 0', fontSize: 12, fontWeight: 600, color: 'var(--hy-text-tertiary)' }}>
            دسته‌بندی کارت و حساب
          </div>
          <div className="seg" role="tablist">
            <button
              className={`seg-btn${classification === 'cash' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('cash')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              نقدی و جاری
            </button>
            <button
              className={`seg-btn${classification === 'credit' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('credit')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              اعتباری / خرید
            </button>
            <button
              className={`seg-btn${classification === 'investment' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('investment')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              پس‌انداز / سرمایه
            </button>
          </div>

          <select className="field-input" value={bankChoice} onChange={(e) => setBankChoice(e.target.value)}>
            {IRAN_BANKS.map((name) => <option key={name} value={name}>{name}</option>)}
            <option value="سایر">سایر</option>
          </select>
          {bankChoice === 'سایر' ? (
            <input className="field-input" placeholder="نام بانک" value={customBank} onChange={(e) => setCustomBank(e.target.value)} />
          ) : null}
          <input className="field-input" placeholder="صاحب کارت" value={holder} onChange={(e) => setHolder(e.target.value)} />
          <input
            className="field-input"
            inputMode="numeric"
            placeholder="شماره کارت: ۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶"
            dir="ltr"
            value={pan}
            onChange={(e) => onPanChange(e.target.value)}
          />

          {/* Request 11: Bank Account Number field */}
          <input
            className="field-input"
            inputMode="numeric"
            placeholder="شماره حساب بانکی (اختیاری)"
            dir="ltr"
            value={accountNumber}
            onChange={(e) => setAccountNumber(digitsOnly(e.target.value))}
          />
          <div className="expiry-row">
            <label>
              ماه
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              سال شمسی
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <input className="field-input" inputMode="numeric" placeholder="CVV" value={cvv} onChange={(e) => setCvv(digitsOnly(e.target.value).slice(0, 4))} />
          <div className="sheba-row">
            <span>IR</span>
            <input
              className="field-input"
              inputMode="numeric"
              placeholder="۲۴ رقم"
              dir="ltr"
              value={shebaDigits}
              onChange={(e) => setShebaDigits(digitsOnly(e.target.value).slice(0, 24))}
            />
          </div>
          <div className="swatch-row" aria-label="رنگ کارت">
            {COLORS.map((item) => (
              <button key={item} type="button" className={`swatch${color === item ? ' on' : ''}`} style={{ background: item }} onClick={() => setColor(item)} />
            ))}
          </div>
          <button className="cta-confirm" type="button" onClick={() => void save()}>{card ? 'ذخیره تغییرات' : 'ثبت کارت'}</button>
        </div>
      </div>
    </WindowPopup>
  )
}
