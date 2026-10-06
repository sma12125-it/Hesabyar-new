import { NavLink } from 'react-router-dom'

export function SettingsButton({ showLabel }: { showLabel?: boolean }) {
  return (
    <NavLink
      to="/settings"
      className="icon-btn settings-inline"
      aria-label="تنظیمات"
      title="تنظیمات برنامه"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        textDecoration: 'none',
        flexShrink: 0,
        width: showLabel ? 'auto' : 40,
        height: 40,
        padding: showLabel ? '0 14px' : undefined,
        borderRadius: showLabel ? 14 : '50%',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>⚙</span>
      {showLabel ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text)' }}>تنظیمات</span>
      ) : null}
    </NavLink>
  )
}

