import { useState } from 'react'
import { loadSession, notifyUser } from '../lib/sync'

export function ChatGPTApiSection({ onOpenCloud }: { onOpenCloud: () => void }) {
  const session = loadSession()
  const [activeSubTab, setActiveSubTab] = useState<'mcp' | 'customGpt'>('mcp')
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedOpenApiUrl, setCopiedOpenApiUrl] = useState(false)
  const [copiedOpenApiRaw, setCopiedOpenApiRaw] = useState(false)
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false)
  const [copiedJsonConfig, setCopiedJsonConfig] = useState(false)
  const [copiedHeaderValue, setCopiedHeaderValue] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const apiBaseUrl = `${origin}/api/v1`
  const openApiUrl = `${apiBaseUrl}/openapi.json`
  const mcpServerUrl = `${origin}/mcp`
  const docsUrl = `${apiBaseUrl}/docs`

  const token = session?.accessToken || 'server_cloud_sync_token'
  const bearerHeaderValue = `Bearer ${token}`

  const jsonMcpConfig = JSON.stringify(
    {
      mcpServers: {
        hesabyar: {
          url: mcpServerUrl,
          headers: {
            Authorization: bearerHeaderValue,
          },
        },
      },
    },
    null,
    2
  )

  const handleCopy = (text: string, setFn: (val: boolean) => void, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setFn(true)
      notifyUser(`${label} در کلیپ‌بورد کپی شد`)
      setTimeout(() => setFn(false), 2500)
    })
  }

  const handleCopyOpenApiRaw = async () => {
    try {
      const res = await fetch(openApiUrl)
      if (res.ok) {
        const text = await res.text()
        handleCopy(text, setCopiedOpenApiRaw, 'متن کامل OpenAPI Schema')
      } else {
        notifyUser('خطا در دریافت متن OpenAPI')
      }
    } catch {
      notifyUser('خطا در دریافت متن OpenAPI')
    }
  }

  return (
    <div className="chatgpt-api-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Overview Card */}
      <div className="lg settings-block" style={{ border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(15, 23, 42, 0.65)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '28px' }}>🤖</span>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--hy-accent)' }}>
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
            <ul style={{ margin: '6px 0 0 0', paddingRight: '18px', color: 'var(--hy-text-secondary)' }}>
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
          برای حفظ امنیت کامل، دسترسی‌ها با توکن امن محافظت می‌شوند و هوش مصنوعی فقط به داده‌های حساب شما دسترسی خواهد داشت.
        </p>

        {session ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--hy-income)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span>
                <span>متصل به حساب: <strong>{session.email}</strong></span>
              </div>
              <span className="badge ok" style={{ fontSize: '10px' }}>فعال</span>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', display: 'block', marginBottom: 4 }}>
                توکن امن دسترسی (Bearer Token):
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="password"
                  readOnly
                  value={token}
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
                  onClick={() => handleCopy(token, setCopiedToken, 'توکن دسترسی')}
                  style={{ padding: '0 14px', fontSize: '11.5px', fontWeight: 700 }}
                >
                  {copiedToken ? 'کپی شد ✓' : 'کپی توکن'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ fontSize: '12px', color: 'var(--hy-warn)', marginBottom: 8, lineHeight: 1.5 }}>
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

      {/* Tabs to switch between MCP Server vs Custom GPT Action */}
      <div className="seg" role="tablist" style={{ margin: '2px 0' }}>
        <button
          className={`seg-btn${activeSubTab === 'mcp' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveSubTab('mcp')}
          style={{ fontSize: '12px', fontWeight: 700, padding: '8px 6px' }}
        >
          ⚡ تنظیم به عنوان Custom MCP Server
        </button>
        <button
          className={`seg-btn${activeSubTab === 'customGpt' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveSubTab('customGpt')}
          style={{ fontSize: '12px', fontWeight: 700, padding: '8px 6px' }}
        >
          🛠️ تنظیم به عنوان Custom GPT Action
        </button>
      </div>

      {/* TAB 1: CUSTOM MCP SERVER (Desktop / Developer Mode) */}
      {activeSubTab === 'mcp' ? (
        <div className="lg settings-block">
          <h3 style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span>
            <span>مشخصات اتصال سرور MCP (Streamable HTTP / SSE)</span>
          </h3>
          <p className="sheet-sub" style={{ marginTop: 2 }}>
            در نرم‌افزار دسکتاپ ChatGPT، Cursor یا Claude Desktop مقادیر زیر را در فیلدهای متناظر وارد کنید:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {/* Field 1: Name */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                ۱. نام سرور (Server Name):
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 700, color: 'var(--hy-accent)' }}>
                HesabYar
              </div>
            </div>

            {/* Field 2: Type */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                ۲. نوع پروتکل سرور (Server Type / Transport):
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--hy-income)', fontWeight: 700 }}>
                HTTP (یا SSE / Streamable HTTP)
              </div>
            </div>

            {/* Field 3: Server URL */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)' }}>
                  ۳. آدرس سرور (Server URL / Endpoint):
                </div>
                <button
                  type="button"
                  className="home-pill ghost"
                  onClick={() => handleCopy(mcpServerUrl, setCopiedMcpUrl, 'آدرس سرور MCP')}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  {copiedMcpUrl ? 'کپی شد ✓' : 'کپی آدرس'}
                </button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', direction: 'ltr', color: 'var(--hy-accent)', wordBreak: 'break-all' }}>
                {mcpServerUrl}
              </div>
            </div>

            {/* Field 4: Headers */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)' }}>
                  ۴. هدرهای احراز هویت (Headers):
                </div>
                <button
                  type="button"
                  className="home-pill ghost"
                  onClick={() => handleCopy(bearerHeaderValue, setCopiedHeaderValue, 'مقدار هدر Authorization')}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  {copiedHeaderValue ? 'کپی شد ✓' : 'کپی مقدار هدر'}
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--hy-text-primary)', lineHeight: 1.6 }}>
                نام هدر (Key): <code style={{ color: 'var(--hy-accent)' }}>Authorization</code>
                <br />
                مقدار هدر (Value): <code style={{ color: 'var(--hy-income)', direction: 'ltr', display: 'inline-block' }}>{bearerHeaderValue}</code>
              </div>
            </div>

            {/* JSON Config Snippet */}
            <div style={{ marginTop: 6, padding: '10px 12px', background: 'rgba(0, 0, 0, 0.35)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
                  کد آماده کانفیگ JSON (جهت پیست در mcpServers):
                </span>
                <button
                  type="button"
                  className="home-pill"
                  onClick={() => handleCopy(jsonMcpConfig, setCopiedJsonConfig, 'کد JSON کانفیگ MCP')}
                  style={{ fontSize: '11px', padding: '3px 10px' }}
                >
                  {copiedJsonConfig ? 'کپی شد ✓' : 'کپی JSON کانفیگ'}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  direction: 'ltr',
                  color: 'var(--hy-text-secondary)',
                  overflowX: 'auto',
                  padding: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: 6,
                }}
              >
                {jsonMcpConfig}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: CUSTOM GPT ACTIONS (ChatGPT Web/App) */
        <div className="lg settings-block">
          <h3 style={{ fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🛠️</span>
            <span>مشخصات ساخت Custom GPT Action در وب چت‌جی‌پی‌تی</span>
          </h3>
          <p className="sheet-sub" style={{ marginTop: 2 }}>
            در منوی ChatGPT به مسیر <strong>Explore GPTs &gt; Create &gt; Configure &gt; Actions</strong> بروید و فیلدها را به این شکل تکمیل کنید:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {/* Step 1: Authentication */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--hy-accent)', marginBottom: 4 }}>
                ۱. تنظیم احراز هویت (Authentication):
              </div>
              <ul style={{ margin: 0, paddingRight: 16, fontSize: '11px', color: 'var(--hy-text-primary)', lineHeight: 1.6 }}>
                <li>نوع احراز هویت (Authentication Type): گزینه <strong>API Key</strong> را انتخاب کنید.</li>
                <li>نوع کلید (Auth Type): گزینه <strong>Bearer</strong> را علامت بزنید.</li>
                <li>کلید API (API Key): توکن امن خود را در این فیلد قرار دهید:</li>
              </ul>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  type="password"
                  readOnly
                  value={token}
                  style={{
                    flex: 1,
                    direction: 'ltr',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--hy-input-bg)',
                    border: '1px solid var(--hy-border)',
                    color: 'var(--hy-text-primary)',
                  }}
                />
                <button
                  type="button"
                  className="home-pill"
                  onClick={() => handleCopy(token, setCopiedToken, 'توکن دسترسی')}
                  style={{ padding: '0 12px', fontSize: '11px' }}
                >
                  {copiedToken ? 'کپی شد ✓' : 'کپی'}
                </button>
              </div>
            </div>

            {/* Step 2: Schema */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--hy-accent)', marginBottom: 4 }}>
                ۲. طرحواره API (Schema):
              </div>
              <div style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', marginBottom: 6 }}>
                روی <strong>Import from URL</strong> کلیک کنید و لینک زیر را قرار دهید:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={openApiUrl}
                  style={{
                    flex: 1,
                    direction: 'ltr',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--hy-input-bg)',
                    border: '1px solid var(--hy-border)',
                    color: 'var(--hy-accent)',
                  }}
                />
                <button
                  type="button"
                  className="home-pill ghost"
                  onClick={() => handleCopy(openApiUrl, setCopiedOpenApiUrl, 'آدرس OpenAPI Schema')}
                  style={{ padding: '0 12px', fontSize: '11px' }}
                >
                  {copiedOpenApiUrl ? 'کپی شد ✓' : 'کپی لینک'}
                </button>
              </div>

              {/* Direct JSON Copy if URL fails */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--hy-text-secondary)' }}>
                  اگر ChatGPT در خواندن لینک خطا داد، متن JSON را مستقیماً پیست کنید:
                </span>
                <button
                  type="button"
                  className="home-pill"
                  onClick={() => void handleCopyOpenApiRaw()}
                  style={{ fontSize: '10.5px', padding: '3px 8px' }}
                >
                  {copiedOpenApiRaw ? 'کپی شد ✓' : 'کپی کل متن JSON'}
                </button>
              </div>
            </div>

            {/* Step 3: Privacy Policy */}
            <div style={{ padding: '8px 10px', background: 'var(--hy-input-bg)', borderRadius: 8, border: '1px solid var(--hy-border)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--hy-accent)', marginBottom: 2 }}>
                ۳. لینک حریم خصوصی (Privacy Policy):
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '11.5px', direction: 'ltr', color: 'var(--hy-text-secondary)' }}>
                {docsUrl}
              </div>
            </div>

            {/* Step 4: Safety / Confirmation */}
            <div style={{ padding: '8px 10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--hy-income)', lineHeight: 1.5 }}>
                ✓ <strong>سیستم تأیید مالی دو مرحله‌ای (Confirmation Flow):</strong> حسابیار مجهز به <code>dryRun</code> است؛ بنابراین چت‌جی‌پی‌تی برای تراکنش‌ها ابتدا پیش‌نمایش مبلغ و موجودی را نشان داده و پس از تأیید صریح شما ثبت می‌کند.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Web Docs Link */}
      <div style={{ textAlign: 'center' }}>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--hy-accent) 14%, transparent)',
            color: 'var(--hy-accent)',
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <span>مشاهده صفحه مستندات کامل API در مرورگر</span>
          <span>↗</span>
        </a>
      </div>
    </div>
  )
}
