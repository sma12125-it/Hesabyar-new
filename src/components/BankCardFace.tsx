import { maskPan } from '../lib/vault'
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
  return (
    <article className="plastic-card" style={card.color ? { background: card.color } : undefined} aria-label={`کارت ${card.bankName}`}>
      <div className="plastic-top">
        <span>{card.bankName}</span>
        <span className="plastic-brand">حساب‌یار</span>
      </div>
      <div className="plastic-chip" aria-hidden="true" />
      <div className="plastic-pan">{formatPan(card.pan, revealed)}</div>
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
