import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getCurrentTheme, applyTheme, THEMES, type ThemeId } from '../lib/theme'
import { ActionMenuModal, type ActionMenuItem } from './ActionMenuModal'

interface TabBarProps {
  compact?: boolean
  onQuickEntry: () => void
  onVoiceEntry?: () => void
  onInstallmentEntry?: () => void
  onChequeEntry?: () => void
  onDebtEntry?: () => void
  onDongEntry?: () => void
}

export function TabBar({
  onQuickEntry,
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

  const actionMenuItems: ActionMenuItem[] = [
    {
      id: 'tx',
      title: 'تراکنش جدید (درآمد / هزینه)',
      desc: 'ثبت سریع درآمد، مخارج روزمره و واریزی‌ها',
      icon: '💸',
      color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      badge: 'پراستفاده',
      onClick: onQuickEntry,
    },
    {
      id: 'voice',
      title: 'ورود صوتی هوشمند تراکنش',
      desc: 'ثبت خودکار با گفتار زنده میکروفن مانند دستیار هوشمند',
      icon: '🎙️',
      color: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
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
      id: 'installment',
      title: 'قسط و وام جدید',
      desc: 'افزودن وام بانکی، اقساط ثابت یا متغیر با سررسید',
      icon: '📅',
      color: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
      desc: 'ثبت قرض، قرض‌دادن و طلب شخصی از اشخاص',
      icon: '🤝',
      color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
      desc: 'ثبت چک دریافتی یا صادره همراه با یادآوری سررسید',
      icon: '🧾',
      color: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
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
      desc: 'ایجاد رویداد گروهی جدید، مادرخرج و محاسبه تقسیم دُنگ',
      icon: '👥',
      color: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
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
          onClick={() => setIsActionMenuOpen(true)}
          title="ثبت سریع و منوی افزودن (+)"
        >
          <span className="desk-action-icon">＋</span>
          {!isCollapsed && <span className="desk-action-label">ثبت جدید (+)</span>}
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
          onClick={() => setIsActionMenuOpen(true)}
          title="منوی ثبت جدید (+)"
          aria-label="منوی ثبت جدید"
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

      {/* مودال گرافیکی جذاب اکشن‌منوی ثبت چندگانه */}
      <ActionMenuModal
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        items={actionMenuItems}
      />
    </>
  )
}
