import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useExtras } from '../store/Extras'
import { displayNameOf } from '../lib/profile'
import { logoutCompletely } from '../lib/account'

export function MobileDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const { userProfile, activePlanId } = useExtras()

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

  const userDisplayName = userProfile ? displayNameOf(userProfile) : 'کاربر حساب‌یار'
  const userHandle = userProfile?.handle ? `@${userProfile.handle}` : '@hesabyar'
  const planLabel = activePlanId === 'vip' ? 'پلن VIP' : activePlanId === 'bronze' ? 'پلن برنزی' : 'نسخه پایه'

  return (
    <>
      <div
        className={`drawer-backdrop${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
      />

      <aside
        className={`drawer-panel${isOpen ? ' is-open' : ''}`}
        aria-label="منوی سایدبار موبایل"
      >
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>💰</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--hy-text)' }}>حساب‌یار</div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>مدیریت مالی شخصی</div>
            </div>
          </div>
          <button
            type="button"
            className="action-menu-close"
            onClick={() => setIsOpen(false)}
            aria-label="بستن منو"
          >
            ✕
          </button>
        </div>

        <NavLink
          to="/profile"
          onClick={() => setIsOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--hy-input-bg)',
            border: '1px solid var(--hy-border-color)',
            textDecoration: 'none',
            color: 'inherit',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--hy-teal)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 17,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {userProfile?.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt={userDisplayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              userDisplayName.charAt(0) || '👤'
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userDisplayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }} dir="ltr">
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
                background: 'color-mix(in srgb, var(--hy-teal) 16%, transparent)',
                color: 'var(--hy-teal)',
              }}
            >
              {planLabel}
            </span>
          </div>
          <span style={{ fontSize: 18, opacity: 0.6 }}>‹</span>
        </NavLink>

        <nav style={{ flex: 1 }}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>🏠</span>
            <span>خانه و داشبورد</span>
          </NavLink>

          <NavLink
            to="/accounts"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>🏦</span>
            <span>حساب‌ها و کارت‌ها</span>
          </NavLink>

          <NavLink
            to="/installments"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>🗓️</span>
            <span>اقساط، وام و چک</span>
          </NavLink>

          <NavLink
            to="/dong"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>👥</span>
            <span>محاسبه دونگ و سفر</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>📊</span>
            <span>بودجه‌بندی و اهداف</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `drawer-nav-item${isActive ? ' active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span>تنظیمات</span>
          </NavLink>
        </nav>

        <div style={{ padding: '12px 0 8px', borderTop: '1px solid var(--hy-border-color)' }}>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('آیا می‌خواهید از حساب کاربری خود خارج شوید؟')) {
                setIsOpen(false)
                void logoutCompletely()
              }
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              color: '#f87171',
            }}
          >
            <span>🚪 خروج از حساب کاربری</span>
          </button>
        </div>

        <div style={{ paddingTop: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--hy-text-tertiary)' }}>
            حساب‌یار · دفتر مالی شخصی
          </div>
        </div>
      </aside>
    </>
  )
}
