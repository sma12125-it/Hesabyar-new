import { useState } from 'react'
import { loadSession, notifyUser } from '../lib/sync'

export function ChatGPTApiSection({ onOpenCloud }: { onOpenCloud: () => void }) {
  const session = loadSession()
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedOpenApi, setCopiedOpenApi] = useState(false)
  const [copiedMcp, setCopiedMcp] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const apiBaseUrl = `${origin}/api/v1`
  const openApiUrl = `${apiBaseUrl}/openapi.json`
  const mcpUrl = `${apiBaseUrl}/mcp/tools`
  const docsUrl = `${apiBaseUrl}/docs`

  const handleCopy = (text: string, setFn: (val: boolean) => void, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setFn(true)
      notifyUser(`${label} با موفقیت در کلیپ‌بورد کپی شد`)
      setTimeout(() => setFn(false), 2500)
    })
  }

  return (
    <div className="chatgpt-api-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Overview Card */}
      <div className="lg settings-block" style={{ border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(15, 23, 42, 0.65)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '28px' }}>🤖</span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8' }}>
              اتصال حساب شخصی به ChatGPT و پروتکل MCP
            </h2>
            <p className="sheet-sub" style={{ marginTop: 2, fontSize: '11px' }}>
              مدیریت هوشمند حساب‌ها، موجودی بانک‌ها و ثبت تراکنش‌ها از درون چت با هوش مصنوعی
            </p>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 10, border: '1px dashed rgba(56, 189, 248, 0.3)' }}>
          <div style={{ fontSize: '11.5px', color: 'var(--hy-text-primary)', lineHeight: 1.6 }}>
            با اتصال حسابیار به ChatGPT می‌توانید دستورات صوتی یا متنی مانند این‌ها بفرستید:
            <ul style={{ margin: '6px 0 0 0', paddingRight: '18px', color: '#7dd3fc' }}>
              <li>«موجودی حساب بانک ملت من چقدر است؟»</li>
              <li>«یک هزینه ۲ میلیون تومانی بابت خرید پوشاک ثبت کن.»</li>
              <li>«تراکنش‌های این ماه من را نشان بده.»</li>
              <li>«جمع هزینه‌های این ماه من چقدر بوده؟»</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Authentication Status & Bearer Token */}
      <div className="lg settings-block">
        <h3 style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🔑</span>
          <span>احراز هویت و توکن دسترسی (Bearer Token)</span>
        </h3>
        <p className="sheet-sub" style={{ marginTop: 2 }}>
          برای حفظ امنیت کامل، هر کاربر دارای فضای داده کاملاً ایزوله در Supabase است و ChatGPT فقط به اطلاعات خود شما دسترسی خواهد داشت.
        </p>

        {session ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span>
                <span>متصل به حساب ابری: <strong>{session.email}</strong></span>
              </div>
              <span className="badge ok" style={{ fontSize: '10px' }}>احراز شده</span>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', display: 'block', marginBottom: 4 }}>
                توکن امن دسترسی (برای تنظیم در ChatGPT Action یا MCP):
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  readOnly
                  value={session.accessToken}
                  style={{
                    flex: 1,
                    direction: 'ltr',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--hy-input-bg)',
                    border: '1px solid var(--hy-border)',
                    color: 'var(--hy-text-primary)',
                  }}
                />
                <button
                  type="button"
                  className="home-pill"
                  onClick={() => handleCopy(session.accessToken, setCopiedToken, 'توکن دسترسی')}
                  style={{ padding: '0 14px', fontSize: '11.5px', fontWeight: 700 }}
                >
                  {copiedToken ? 'کپی شد ✓' : 'کپی توکن'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: 8, lineHeight: 1.5 }}>
              ⚠️ برای دریافت توکن امن و اتصال هوش مصنوعی، ابتدا باید از بخش همگام‌سازی ابری وارد حساب حسابیار خود شوید.
            </div>
            <button
              type="button"
              className="cta-confirm"
              onClick={onOpenCloud}
              style={{ width: '100%', fontSize: '12px', padding: '8px 0' }}
            >
              ورود یا ثبت‌نام در همگام‌سازی ابری
            </button>
          </div>
        )}
      </div>

      {/* Endpoint Links & Manifests */}
      <div className="lg settings-block">
        <h3 style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🌐</span>
          <span>آدرس سرور و مشخصات اتصال API</span>
        </h3>
        <p className="sheet-sub" style={{ marginTop: 2 }}>
          لینک‌های استاندارد برای وارد کردن مستقیم در Custom GPT یا فایل کانفیگ MCP Server
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {/* Base URL */}
          <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', marginBottom: 2 }}>آدرس ریشه (API Base URL):</div>
            <div style={{ fontFamily: 'monospace', fontSize: '12px', direction: 'ltr', color: '#38bdf8' }}>{apiBaseUrl}</div>
          </div>

          {/* OpenAPI JSON Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700 }}>OpenAPI 3.1.0 Schema</div>
              <div style={{ fontSize: '10px', color: 'var(--hy-text-secondary)' }}>جهت وارد کردن در بخش Actions در ChatGPT Custom GPT</div>
            </div>
            <button
              type="button"
              className="home-pill ghost"
              onClick={() => handleCopy(openApiUrl, setCopiedOpenApi, 'آدرس OpenAPI')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              {copiedOpenApi ? 'کپی شد ✓' : 'کپی لینک'}
            </button>
          </div>

          {/* MCP Tools JSON Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700 }}>MCP Tools Manifest</div>
              <div style={{ fontSize: '10px', color: 'var(--hy-text-secondary)' }}>جهت استفاده در کلاینت‌های پشتیبان MCP (Model Context Protocol)</div>
            </div>
            <button
              type="button"
              className="home-pill ghost"
              onClick={() => handleCopy(mcpUrl, setCopiedMcp, 'آدرس ابزارهای MCP')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              {copiedMcp ? 'کپی شد ✓' : 'کپی لینک'}
            </button>
          </div>

          {/* Web Docs Link */}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px 12px',
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              marginTop: 4,
            }}
          >
            <span>مشاهده صفحه مستندات تعاملی API در مرورگر</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Guide Cards */}
      <div className="lg settings-block">
        <h3 style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📖</span>
          <span>راهنمای گام‌به‌گام اتصال به ChatGPT</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, fontSize: '11.5px', color: 'var(--hy-text-primary)', lineHeight: 1.6 }}>
          <div style={{ padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}>
            <strong>۱. ایجاد Custom GPT در ChatGPT:</strong> در منوی ChatGPT گزینه Explore GPTs و سپس Create را بزنید.
          </div>
          <div style={{ padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}>
            <strong>۲. افزودن اکشن (Action):</strong> در تب Configure، روی دکمه Create new action کلیک کنید و لینک OpenAPI Schema بالا را وارد کنید (یا محتوای json آن را paste کنید).
          </div>
          <div style={{ padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}>
            <strong>۳. تنظیم Authentication:</strong> در بخش احراز هویت اکشن، نوع را <code>Bearer</code> قرار دهید و توکن امن خود را در آن وارد کنید.
          </div>
          <div style={{ padding: '6px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}>
            <strong>۴. تأیید عملیات مالی حساس (Confirmation Flow):</strong> سیستم حسابیار به طور کامل از قابلیت <code>dryRun</code> پشتیبانی می‌کند تا ChatGPT قبل از انتقال وجه یا ثبت هزینه‌های حساس، پیش‌نمایش و موجودی بعد از تراکنش را به شما نشان داده و از شما تأیید بگیرد!
          </div>
        </div>
      </div>
    </div>
  )
}
