import { type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { CloudLamp } from '../components/CloudLamp'
import { HomeDashboard } from '../components/HomeDashboard'
import { SettingsButton } from '../components/SettingsButton'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import { isoToJalali, JALALI_MONTHS } from '../lib/jalaali'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'

interface HomePageProps {
  onScroll: (compact: boolean) => void
  setToast: Dispatch<SetStateAction<string | null>>
  onQuickEntry: (kind: 'expense' | 'income') => void
  onTransfer: () => void
  onQuickCards: () => void
  onAll: (initialSearch?: string) => void
  onSettings: () => void
}

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']

export function HomePage({ onScroll, onQuickEntry, onTransfer, onQuickCards, onAll }: HomePageProps) {
  const { pending } = useSmsDrafts()

  const today = todayIso()
  const jalali = isoToJalali(today)
  const weekdayName = PERSIAN_WEEKDAYS[new Date().getDay()]
  const dateStr = jalali
    ? `${weekdayName}، ${toFaDigits(jalali.jd)} ${JALALI_MONTHS[jalali.jm - 1]} ${toFaDigits(jalali.jy)}`
    : weekdayName

  return (
    <div className="app-scroll page-home" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="home-head">
        <div className="home-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <div className="home-title">
            <h1 className="top-title">حساب‌یار</h1>
            <p>{dateStr}</p>
          </div>
          <div className="home-head-icons" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <CloudLamp />
            <button
              type="button"
              className="icon-btn"
              onClick={onQuickCards}
              title="کیف کارت سریع (Alt+C)"
              aria-label="کیف کارت سریع"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--hy-input-bg, rgba(255, 255, 255, 0.08))',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              💳
            </button>
            <Link
              to="/transactions/pending"
              className="icon-btn"
              title="تراکنش‌های در انتظار تأیید پیامک بانکی"
              aria-label="تراکنش‌های در انتظار تأیید"
              style={{
                position: 'relative',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--hy-input-bg, rgba(255, 255, 255, 0.08))',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontSize: 18,
              }}
            >
              <span>📩</span>
              {pending.length > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 18,
                    height: 18,
                    padding: '0 4px',
                    borderRadius: 99,
                    background: 'var(--hy-expense)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {toFaDigits(pending.length)}
                </span>
              ) : null}
            </Link>
            <SettingsButton />
          </div>
        </div>

        <div className="home-head-actions">
          <button className="home-pill income" type="button" onClick={() => onQuickEntry('income')}>
            + درآمد
          </button>
          <button className="home-pill expense" type="button" onClick={() => onQuickEntry('expense')}>
            − هزینه
          </button>
          <button className="home-pill ghost" type="button" onClick={onTransfer}>
            ⇄ انتقال
          </button>
          <button className="home-pill ghost" type="button" onClick={onQuickCards}>
            💳 کارت‌ها
          </button>
          <button className="home-pill ghost" type="button" onClick={() => onAll('')}>
            📄 دفتر کل
          </button>
        </div>
      </div>
      <HomeDashboard onAll={() => onAll('')} />
    </div>
  )
}
