import { useState, useEffect } from 'react'
import { THEMES, getCurrentTheme, applyTheme, type ThemeId } from '../lib/theme'
import { notifyUser } from '../lib/sync'

export function ThemeGallery() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => getCurrentTheme())

  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: ThemeId }>
      if (custom.detail?.theme) {
        setActiveTheme(custom.detail.theme)
      }
    }
    window.addEventListener('hy-theme-change', onThemeChange)
    return () => window.removeEventListener('hy-theme-change', onThemeChange)
  }, [])

  const handleSelect = (id: ThemeId, name: string) => {
    setActiveTheme(id)
    applyTheme(id)
    notifyUser(`تم «${name}» فعال شد`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
      {THEMES.map((theme) => {
        const isSelected = activeTheme === theme.id
        const p = theme.preview

        return (
          <div
            key={theme.id}
            onClick={() => handleSelect(theme.id, theme.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleSelect(theme.id, theme.name)
              }
            }}
            className={`theme-item-card${isSelected ? ' is-selected' : ''}`}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Top row: Icon, Name, Badge, Radio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{theme.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{theme.name}</span>
                    {theme.badge ? (
                      <span
                        className="theme-badge"
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: isSelected ? 'var(--hy-accent)' : 'rgba(125, 125, 125, 0.2)',
                          color: isSelected ? '#ffffff' : 'var(--hy-text)',
                          fontWeight: 700,
                        }}
                      >
                        {theme.badge}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                    {theme.subtitle}
                  </div>
                </div>
              </div>

              {/* Selection Indicator */}
              <div
                className="theme-radio-dot"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 900,
                  flexShrink: 0,
                  transition: 'all 0.18s ease',
                }}
              >
                {isSelected ? '✓' : ''}
              </div>
            </div>

            {/* Visual Mini Preview Bar (Canvas, Card, Border, Accent button) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 10,
                background: p.bg,
                border: `1px solid ${p.border}`,
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: p.text,
                  opacity: 0.9,
                  marginRight: 4,
                }}
              >
                پیش‌نمایش رنگ:
              </div>

              {/* Card swatch */}
              <div
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: p.card,
                  border: `1px solid ${p.border}`,
                  color: p.text,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                کارت
              </div>

              {/* Accent swatch */}
              <div
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: p.accent,
                  color: theme.id === 'emerald-gold' ? '#041a12' : theme.id === 'neobrutal' ? '#ffffff' : '#ffffff',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                دکمه
              </div>

              {/* Tag indicator */}
              <div
                style={{
                  fontSize: 9,
                  marginRight: 'auto',
                  color: p.text,
                  opacity: 0.7,
                }}
              >
                {theme.isDark ? '🌙 حالت شب' : '☀️ حالت روز'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
