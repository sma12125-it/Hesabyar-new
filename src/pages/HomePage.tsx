import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { CloudLamp } from '../components/CloudLamp'
import { HomeDashboard } from '../components/HomeDashboard'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import { isoToJalali, JALALI_MONTHS } from '../lib/jalaali'
import { todayIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'

interface HomePageProps {
  onScroll: (compact: boolean) => void
  setToast: Dispatch<SetStateAction<string | null>>
  onQuickEntry: (kind: 'expense' | 'income') => void
  onTransfer: () => void
  onAll: (initialSearch?: string) => void
  onSettings: () => void
}

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']

export function HomePage({ onScroll, onQuickEntry, onTransfer, onAll }: HomePageProps) {
  const [now, setNow] = useState(() => new Date())
  const { pending } = useSmsDrafts()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const jalali = isoToJalali(todayIso())
  const weekdayName = PERSIAN_WEEKDAYS[now.getDay()]
  const timeStr = toFaDigits(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  )
  const dateStr = jalali
    ? `${weekdayName}، ${toFaDigits(jalali.jd)} ${JALALI_MONTHS[jalali.jm - 1]} ${toFaDigits(jalali.jy)}`
    : weekdayName

  return (
    <div className="app-scroll page-home" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="home-head">
        <div className="home-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="icon-btn mobile-only-icon"
              onClick={() => window.dispatchEvent(new CustomEvent('hy:open-drawer'))}
              title="منوی ناوبری سایدبار"
              aria-label="منوی ناوبری سایدبار"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--hy-input-bg, rgba(255, 255, 255, 0.08))',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
              }}
            >
              ☰
            </button>
            <div>
              <h1 className="top-title" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>نمای کلی مالی</h1>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                <span>📅 {dateStr}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ fontWeight: 700, color: 'var(--hy-teal)', letterSpacing: '0.5px' }}>⏰ {timeStr}</span>
              </p>
            </div>
          </div>
          <div className="home-head-icons" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <CloudLamp />
            {/* Notification button for pending SMS transactions */}
            <Link
              to="/transactions/pending"
              className="icon-btn"
              title="تراکنش‌های در انتظار تأیید پیامک بانکی"
              aria-label="تراکنش‌های در انتظار تأیید"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--glass-chrome)',
                border: 'var(--glass-border)',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: 18,
              }}
            >
              <span>📩</span>
              {pending.length > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    padding: '0 4px',
                    borderRadius: 10,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                    lineHeight: 1,
                  }}
                >
                  {toFaDigits(pending.length)}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {/* Global Search Bar right on the Home Page */}
        <div
          onClick={() => onAll('')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onAll('')
          }}
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-chrome)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: 'var(--glass-border)',
            borderRadius: '16px',
            padding: '10px 14px',
            cursor: 'pointer',
            marginTop: '4px',
            boxShadow: 'var(--shadow-glass)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: '16px', opacity: 0.7 }}>🔍</span>
            <span style={{ fontSize: '13px', color: 'var(--hy-muted)' }}>
              جستجوی تراکنش‌ها، مبلغ، دسته‌بندی یا یادداشت…
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '8px',
              background: 'rgba(15, 118, 110, 0.12)',
              color: 'var(--hy-teal)',
              fontWeight: 600,
            }}
          >
            دفتر کل ‹
          </span>
        </div>

        <div className="home-head-actions">
          <button className="home-pill income" type="button" onClick={() => onQuickEntry('income')}>
            + درآمد
          </button>
          <button className="home-pill expense" type="button" onClick={() => onQuickEntry('expense')}>
            + هزینه
          </button>
          <button className="home-pill ghost" type="button" onClick={onTransfer}>
            انتقال
          </button>
        </div>
      </div>
      <HomeDashboard onAll={() => onAll('')} />
    </div>
  )
}
