import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getCurrentTheme, applyTheme, THEMES, type ThemeId } from '../lib/theme'

interface TabBarProps {
  compact?: boolean
  onQuickEntry: () => void
}

export function TabBar({ onQuickEntry }: TabBarProps) {
  const { pathname } = useLocation()
  const accountsActive = pathname.startsWith('/accounts')
  const installmentsActive = pathname.startsWith('/installments')
  const dongActive = pathname.startsWith('/dong')
  const reportsActive = pathname.startsWith('/reports')
  const settingsActive = pathname.startsWith('/settings')
  const profileActive = pathname.startsWith('/profile')

  // وضعیت باز یا بسته بودن ناوبری همبرگری دسکتاپ در سمت راست
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hy_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => getCurrentTheme())
  const isDark = THEMES.find((t) => t.id === currentTheme)?.isDark ?? true

  useEffect(() => {
    try {
      localStorage.setItem('hy_sidebar_collapsed', String(isCollapsed))
    } catch {}
    document.documentElement.style.setProperty('--desktop-nav-w', isCollapsed ? '76px' : '240px')
  }, [isCollapsed])

  const toggleTheme = () => {
    const next: ThemeId = isDark ? 'glass' : 'dark-obsidian'
    applyTheme(next)
    setCurrentThemeState(next)
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          ۱. نسخه ناوبری دسکتاپ: منوی کناری سمت راست (RTL) همراه با دکمه همبرگری
          ───────────────────────────────────────────────────────────── */}
      <aside
        className={`desktop-sidebar${isCollapsed ? ' is-collapsed' : ''}`}
        aria-label="منوی ناوبری دسکتاپ حسابیار"
      >
        {/* هدر سایدبار با لوگو و دکمه همبرگری */}
        <div className="desk-nav-header">
          <button
            type="button"
            className="desk-hamburger-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'گسترش منوی ناوبری' : 'جمع کردن منو'}
            aria-label="تغییر وضعیت منوی همبرگری"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {!isCollapsed && (
            <div className="desk-brand-info">
              <div className="desk-brand-logo">💰</div>
              <div className="desk-brand-text">
                <span className="desk-brand-title">حسابیار</span>
                <span className="desk-brand-sub">مدیریت هوشمند مالی</span>
              </div>
            </div>
          )}
        </div>

        {/* دکمه برجسته ثبت تراکنش جدید در دسکتاپ */}
        <button
          type="button"
          className="desk-action-btn"
          onClick={onQuickEntry}
          title="ثبت تراکنش جدید (+)"
        >
          <span className="desk-action-icon">＋</span>
          {!isCollapsed && <span className="desk-action-label">ثبت تراکنش جدید</span>}
        </button>

        {/* پیوندهای ناوبری اصلی */}
        <nav className="desk-nav-links">
          {/* ۱. پروفایل و شناسه کاربری (اولین گزینه بعد از ثبت تراکنش) */}
          <NavLink
            to="/profile"
            className={() => `desk-nav-item${profileActive ? ' active' : ''}`}
            title="پروفایل و شناسه اختصاصی"
          >
            <span className="desk-nav-icon">👤</span>
            {!isCollapsed && <span className="desk-nav-label">پروفایل و شناسه</span>}
          </NavLink>

          {/* ۲. خانه و داشبورد */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => `desk-nav-item${isActive ? ' active' : ''}`}
            title="داشبورد و گزارش خانه"
          >
            <span className="desk-nav-icon">🏠</span>
            {!isCollapsed && <span className="desk-nav-label">خانه و داشبورد</span>}
          </NavLink>

          {/* ۳. حساب‌ها و کارت‌ها */}
          <NavLink
            to="/accounts"
            className={() => `desk-nav-item${accountsActive ? ' active' : ''}`}
            title="حساب‌های بانکی و کارت‌ها"
          >
            <span className="desk-nav-icon">💳</span>
            {!isCollapsed && <span className="desk-nav-label">حساب‌ها و کارت‌ها</span>}
          </NavLink>

          {/* ۴. اقساط و وام‌ها */}
          <NavLink
            to="/installments"
            className={() => `desk-nav-item${installmentsActive ? ' active' : ''}`}
            title="مدیریت اقساط، چک‌ها و بدهی‌ها"
          >
            <span className="desk-nav-icon">📅</span>
            {!isCollapsed && <span className="desk-nav-label">اقساط، وام و چک</span>}
          </NavLink>

          {/* ۵. دونگ و سفر */}
          <NavLink
            to="/dong"
            className={() => `desk-nav-item${dongActive ? ' active' : ''}`}
            title="محاسبه دونگ و هزینه‌های گروهی"
          >
            <span className="desk-nav-icon">👥</span>
            {!isCollapsed && <span className="desk-nav-label">محاسبه دونگ</span>}
          </NavLink>

          {/* ۶. بودجه‌بندی و اهداف */}
          <NavLink
            to="/reports"
            className={() => `desk-nav-item${reportsActive ? ' active' : ''}`}
            title="بودجه‌بندی ماهانه و اهداف پس‌انداز"
          >
            <span className="desk-nav-icon">📊</span>
            {!isCollapsed && <span className="desk-nav-label">بودجه و اهداف</span>}
          </NavLink>

          {/* ۷. تنظیمات */}
          <NavLink
            to="/settings"
            className={() => `desk-nav-item${settingsActive ? ' active' : ''}`}
            title="تنظیمات، پشتیبان‌گیری و تم"
          >
            <span className="desk-nav-icon">⚙️</span>
            {!isCollapsed && <span className="desk-nav-label">تنظیمات و پشتیبان</span>}
          </NavLink>
        </nav>

        {/* فوتر سایدبار با ابزارهای سریع */}
        <div className="desk-nav-footer">
          <button
            type="button"
            className="desk-theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'تغییر به تم شیشه‌ای روشن' : 'تغییر به تم تیره'}
          >
            <span className="desk-nav-icon">{isDark ? '☀️' : '🌙'}</span>
            {!isCollapsed && (
              <span className="desk-nav-label">
                {isDark ? 'تم شیشه‌ای روشن' : 'تم تیره تخصصی'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          ۲. نسخه ناوبری موبایل: نوار استاندارد و باثبات پایین صفحه
          ترتیب دقیق درخواستی: خانه، حساب‌ها، ثبت (وسط)، اقساط، دونگ
          ───────────────────────────────────────────────────────────── */}
      <nav className="tab-bar mobile-tab-bar" aria-label="ناوبری اصلی">
        {/* ۱. خانه */}
        <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">🏠</span>
          <span className="lbl">خانه</span>
        </NavLink>

        {/* ۲. حساب‌ها */}
        <NavLink to="/accounts" className={() => `tab${accountsActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">💳</span>
          <span className="lbl">حساب‌ها</span>
        </NavLink>

        {/* ۳. دکمه گرد ثبت وسط */}
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

        {/* ۴. اقساط */}
        <NavLink to="/installments" className={() => `tab${installmentsActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">📅</span>
          <span className="lbl">اقساط</span>
        </NavLink>

        {/* ۵. دونگ */}
        <NavLink to="/dong" className={() => `tab${dongActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">👥</span>
          <span className="lbl">دونگ</span>
        </NavLink>
      </nav>
    </>
  )
}
