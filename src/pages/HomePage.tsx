import type { Dispatch, SetStateAction } from 'react'
import { CloudLamp } from '../components/CloudLamp'
import { HomeDashboard } from '../components/HomeDashboard'
import { SettingsButton } from '../components/SettingsButton'
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

export function HomePage({ onScroll, setToast, onQuickEntry, onTransfer, onAll, onSettings }: HomePageProps) {
  const today = todayIso()
  const jalali = isoToJalali(today)
  const subtitle = jalali ? `${JALALI_MONTHS[jalali.jm - 1]} ${toFaDigits(jalali.jy)} · امروز` : 'امروز'

  return (
    <div className="app-scroll page-home" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="home-head">
        <div className="home-title">
          <h1
            onContextMenu={(e) => {
              e.preventDefault()
              onSettings()
            }}
          >
            نمای کلی مالی
          </h1>
          <p>{subtitle}</p>
        </div>
        <div className="home-head-icons">
          <CloudLamp />
          <SettingsButton />
          <button
            className="icon-btn"
            type="button"
            title="اعلان‌ها"
            onClick={() => setToast('اعلانی نیست')}
            onContextMenu={(e) => {
              e.preventDefault()
              onSettings()
            }}
          >
            🔔
          </button>
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
