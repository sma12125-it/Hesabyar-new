import { useNavigate } from 'react-router-dom'

export function SettingsButton({ showLabel }: { showLabel?: boolean }) {
  const navigate = useNavigate()

  const handleClick = (e: React.MouseEvent) => {
    if (window.innerWidth < 900) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('hy:open-drawer'))
    } else {
      navigate('/settings')
    }
  }

  return (
    <button
      type="button"
      className="icon-btn settings-inline mobile-menu-btn"
      aria-label="منوی برنامه و تنظیمات"
      title="منوی برنامه و تنظیمات"
      onClick={handleClick}
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
        border: 'none',
        background: 'var(--hy-input-bg, rgba(255, 255, 255, 0.08))',
      }}
    >
      <span className="mobile-only-icon" style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
      <span className="desktop-only-icon" style={{ fontSize: 18, lineHeight: 1 }}>⚙</span>
      {showLabel ? (
        <span className="desktop-only-icon" style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text)' }}>تنظیمات</span>
      ) : null}
    </button>
  )
}

