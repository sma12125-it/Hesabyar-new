import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useExtras } from '../store/Extras'
import { getCurrentTheme, applyTheme, THEMES, type ThemeId } from '../lib/theme'
import { displayNameOf } from '../lib/profile'

export function MobileDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const { userProfile, activePlanId } = useExtras()
  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => getCurrentTheme())
  const isDark = THEMES.find((t) => t.id === currentTheme)?.isDark ?? true

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    const handleClose = () => setIsOpen(false)
    window.addEventListener('hy:open-drawer', handleOpen)
    window.addEventListener('hy:close-drawer', handleClose)
    return () => {
      window.removeEventListener('hy:open-drawer', handleOpen)
      window.removeEventListener('hy:close-drawer', handleClose)
    }
  }, [])

  const toggleTheme = () => {
    const next: ThemeId = isDark ? 'glass' : 'dark-obsidian'
    applyTheme(next)
    setCurrentThemeState(next)
  }

  const userDisplayName = userProfile ? displayNameOf(userProfile) : 'کاربر حسابیار'
  const userHandle = userProfile?.handle ? `@${userProfile.handle}` : '@hesabyar'
  const planLabel = activePlanId === 'vip' ? '🌟 پلن طلایی VIP' : activePlanId === 'bronze' ? '🥉 پلن برنزی' : '🟢 نسخه رایگان پایه'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-backdrop${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
      />

      {/* Drawer Panel */}
      <aside
        className={`drawer-panel${isOpen ? ' is-open' : ''}`}
        aria-label="منوی سایدبار موبایل"
      >
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>💰</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--hy-text)' }}>حسابیار</div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>مدیریت هوشمند مالی</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setIsOpen(false)}
            aria-label="بستن منو"
            style={{ width: 34, height: 34, borderRadius: 10 }}
          >
            ✕
          </button>
        </div>

        {/* Profile Card */}
        <NavLink
          to="/profile"
          onClick={() => setIsOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(15, 118, 110, 0.16))',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textDecoration: 'none',
            color: 'inherit',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'var(--hy-accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            {userDisplayName.charAt(0) || '👤'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userDisplayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
              {userHandle}
            </div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 6,
                background: 'rgba(234, 179, 8, 0.2)',
                color: '#eab308',
              }}
            >
              {planLabel}
            </span>
          </div>
          <span style={{ fontSize: 14, opacity: 0.6 }}>‹</span>
        </NavLink>

        {/* Navigation Links */}
        <nav style={{ flex: 1 }}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>🏠</span>
            <span>خانه و داشبورد</span>
          </NavLink>

          <NavLink
            to="/accounts"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>💳</span>
            <span>حساب‌ها و کارت‌ها</span>
          </NavLink>

          <NavLink
            to="/installments"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>📅</span>
            <span>اقساط، وام و چک</span>
          </NavLink>

          <NavLink
            to="/dong"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>👥</span>
            <span>محاسبه دونگ و سفر</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>📊</span>
            <span>بودجه‌بندی و اهداف</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>👤</span>
            <span>پروفایل و اشتراک نرم‌افزار</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span>⚙️</span>
            <span>تنظیمات و پشتیبان‌گیری</span>
          </NavLink>
        </nav>

        {/* Footer Quick Controls */}
        <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="cat-mini"
            onClick={toggleTheme}
            style={{ width: '100%', justifyContent: 'center', height: 38 }}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'تغییر به تم شیشه‌ای روشن' : 'تغییر به تم تیره'}</span>
          </button>

          <NavLink
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="cat-mini"
            style={{ width: '100%', justifyContent: 'center', height: 38, textDecoration: 'none' }}
          >
            <span>🔄</span>
            <span>بررسی به‌روزرسانی نرم‌افزار</span>
          </NavLink>

          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
            حسابیار · نسخه ۰.۳.۰
          </div>
        </div>
      </aside>
    </>
  )
}
