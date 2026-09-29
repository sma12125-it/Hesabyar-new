import { useNavigate } from 'react-router-dom'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { SettingsButton } from '../components/SettingsButton'
import { PlanCard } from './InstallmentsPage'

export function InstallmentsArchivePage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { plans, items } = useStore()
  const navigate = useNavigate()
  const today = todayIso()
  const completed = plans.filter((p) => p.status === 'completed')
  const archived = plans.filter((p) => p.status === 'archived')
  const empty = completed.length === 0 && archived.length === 0

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="detail-top">
        <button className="back-btn" type="button" onClick={() => navigate('/installments')} aria-label="بازگشت">
          ›
        </button>
        <h1>بایگانی اقساط</h1>
        <SettingsButton />
      </div>

      {empty ? (
        <div className="empty-state lg">
          <div className="empty-ico">📦</div>
          <h2>بایگانی خالی است</h2>
          <p>وقتی همهٔ اقساط یک برنامه پرداخت شود، از لیست فعال برداشته می‌شود و اینجا می‌ماند.</p>
        </div>
      ) : (
        <>
          {completed.length > 0 ? (
            <>
              <div className="section-head">
                <h2>پایان‌یافته</h2>
                <span className="link">{toFaDigits(completed.length)} مورد</span>
              </div>
              <div className="plan-list">
                {completed.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    items={items.filter((i) => i.planId === plan.id)}
                    today={today}
                    onClick={() => navigate(`/installments/${plan.id}`)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {archived.length > 0 ? (
            <>
              <div className="section-head">
                <h2>آرشیو دستی</h2>
                <span className="link">{toFaDigits(archived.length)} مورد</span>
              </div>
              <div className="plan-list">
                {archived.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    items={items.filter((i) => i.planId === plan.id)}
                    today={today}
                    onClick={() => navigate(`/installments/${plan.id}`)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
