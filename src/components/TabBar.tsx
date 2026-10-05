import { NavLink, useLocation } from 'react-router-dom'

export function TabBar({ compact, onQuickEntry }: { compact?: boolean; onQuickEntry: () => void }) {
  const { pathname } = useLocation()
  const accountsActive = pathname.startsWith('/accounts')
  const installmentsActive = pathname.startsWith('/installments')
  const reportsActive = pathname.startsWith('/reports')

  return (
    <nav className={`tab-bar${compact ? ' compact' : ''}`} aria-label="ناوبری اصلی">
      <div className="desk-brand">حساب‌یار</div>

      {/* 1. Home */}
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="ico">🏠</span>
        <span className="lbl">خانه</span>
      </NavLink>

      {/* 2. Accounts */}
      <NavLink to="/accounts" className={() => `tab${accountsActive ? ' active' : ''}`}>
        <span className="ico">💳</span>
        <span className="lbl">حساب‌ها</span>
      </NavLink>

      {/* 3. Center Action Button: Register/Add - Enlarge & Prominent (Request 14) */}
      <button
        className="tab tab-center-action"
        type="button"
        onClick={onQuickEntry}
        title="ثبت تراکنش جدید"
        aria-label="ثبت تراکنش جدید"
      >
        <span className="center-action-circle">＋</span>
        <span className="lbl">ثبت</span>
      </button>

      {/* 4. Installments & Loans */}
      <NavLink to="/installments" className={() => `tab${installmentsActive ? ' active' : ''}`}>
        <span className="ico">📅</span>
        <span className="lbl">اقساط</span>
      </NavLink>

      {/* 5. Budget (Renamed from Reports - Request 13) */}
      <NavLink to="/reports" className={() => `tab${reportsActive ? ' active' : ''}`}>
        <span className="ico">📊</span>
        <span className="lbl">بودجه</span>
      </NavLink>
    </nav>
  )
}
