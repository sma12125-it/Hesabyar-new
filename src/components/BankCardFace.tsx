import { maskPan } from '../lib/vault'
import { toFaDigits } from '../lib/money'
import type { BankCard } from '../types'

export function formatExpiry(expiry: string): string {
  const [month, year] = expiry.split('/')
  if (!month || !year) return expiry
  return `${year}   ${month}`
}

export function formatSheba(sheba: string): string {
  const raw = sheba.replace(/\s/g, '').toUpperCase()
  const body = raw.startsWith('IR') ? raw.slice(2) : raw
  const groups = body.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  return groups ? `IR ${groups}` : raw
}

export function formatPan(pan: string, revealed: boolean): string {
  const digits = pan.replace(/\D/g, '')
  const shown = revealed ? digits : maskPan(digits).replace('•••• ', '')
  if (!revealed) return `••••  ••••  ••••  ${shown}`
  return digits.replace(/(\d{4})(?=\d)/g, '$1  ').trim()
}

export function BankCardFace({ card, revealed = false }: { card: BankCard; revealed?: boolean }) {
  const classLabel =
    card.classification === 'credit'
      ? 'اعتباری'
      : card.classification === 'investment'
        ? 'پس‌انداز / سرمایه'
        : 'نقدی'

  return (
    <article className="plastic-card" style={card.color ? { background: card.color } : undefined} aria-label={`کارت ${card.bankName}`}>
      <div className="plastic-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{card.bankName}</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {classLabel}
          </span>
        </div>
        <span className="plastic-brand">حساب‌یار</span>
      </div>
      <div className="plastic-chip" aria-hidden="true" />
      <div className="plastic-pan">{formatPan(card.pan, revealed)}</div>
      {card.accountNumber ? (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <small style={{ opacity: 0.75 }}>شماره حساب:</small>
          <span dir="ltr" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>{toFaDigits(card.accountNumber)}</span>
        </div>
      ) : null}
      {card.sheba ? (
        <div className="plastic-sheba" dir="ltr">
          <small>شبا</small>
          {formatSheba(card.sheba)}
        </div>
      ) : null}
      <div className="plastic-bottom">
        <span>
          <small>صاحب کارت</small>
          {card.holder}
        </span>
        <span className="plastic-expiry" dir="ltr">
          <small>انقضا</small>
          {formatExpiry(card.expiry)}
        </span>
        <span>
          <small>CVV</small>
          {revealed ? card.cvv : '•••'}
        </span>
      </div>
    </article>
  )
}
