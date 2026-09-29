import type { ReactNode } from 'react'
import { formatRial } from '../lib/money'

export function BalanceHero({
  label,
  amount,
  sub,
}: {
  label: string
  amount: number
  sub: ReactNode
}) {
  return (
    <div className="balance-lens lg lg-strong">
      <div className="balance-hero" style={{ margin: 0, padding: '4px 0 0' }}>
        <div className="label">{label}</div>
        <div className="amount">
          {formatRial(amount)}
          <span className="currency">ریال</span>
        </div>
        <div className="sub">{sub}</div>
      </div>
    </div>
  )
}
