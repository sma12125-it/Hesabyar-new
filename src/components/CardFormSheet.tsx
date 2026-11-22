import { useState } from 'react'
import { toJalaali } from '../lib/jalaali'
import { validateCard } from '../lib/vault'
import { digitsOnly } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { detectBankFromPan } from '../lib/bankDetector'
import { WindowPopup } from './WindowPopup'
import type { AccountClassification, BankCard } from '../types'

const COLOR_PALETTES = [
  {
    name: 'کلاسیک و لوکس',
    colors: [
      'linear-gradient(135deg, #0f766e 0%, #115e59 48%, #1e1b4b 100%)', // زمردی تیره
      'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 50%, #0f172a 100%)', // لاجوردی شیک
      'linear-gradient(135deg, #b45309 0%, #9a3412 50%, #7c2d12 100%)', // برنزی کهربایی
      'linear-gradient(135deg, #be123c 0%, #9f1239 48%, #4c0519 100%)', // یاقوتی سلطنتی
      'linear-gradient(135deg, #6d28d9 0%, #4c1d95 50%, #1e1b4b 100%)', // بنفش سلطنتی
      'linear-gradient(135deg, #0f172a 0%, #334155 100%)', // تیتانیوم دودی
    ],
  },
  {
    name: 'مدرن و نئونی',
    colors: [
      'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)', // سایبرپانک
      'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #3b82f6 100%)', // بنفش صورتی
      'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)', // زمرد درخشان
      'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', // طلای براق
      'linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #be123c 100%)', // مرجانی پرحرارت
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #4c1d95 100%)', // ارغوانی فضایی
    ],
  },
  {
    name: 'مات و مینی‌مال',
    colors: [
      'linear-gradient(135deg, #18181b 0%, #27272a 100%)', // مشکی مات
      'linear-gradient(135deg, #334155 0%, #1e293b 100%)', // طوسی زغالی
      'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', // سرمه‌ای اقیانوسی
      'linear-gradient(135deg, #14532d 0%, #052e16 100%)', // زیتونی جنگلی
      'linear-gradient(135deg, #701a75 0%, #4a044e 100%)', // مخملی تمشکی
      'linear-gradient(135deg, #78350f 0%, #451a03 100%)', // چرم قهوه‌ای
    ],
  },
]

const ALL_PRESET_COLORS = COLOR_PALETTES.flatMap((p) => p.colors)

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
  const [smsSendersInput, setSmsSendersInput] = useState(card?.smsSenders?.join('، ') ?? '')
  const [classification, setClassification] = useState<AccountClassification>(card?.classification ?? 'cash')
  const [month, setMonth] = useState(card?.expiry.slice(0, 2) || months[0]!)
  const [year, setYear] = useState(card?.expiry.slice(3, 5) || years[0]!.value)
  const [cvv, setCvv] = useState(card?.cvv ?? '')
  const [shebaDigits, setShebaDigits] = useState(card?.sheba.replace(/^IR/i, '') ?? '')
  const [color, setColor] = useState(card?.color || ALL_PRESET_COLORS[0]!)
  const [activePaletteIndex, setActivePaletteIndex] = useState(0)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [customStart, setCustomStart] = useState('#0f766e')
  const [customEnd, setCustomEnd] = useState('#1e1b4b')
  const [customAngle, setCustomAngle] = useState(135)
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
      const smsSenders = smsSendersInput
        .split(/[,،\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
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
        smsSenders: smsSenders.length > 0 ? smsSenders : undefined,
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
          <input
            className="field-input"
            placeholder="شماره‌های ارسال پیامک بانکی (مثلاً: 20004000، 9820004000)"
            dir="ltr"
            value={smsSendersInput}
            onChange={(e) => setSmsSendersInput(e.target.value)}
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
          {/* Color Palettes and Custom Color Creator */}
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-tertiary)' }}>
                🎨 رنگ و پالت ظاهری کارت
              </span>
              <button
                type="button"
                className="cat-mini"
                onClick={() => setShowCustomBuilder((v) => !v)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: showCustomBuilder ? 'rgba(15, 118, 110, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  color: showCustomBuilder ? 'var(--hy-teal)' : 'inherit',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {showCustomBuilder ? 'بستن رنگ سفارشی ✕' : '✨ ساخت رنگ دلخواه'}
              </button>
            </div>

            {/* Palette Selection Tabs */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {COLOR_PALETTES.map((pal, idx) => (
                <button
                  key={pal.name}
                  type="button"
                  className={`cat-mini${activePaletteIndex === idx ? ' active' : ''}`}
                  onClick={() => setActivePaletteIndex(idx)}
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    borderRadius: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pal.name}
                </button>
              ))}
            </div>

            {/* Swatch row for active palette */}
            <div
              className="swatch-row"
              aria-label="رنگ کارت"
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {COLOR_PALETTES[activePaletteIndex]!.colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`swatch${color === item ? ' on' : ''}`}
                  style={{
                    background: item,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: color === item ? '0 0 0 3px var(--hy-teal), 0 4px 10px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.2)',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() => setColor(item)}
                  title="انتخاب رنگ"
                />
              ))}
            </div>

            {/* Custom Color / Gradient Creator */}
            {showCustomBuilder ? (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  ابزار ترکیب و ساخت گرادیانت کارت
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="field-stack" style={{ margin: 0 }}>
                    <span style={{ fontSize: 11 }}>رنگ شروع</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={customStart}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomStart(val)
                          setColor(`linear-gradient(${customAngle}deg, ${val} 0%, ${customEnd} 100%)`)
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                        }}
                      />
                      <span dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                        {customStart}
                      </span>
                    </div>
                  </label>

                  <label className="field-stack" style={{ margin: 0 }}>
                    <span style={{ fontSize: 11 }}>رنگ پایان</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={customEnd}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomEnd(val)
                          setColor(`linear-gradient(${customAngle}deg, ${customStart} 0%, ${val} 100%)`)
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                        }}
                      />
                      <span dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                        {customEnd}
                      </span>
                    </div>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 11, minWidth: 60 }}>زاویه تابش:</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={customAngle}
                    onChange={(e) => {
                      const angle = Number(e.target.value)
                      setCustomAngle(angle)
                      setColor(`linear-gradient(${angle}deg, ${customStart} 0%, ${customEnd} 100%)`)
                    }}
                    style={{ flex: 1 }}
                  />
                  <span dir="ltr" style={{ fontSize: 11, width: 36, textAlign: 'center' }}>
                    {customAngle}°
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    className="cat-mini"
                    onClick={() => {
                      setColor(customStart)
                    }}
                    style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                  >
                    استفاده به صورت تک‌رنگ ساده
                  </button>
                  <button
                    type="button"
                    className="cat-mini active"
                    onClick={() => {
                      setColor(`linear-gradient(${customAngle}deg, ${customStart} 0%, ${customEnd} 100%)`)
                    }}
                    style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                  >
                    اعمال گرادیانت سفارشی
                  </button>
                </div>
              </div>
            ) : null}

            {/* Live Mini Preview of Selected Card Color */}
            <div
              style={{
                height: 34,
                borderRadius: 10,
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2), 0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              پیش‌نمایش پس‌زمینه کارت
            </div>
          </div>
        </div>
      </div>
    </WindowPopup>
  )
}
