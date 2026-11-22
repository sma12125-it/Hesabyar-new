import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getCurrentTheme, applyTheme, THEMES, type ThemeId } from '../lib/theme'
import { ActionMenuModal, type ActionMenuItem } from './ActionMenuModal'

interface TabBarProps {
  compact?: boolean
  onQuickEntry: () => void
  onQuickCards?: () => void
  onVoiceEntry?: () => void
  onInstallmentEntry?: () => void
  onChequeEntry?: () => void
  onDebtEntry?: () => void
  onDongEntry?: () => void
}

export function TabBar({
  onQuickEntry,
  onQuickCards,
  onVoiceEntry,
  onInstallmentEntry,
  onChequeEntry,
  onDebtEntry,
  onDongEntry,
}: TabBarProps) {
  const { pathname } = useLocation()
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const accountsActive = pathname.startsWith('/accounts')
  const installmentsActive = pathname.startsWith('/installments')
  const dongActive = pathname.startsWith('/dong')
  const reportsActive = pathname.startsWith('/reports')
  const settingsActive = pathname.startsWith('/settings')
  const profileActive = pathname.startsWith('/profile')

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hy_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => getCurrentTheme())
  const isDark = THEMES.find((t) => t.id === currentTheme)?.isDark ?? true

  const actionMenuItems: ActionMenuItem[] = [
    {
      id: 'quick-cards',
      title: 'کیف کارت و حساب سریع',
      desc: 'مشاهده سریع کارت‌ها، کپی انتخابی و اشتراک اطلاعات کارت',
      icon: '💳',
      color: '#14b8a6',
      badge: 'Alt+C',
      onClick: () => {
        if (onQuickCards) {
          onQuickCards()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-quick-cards'))
        }
      },
    },
    {
      id: 'voice',
      title: 'ثبت صوتی تراکنش',
      desc: 'ثبت درآمد یا هزینه با صدای شما و تشخیص هوشمند',
      icon: '🎙️',
      color: '#8b5cf6',
      badge: 'هوشمند',
      onClick: () => {
        if (onVoiceEntry) {
          onVoiceEntry()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-voice-sheet'))
        }
      },
    },
    {
      id: 'tx',
      title: 'تراکنش جدید (درآمد / هزینه)',
      desc: 'ثبت مخارج روزمره، خرید، واریز و دریافتی‌ها',
      icon: '💸',
      color: '#10b981',
      onClick: onQuickEntry,
    },
    {
      id: 'installment',
      title: 'قسط و وام جدید',
      desc: 'تعریف وام بانکی یا اقساط دوره‌ای با سررسید ماهانه',
      icon: '🗓️',
      color: '#f59e0b',
      onClick: () => {
        if (onInstallmentEntry) {
          onInstallmentEntry()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-installment-sheet'))
        }
      },
    },
    {
      id: 'debt',
      title: 'بدهی و طلب جدید',
      desc: 'ثبت حساب‌کتاب شخصی، قرض و طلب از افراد',
      icon: '🤝',
      color: '#ec4899',
      onClick: () => {
        if (onDebtEntry) {
          onDebtEntry()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-debt-sheet'))
        }
      },
    },
    {
      id: 'cheque',
      title: 'چک جدید (صیادی / عادی)',
      desc: 'ثبت چک دریافتی یا پرداختی همراه با تاریخ سررسید',
      icon: '🧾',
      color: '#0ea5e9',
      onClick: () => {
        if (onChequeEntry) {
          onChequeEntry()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-cheque-sheet'))
        }
      },
    },
    {
      id: 'dong',
      title: 'دونگ و سفر جدید',
      desc: 'ساخت رویداد گروهی، تعیین مادرخرج و محاسبه سهم اعضا',
      icon: '👥',
      color: '#6366f1',
      onClick: () => {
        if (onDongEntry) {
          onDongEntry()
        } else {
          window.dispatchEvent(new CustomEvent('hy:open-create-dong'))
        }
      },
    },
  ]

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
      {/* 1. نوار ناوبری کنار در دسکتاپ */}
      <aside
        className={`desktop-sidebar${isCollapsed ? ' is-collapsed' : ''}`}
        aria-label="منوی ناوبری دسکتاپ حسابیار"
      >
        <div className="desk-nav-header">
          <button
            type="button"
            className="desk-hamburger-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'گسترش منوی ناوبری' : 'جمع کردن منو'}
            aria-label="تغییر وضعیت منو"
          >
            ☰
          </button>

          {!isCollapsed && (
            <div className="desk-brand-info">
              <span className="desk-brand-logo">💰</span>
              <div className="desk-brand-text">
                <span className="desk-brand-title">حساب‌یار</span>
                <span className="desk-brand-sub">مدیریت مالی شخصی</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="desk-action-btn"
          onClick={() => setIsActionMenuOpen(true)}
          title="ثبت سریع و منوی افزودن"
        >
          <span className="desk-action-icon">＋</span>
          {!isCollapsed && <span className="desk-action-label">ثبت جدید</span>}
        </button>

        <button
          type="button"
          className="desk-action-btn"
          style={{
            background: 'rgba(20, 184, 166, 0.14)',
            color: 'var(--hy-teal)',
            border: '1px solid rgba(20, 184, 166, 0.35)',
            boxShadow: 'none',
            marginTop: -6,
            marginBottom: 14,
            height: 40,
          }}
          onClick={() => {
            if (onQuickCards) {
              onQuickCards()
            } else {
              window.dispatchEvent(new CustomEvent('hy:open-quick-cards'))
            }
          }}
          title="کیف کارت سریع (Alt+C)"
        >
          <span className="desk-action-icon">💳</span>
          {!isCollapsed && <span className="desk-action-label">کیف کارت سریع</span>}
        </button>

        <nav className="desk-nav-links">
          <NavLink
            to="/profile"
            className={() => `desk-nav-item${profileActive ? ' active' : ''}`}
            title="پروفایل و شناسه اختصاصی"
          >
            <span className="desk-nav-icon">👤</span>
            {!isCollapsed && <span className="desk-nav-label">پروفایل و شناسه</span>}
          </NavLink>

          <NavLink
            to="/"
            end
            className={({ isActive }) => `desk-nav-item${isActive ? ' active' : ''}`}
            title="داشبورد و گزارش خانه"
          >
            <span className="desk-nav-icon">🏠</span>
            {!isCollapsed && <span className="desk-nav-label">خانه و داشبورد</span>}
          </NavLink>

          <NavLink
            to="/accounts"
            className={() => `desk-nav-item${accountsActive ? ' active' : ''}`}
            title="حساب‌های بانکی و کارت‌ها"
          >
            <span className="desk-nav-icon">🏦</span>
            {!isCollapsed && <span className="desk-nav-label">حساب‌ها و کارت‌ها</span>}
          </NavLink>

          <NavLink
            to="/installments"
            className={() => `desk-nav-item${installmentsActive ? ' active' : ''}`}
            title="مدیریت اقساط، چک‌ها و بدهی‌ها"
          >
            <span className="desk-nav-icon">🗓️</span>
            {!isCollapsed && <span className="desk-nav-label">اقساط، وام و چک</span>}
          </NavLink>

          <NavLink
            to="/dong"
            className={() => `desk-nav-item${dongActive ? ' active' : ''}`}
            title="محاسبه دونگ و هزینه‌های گروهی"
          >
            <span className="desk-nav-icon">👥</span>
            {!isCollapsed && <span className="desk-nav-label">محاسبه دونگ</span>}
          </NavLink>

          <NavLink
            to="/reports"
            className={() => `desk-nav-item${reportsActive ? ' active' : ''}`}
            title="بودجه‌بندی ماهانه و اهداف پس‌انداز"
          >
            <span className="desk-nav-icon">📊</span>
            {!isCollapsed && <span className="desk-nav-label">بودجه و اهداف</span>}
          </NavLink>

          <NavLink
            to="/settings"
            className={() => `desk-nav-item${settingsActive ? ' active' : ''}`}
            title="تنظیمات، پشتیبان‌گیری و تم"
          >
            <span className="desk-nav-icon">⚙️</span>
            {!isCollapsed && <span className="desk-nav-label">تنظیمات و پشتیبان</span>}
          </NavLink>
        </nav>

        <div className="desk-nav-footer">
          <button
            type="button"
            className="desk-theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'تغییر به نمای روشن' : 'تغییر به نمای تیره'}
          >
            <span className="desk-nav-icon">{isDark ? '☀️' : '🌙'}</span>
            {!isCollapsed && (
              <span className="desk-nav-label">
                {isDark ? 'نمای روشن' : 'نمای تیره'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* 2. نوار پایین موبایل */}
      <nav className="tab-bar mobile-tab-bar" aria-label="ناوبری اصلی">
        <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">🏠</span>
          <span className="lbl">خانه</span>
        </NavLink>

        <NavLink to="/accounts" className={() => `tab${accountsActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">🏦</span>
          <span className="lbl">حساب‌ها</span>
        </NavLink>

        <button
          className="tab tab-center-action"
          type="button"
          onClick={() => setIsActionMenuOpen(true)}
          title="منوی افزودن"
          aria-label="منوی افزودن"
        >
          <span className="center-action-circle" aria-hidden="true">＋</span>
          <span className="lbl">ثبت</span>
        </button>

        <NavLink to="/installments" className={() => `tab${installmentsActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">🗓️</span>
          <span className="lbl">اقساط</span>
        </NavLink>

        <NavLink to="/dong" className={() => `tab${dongActive ? ' active' : ''}`}>
          <span className="ico" aria-hidden="true">👥</span>
          <span className="lbl">دونگ</span>
        </NavLink>
      </nav>

      <ActionMenuModal
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        items={actionMenuItems}
      />
    </>
  )
}
