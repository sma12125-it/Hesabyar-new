import type { ReactNode } from 'react'
import { useExtras } from '../store/Extras'

export function BalanceHero({
  label,
  amount,
  sub,
}: {
  label: string
  amount: number
  sub: ReactNode
}) {
  const { formatMoney, unitLabel } = useExtras()

  return (
    <div className="balance-lens lg lg-strong">
      <div className="balance-hero" style={{ margin: 0, padding: '4px 0 0' }}>
        <div className="label">{label}</div>
        <div className="amount">
          {formatMoney(amount, false)}
          <span className="currency">{unitLabel}</span>
        </div>
        <div className="sub">{sub}</div>
      </div>
    </div>
  )
}
