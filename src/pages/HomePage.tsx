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
  onAll: () => void
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
      <HomeDashboard onAll={onAll} />
    </div>
  )
}
