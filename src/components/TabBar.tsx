import { NavLink, useLocation } from 'react-router-dom'

export function TabBar({ onQuickEntry }: { compact?: boolean; onQuickEntry: () => void }) {
  const { pathname } = useLocation()
  const accountsActive = pathname.startsWith('/accounts')
  const installmentsActive = pathname.startsWith('/installments')
  const reportsActive = pathname.startsWith('/reports')

  return (
    <nav className="tab-bar" aria-label="ناوبری اصلی">
      {/* 1. Home */}
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="ico" aria-hidden="true">🏠</span>
        <span className="lbl">خانه</span>
      </NavLink>

      {/* 2. Accounts */}
      <NavLink to="/accounts" className={() => `tab${accountsActive ? ' active' : ''}`}>
        <span className="ico" aria-hidden="true">💳</span>
        <span className="lbl">حساب‌ها</span>
      </NavLink>

      {/* 3. Center Action Button: Register/Add - Perfect Full Circle with Professional Graphic Design */}
      <button
        className="tab tab-center-action"
        type="button"
        onClick={onQuickEntry}
        title="ثبت تراکنش جدید (+)"
        aria-label="ثبت تراکنش جدید"
      >
        <span className="center-action-circle" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <span className="lbl">ثبت</span>
      </button>

      {/* 4. Installments & Loans */}
      <NavLink to="/installments" className={() => `tab${installmentsActive ? ' active' : ''}`}>
        <span className="ico" aria-hidden="true">📅</span>
        <span className="lbl">اقساط</span>
      </NavLink>

      {/* 5. Budget (Reports) */}
      <NavLink to="/reports" className={() => `tab${reportsActive ? ' active' : ''}`}>
        <span className="ico" aria-hidden="true">📊</span>
        <span className="lbl">بودجه</span>
      </NavLink>
    </nav>
  )
}
