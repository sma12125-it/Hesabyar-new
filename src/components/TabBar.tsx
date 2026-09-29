import { NavLink, useLocation } from 'react-router-dom'

export function TabBar({ compact, onQuickEntry }: { compact?: boolean; onQuickEntry: () => void }) {
  const { pathname } = useLocation()
  const accountsActive = pathname.startsWith('/accounts')
  const installmentsActive = pathname.startsWith('/installments')

  return (
    <nav className={`tab-bar${compact ? ' compact' : ''}`} aria-label="ناوبری اصلی">
      <div className="desk-brand">حساب‌یار</div>
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="ico">🏠</span>
        <span className="lbl">خانه</span>
      </NavLink>
      <button className="tab" type="button" onClick={onQuickEntry}>
        <span className="ico">＋</span>
        <span className="lbl">ثبت</span>
      </button>
      <NavLink to="/accounts" className={() => `tab${accountsActive ? ' active' : ''}`}>
        <span className="ico">💳</span>
        <span className="lbl">حساب‌ها</span>
      </NavLink>
      <NavLink to="/installments" className={() => `tab${installmentsActive ? ' active' : ''}`}>
        <span className="ico">📅</span>
        <span className="lbl">اقساط</span>
      </NavLink>
      <NavLink to="/reports" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="ico">📈</span>
        <span className="lbl">گزارش</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `tab tab-settings${isActive ? ' active' : ''}`}>
        <span className="ico">⚙</span>
        <span className="lbl">تنظیمات</span>
      </NavLink>
    </nav>
  )
}
