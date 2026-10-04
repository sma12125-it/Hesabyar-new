import { useEffect, useState } from 'react'
import {
  getSupabaseSettings,
  saveCustomSupabaseSettings,
  resetToDefaultSupabaseSettings,
  testSupabaseConnection,
} from '../lib/supabaseClient'
import { notifyUser } from '../lib/sync'
import { WindowPopup } from './WindowPopup'

export function SupabaseConfigSheet({
  onClose,
  onMinimize,
}: {
  onClose: () => void
  onMinimize?: () => void
}) {
  const [settings, setSettings] = useState(getSupabaseSettings())
  const [url, setUrl] = useState(settings.url)
  const [anonKey, setAnonKey] = useState(settings.anonKey)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const onCfgChanged = () => {
      const s = getSupabaseSettings()
      setSettings(s)
      setUrl(s.url)
      setAnonKey(s.anonKey)
    }
    window.addEventListener('hy-supabase-config-changed', onCfgChanged)
    return () => window.removeEventListener('hy-supabase-config-changed', onCfgChanged)
  }, [])

  async function handleTest() {
    setTesting(true)
    setStatusMsg(null)
    const res = await testSupabaseConnection(url, anonKey)
    setTesting(false)
    setStatusMsg({ ok: res.success, text: res.message })
  }

  async function handleSave() {
    setSaving(true)
    setStatusMsg(null)
    try {
      saveCustomSupabaseSettings(url, anonKey)
      notifyUser('تنظیمات اتصال Supabase با موفقیت ذخیره شد.')
      setStatusMsg({ ok: true, text: 'تنظیمات ذخیره شد و ارتباط برقرار است.' })
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setStatusMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (confirm('آیا مایلید تنظیمات اتصال به دیتابیس پیش‌فرض بازگردانی شود؟')) {
      resetToDefaultSupabaseSettings()
      const def = getSupabaseSettings()
      setUrl(def.url)
      setAnonKey(def.anonKey)
      setStatusMsg({ ok: true, text: 'تنظیمات پیش‌فرض بازگردانی شد.' })
      notifyUser('تنظیمات دیتابیس ریست شد')
    }
  }

  return (
    <WindowPopup
      title="اتصال اختصاصی دیتابیس Supabase"
      subtitle="دیتابیس آنلاین شخصی خود را بدون کدنویسی به حساب‌یار متصل کنید"
      icon="⚡"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={560}
      defaultHeight={680}
    >
      <div className="sheet-body-scroll" style={{ paddingBottom: 24 }}>
          {/* Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '12px',
              background: settings.isCustom ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              border: settings.isCustom ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: settings.isCustom ? '#10b981' : '#3b82f6',
                  boxShadow: settings.isCustom ? '0 0 8px #10b981' : 'none',
                }}
              />
              <span style={{ fontWeight: 600 }}>
                {settings.isCustom ? 'دیتابیس شخصی فعال است' : 'استفاده از سرور ابری پیش‌فرض'}
              </span>
            </div>
            {settings.isCustom ? (
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                بازنشانی به پیش‌فرض
              </button>
            ) : null}
          </div>

          {statusMsg ? (
            <div
              className={`banner ${statusMsg.ok ? 'success' : 'error'}`}
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: '10px',
                background: statusMsg.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: statusMsg.ok ? '#065f46' : '#991b1b',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{statusMsg.ok ? '✓' : '⚠️'}</span>
              <span>{statusMsg.text}</span>
            </div>
          ) : null}

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 6, color: 'var(--hy-text)' }}>
                آدرس پروژه در Supabase (Project URL):
              </label>
              <input
                className="field-input"
                dir="ltr"
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--hy-muted)', marginTop: 4, display: 'block' }}>
                از مسیر Settings &gt; API &gt; Project URL در پنل Supabase
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 6, color: 'var(--hy-text)' }}>
                کلید عمومی دسترسی (Anon / Public Key):
              </label>
              <textarea
                className="field-input"
                dir="ltr"
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--hy-muted)', marginTop: 4, display: 'block' }}>
                از مسیر Settings &gt; API &gt; Project API keys &gt; anon public
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="home-pill ghost"
                type="button"
                disabled={testing || !url.trim() || !anonKey.trim()}
                onClick={() => void handleTest()}
                style={{ flex: 1, justifyContent: 'center', height: 42, fontSize: '13px' }}
              >
                {testing ? 'در حال آزمودن…' : '🔍 تست ارتباط'}
              </button>

              <button
                className="cta-confirm"
                type="button"
                disabled={saving || !url.trim() || !anonKey.trim()}
                onClick={() => void handleSave()}
                style={{ flex: 1.2, height: 42, fontSize: '13px' }}
              >
                {saving ? 'در حال ذخیره…' : '💾 ذخیره و اتصال'}
              </button>
            </div>
          </div>

          {/* Guide Tips */}
          <div
            style={{
              marginTop: 24,
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '11px',
              color: 'var(--hy-subtext)',
              lineHeight: 1.7,
            }}
          >
            <strong style={{ display: 'block', color: 'var(--hy-text)', marginBottom: 4, fontSize: '12px' }}>
              💡 نکته امنیتی:
            </strong>
            کلیدهای وارد شده صرفاً در حافظه امن محلی مرورگر (Local Storage) شما نگهداری می‌شوند و هرگز در هیچ سرور واسطی ذخیره نخواهند شد.
          </div>
        </div>
      </WindowPopup>
    )
  }
