import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PatternLock } from '../components/PatternLock'
import { SyncSheet } from '../components/SyncSheet'
import { SupabaseConfigSheet } from '../components/SupabaseConfigSheet'
import { loadLock, registerBiometric, setPattern, type AppLockRecord } from '../lib/applock'
import { rememberedAccountPassword } from '../lib/account'
import { joinSharedCode } from '../lib/share'
import { toFaDigits } from '../lib/money'
import { notifyUser, loadSession, type CloudSession } from '../lib/sync'
import { getSupabaseSettings } from '../lib/supabaseClient'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { SmsSettingsSection } from '../components/SmsSettingsSection'
import { VaultRecover } from '../components/VaultRecover'
import { AboutContent } from '../components/AboutPopup'
import { ThemeGallery } from '../components/ThemeGallery'
import { ChatGPTApiSection } from '../components/ChatGPTApiSection'
import { getCurrentTheme, THEMES } from '../lib/theme'
import type { Account, Category, Transaction } from '../types'

export type SettingsSection =
  | 'themes'
  | 'cloud'
  | 'security'
  | 'vault'
  | 'sms'
  | 'share'
  | 'api'
  | 'backup'
  | 'about'
  | null

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function generateTransactionsCsv(transactions: Transaction[], accounts: Account[], categories: Category[]): string {
  const header = ['شناسه', 'نوع', 'مبلغ (ریال)', 'مبلغ (تومان)', 'حساب', 'دسته‌بندی', 'طرف حساب', 'تاریخ', 'یادداشت']
  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`
  const rows = transactions.map((t) => {
    const kindLabel =
      t.kind === 'income'
        ? 'درآمد'
        : t.kind === 'expense'
          ? 'هزینه'
          : t.kind === 'transferOut'
            ? 'انتقال به'
            : 'انتقال از'
    const accountName = accounts.find((a) => a.id === t.accountId)?.name ?? t.accountId
    const counterName = t.counterpartyAccountId
      ? accounts.find((a) => a.id === t.counterpartyAccountId)?.name ?? t.counterpartyAccountId
      : ''
    const catName = categories.find((c) => c.id === t.categoryId)?.name ?? t.categoryId
    return [
      escapeCsv(t.id),
      escapeCsv(kindLabel),
      escapeCsv(t.amount),
      escapeCsv(Math.trunc(t.amount / 10)),
      escapeCsv(accountName),
      escapeCsv(catName),
      escapeCsv(counterName),
      escapeCsv(t.date),
      escapeCsv(t.note),
    ].join(',')
  })
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n')
}

function SettingsSubHeader({
  icon,
  title,
  subtitle,
  onBack,
}: {
  icon: string
  title: string
  subtitle: string
  onBack: () => void
}) {
  return (
    <div className="settings-sub-header">
      <button
        className="settings-back-btn"
        type="button"
        onClick={onBack}
        aria-label="بازگشت به فهرست تنظیمات"
      >
        <span className="back-arrow" aria-hidden="true">›</span>
        <span>بازگشت به تنظیمات</span>
      </button>
      <div className="settings-sub-title-row">
        <span className="settings-sub-icon" aria-hidden="true">{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = (searchParams.get('section') as SettingsSection) || null

  const setActiveSection = (section: SettingsSection) => {
    if (section) {
      setSearchParams({ section })
    } else {
      setSearchParams({})
    }
  }

  const [cloudPopup, setCloudPopup] = useState<'cloud' | 'supabase' | null>(null)
  const [shareCode, setShareCode] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [session, setSession] = useState<CloudSession | null>(() => loadSession())
  const [supabaseSettings, setSupabaseSettings] = useState(() => getSupabaseSettings())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Security Section States
  const [pattern, setPatternValue] = useState<number[]>([])
  const [lock, setLock] = useState<AppLockRecord>(() => loadLock())
  const [securityInfo, setSecurityInfo] = useState<string | null>(null)

  // Vault Section States
  const [vaultCurrent, setVaultCurrent] = useState('')
  const [vaultNext, setVaultNext] = useState('')
  const [vaultAgain, setVaultAgain] = useState('')
  const [vaultAccountPassword, setVaultAccountPassword] = useState('')
  const [vaultRecoveryCode, setVaultRecoveryCode] = useState('')
  const [vaultForgot, setVaultForgot] = useState(false)
  const [vaultInfo, setVaultInfo] = useState<string | null>(null)
  const [vaultError, setVaultError] = useState<string | null>(null)

  const { currencyUnit, setCurrencyUnit, exportLocal, importLocal, vaultConfigured, setVaultPassword, changeVaultPassword } = useExtras()
  const { accounts, transactions, plans, items, customCategories, importCloud } = useStore()

  const currentThemeId = getCurrentTheme()
  const currentTheme = THEMES.find((t) => t.id === currentThemeId)

  useEffect(() => {
    const onSessionChange = () => setSession(loadSession())
    const onCfgChange = () => setSupabaseSettings(getSupabaseSettings())
    window.addEventListener('hy-cloud-session', onSessionChange)
    window.addEventListener('hy-supabase-config-changed', onCfgChange)
    return () => {
      window.removeEventListener('hy-cloud-session', onSessionChange)
      window.removeEventListener('hy-supabase-config-changed', onCfgChange)
    }
  }, [])

  async function handleExportBackup() {
    try {
      const extraData = await exportLocal()
      const payload = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          accounts,
          transactions,
          plans,
          items,
          customCategories,
          ...extraData,
        },
      }
      const json = JSON.stringify(payload, null, 2)
      const dateStr = new Date().toISOString().slice(0, 10)
      downloadFile(json, `hesabyar-backup-${dateStr}.json`, 'application/json;charset=utf-8')
      notifyUser('فایل پشتیبان با موفقیت دانلود شد')
    } catch {
      notifyUser('خطا در ایجاد فایل پشتیبان')
    }
  }

  function handleExportCsv() {
    try {
      const csv = generateTransactionsCsv(transactions, accounts, customCategories)
      const dateStr = new Date().toISOString().slice(0, 10)
      downloadFile(csv, `hesabyar-transactions-${dateStr}.csv`, 'text/csv;charset=utf-8')
      notifyUser('خروجی اکسل تراکنش‌ها دانلود شد')
    } catch {
      notifyUser('خطا در ایجاد فایل اکسل')
    }
  }

  async function handleRestoreFile(file: File) {
    if (!confirm('آیا مطمئن هستید؟ اطلاعات فعلی برنامه با داده‌های فایل پشتیبان جایگزین خواهد شد.')) {
      return
    }
    setRestoring(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const data = json.data ?? json
      if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
        throw new Error('فایل پشتیبان نامعتبر است.')
      }

      await importCloud({
        accounts: data.accounts,
        transactions: data.transactions,
        plans: Array.isArray(data.plans) ? data.plans : [],
        items: Array.isArray(data.items) ? data.items : [],
        customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
      })
      await importLocal(data)

      notifyUser('داده‌ها با موفقیت بازیابی شدند.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'خطا در بازیابی فایل')
    } finally {
      setRestoring(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSaveVault() {
    setVaultError(null)
    setVaultInfo(null)
    if (vaultNext.length < 4) {
      setVaultError('رمز حداقل ۴ حرف است')
      return
    }
    if (vaultNext !== vaultAgain) {
      setVaultError('تکرار رمز یکسان نیست')
      return
    }
    try {
      const account = vaultAccountPassword || rememberedAccountPassword()
      const code = vaultConfigured
        ? await changeVaultPassword(vaultCurrent, vaultNext, account)
        : await setVaultPassword(vaultNext, account)
      setVaultRecoveryCode(code)
      setVaultInfo(vaultConfigured ? 'رمز گاوصندوق عوض شد' : 'رمز گاوصندوق تعیین شد')
      notifyUser('رمز گاوصندوق ذخیره شد')
      setVaultCurrent('')
      setVaultNext('')
      setVaultAgain('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'رمز ذخیره نشد'
      setVaultError(message)
      notifyUser(message)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-PAGE VIEWS (Dedicated screen for each section with back navigation)
  // ══════════════════════════════════════════════════════════════════════════

  const renderSubPage = () => {
    switch (activeSection) {
      case 'themes':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🎨"
              title="شخصی‌سازی و تم‌های ظاهری"
              subtitle="انتخاب از بین ۷ استایل گرافیکی و واحد پول برنامه"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎨</span>
                <span>استایل‌های طراحی و گرافیک (۷ تم اختصاصی)</span>
              </h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                هر تم دارای پالت رنگی، کادربندی‌ها، منوی ناوبری و دکمه‌های کاملاً منطبق بر سبک طراحی خود است.
              </p>
              <ThemeGallery />
            </section>

            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💰</span>
                <span>واحد پول پیش‌فرض برنامه</span>
              </h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                نحوه نمایش مبالغ در تمام حساب‌ها، تراکنش‌ها، بودجه و گزارش‌ها
              </p>
              <div className="seg" role="tablist" style={{ marginTop: 10 }}>
                <button
                  className={`seg-btn${currencyUnit === 'IRT' ? ' active' : ''}`}
                  type="button"
                  onClick={() => void setCurrencyUnit('IRT')}
                >
                  تومان (رایج در بازار)
                </button>
                <button
                  className={`seg-btn${currencyUnit === 'IRR' ? ' active' : ''}`}
                  type="button"
                  onClick={() => void setCurrencyUnit('IRR')}
                >
                  ریال (رسمی بانکی)
                </button>
              </div>
            </section>
          </div>
        )

      case 'cloud':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="☁️"
              title="همگام‌سازی ابری و دیتابیس"
              subtitle="اتصال حساب کاربری و پایگاه‌داده اختصاصی Supabase"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(15, 118, 110, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                    }}
                  >
                    ☁️
                  </div>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--hy-text)' }}>وضعیت اتصال ابری</strong>
                    <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                      {session ? `متصل به: ${session.email}` : 'همگام‌سازی ابری غیرفعال است (اطلاعات فقط روی دستگاه شماست)'}
                    </div>
                  </div>
                </div>
                <span className={`badge ${session ? 'ok' : 'pending'}`}>
                  {session ? '● آنلاین' : '○ محلی'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  className="cta-confirm"
                  type="button"
                  onClick={() => setCloudPopup('cloud')}
                  style={{ height: 44, justifyContent: 'center' }}
                >
                  👤 {session ? 'مدیریت حساب و خروج' : 'ورود / ثبت‌نام حساب ابری'}
                </button>

                <button
                  className="home-pill ghost"
                  type="button"
                  onClick={() => setCloudPopup('supabase')}
                  style={{ height: 42, justifyContent: 'center' }}
                >
                  ⚡ {supabaseSettings.isCustom ? 'تنظیمات دیتابیس اختصاصی (شخصی)' : 'تنظیم اتصال Supabase'}
                </button>
              </div>
            </section>

            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700 }}>امنیت و حریم خصوصی داده‌های ابری</h2>
              <p className="sheet-sub" style={{ marginTop: 6, lineHeight: 1.7 }}>
                داده‌ها با الگوریتم‌های استاندارد رمزگذاری می‌شوند. بدون اتصال ابری نیز تمام عملکردهای برنامه به شکل کامل و آفلاین ذخیره می‌گردند.
              </p>
            </section>
          </div>
        )

      case 'security':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🛡️"
              title="امنیت، قفل ورود و بیومتریک"
              subtitle="الگوی ترسیمی، اثر انگشت و تشخیص چهره گوشی"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>الگوی ترسیمی ورود (Pattern Lock)</h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                الگو را با کشیدن انگشت روی نقطه‌ها تعیین کنید (حداقل ۴ نقطه).
              </p>
              <div style={{ margin: '14px 0' }}>
                <PatternLock value={pattern} onChange={setPatternValue} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="cta-confirm"
                  type="button"
                  style={{ flex: 1, height: 42 }}
                  onClick={() => {
                    if (pattern.length < 4) {
                      setSecurityInfo('حداقل ۴ نقطه را به هم وصل کنید')
                      return
                    }
                    void setPattern(pattern.join('-')).then(() => {
                      setLock(loadLock())
                      setPatternValue([])
                      setSecurityInfo('الگوی ورود با موفقیت ذخیره شد')
                      notifyUser('الگوی ورود ثبت شد')
                    })
                  }}
                >
                  ثبت الگوی جدید
                </button>
                {lock.patternHash ? (
                  <button
                    className="home-pill ghost"
                    type="button"
                    style={{ height: 42 }}
                    onClick={() => {
                      void setPattern('').then(() => {
                        setLock(loadLock())
                        setSecurityInfo('الگوی ورود حذف شد')
                        notifyUser('الگوی ورود غیرفعال شد')
                      })
                    }}
                  >
                    حذف الگو
                  </button>
                ) : null}
              </div>
            </section>

            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>ورود بیومتریک (اثر انگشت / تشخیص چهره)</h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                قفل گوشی از طریق حسگر دستگاه فراخوانی می‌شود و اطلاعات حساس در سرور ذخیره نمی‌گردد.
              </p>
              <button
                className="cta-confirm"
                type="button"
                style={{ width: '100%', height: 42, marginTop: 10 }}
                onClick={() =>
                  void registerBiometric()
                    .then(() => {
                      setLock(loadLock())
                      setSecurityInfo('ورود با قفل بیومتریک گوشی فعال شد')
                      notifyUser('قفل بیومتریک فعال شد')
                    })
                    .catch((err) =>
                      setSecurityInfo(err instanceof Error ? err.message : 'قفل گوشی در دسترس نیست')
                    )
                }
              >
                🔐 فعال‌سازی ورود با اثر انگشت یا چهره
              </button>
            </section>

            {securityInfo ? (
              <div className="banner info" style={{ marginTop: 12 }}>
                <span>{securityInfo}</span>
              </div>
            ) : null}
          </div>
        )

      case 'vault':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🔐"
              title="گاوصندوق کارت‌های محرمانه"
              subtitle="رمزگذاری کارت‌های بانکی، CVV2 و رمز دوم با رمز اختصاصی"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>
                {vaultConfigured ? 'تغییر رمز گاوصندوق' : 'تعیین رمز برای گاوصندوق کارت‌ها'}
              </h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                {vaultConfigured
                  ? 'رمز فعلی و رمز تازه را وارد کنید. کارت‌ها با رمز تازه مجدداً رمزگذاری می‌شوند.'
                  : 'یک رمز اختصاصی برای گاوصندوق کارت‌ها تنظیم کنید تا مشخصات حساس کارت‌ها قفل شوند.'}
              </p>

              <div className="field-stack" style={{ marginTop: 12 }}>
                {vaultConfigured ? (
                  <input
                    className="field-input"
                    type="password"
                    placeholder="رمز فعلی گاوصندوق"
                    value={vaultCurrent}
                    onChange={(e) => setVaultCurrent(e.target.value)}
                  />
                ) : null}
                <input
                  className="field-input"
                  type="password"
                  placeholder="رمز جدید گاوصندوق (حداقل ۴ نویسه)"
                  value={vaultNext}
                  onChange={(e) => setVaultNext(e.target.value)}
                />
                <input
                  className="field-input"
                  type="password"
                  placeholder="تکرار رمز جدید گاوصندوق"
                  value={vaultAgain}
                  onChange={(e) => setVaultAgain(e.target.value)}
                />
                {rememberedAccountPassword() ? null : (
                  <input
                    className="field-input"
                    type="password"
                    placeholder="رمز حساب برای بازیابی بعدی"
                    value={vaultAccountPassword}
                    onChange={(e) => setVaultAccountPassword(e.target.value)}
                  />
                )}

                <button
                  className="cta-confirm"
                  type="button"
                  style={{ height: 44, marginTop: 4 }}
                  onClick={() => void handleSaveVault()}
                >
                  ثبت و ذخیره رمز گاوصندوق
                </button>
              </div>

              {vaultRecoveryCode ? (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <p className="sheet-sub" style={{ fontWeight: 700, color: 'var(--hy-income)' }}>
                    کد بازیابی اضطراری گاوصندوق (آن را در جای امن نگه دارید):
                  </p>
                  <p className="recovery-code" style={{ textAlign: 'center', margin: '8px 0', fontSize: 18 }}>
                    {vaultRecoveryCode}
                  </p>
                </div>
              ) : null}

              {vaultConfigured ? (
                <div style={{ marginTop: 14 }}>
                  <button
                    className="link"
                    type="button"
                    onClick={() => setVaultForgot((v) => !v)}
                    style={{ fontSize: 12 }}
                  >
                    رمز گاوصندوق را فراموش کرده‌ام (بازیابی اضطراری)
                  </button>
                </div>
              ) : null}

              {vaultForgot ? (
                <div style={{ marginTop: 12 }}>
                  <VaultRecover
                    onDone={(code) => {
                      setVaultRecoveryCode(code)
                      setVaultForgot(false)
                      setVaultInfo('رمز گاوصندوق با موفقیت بازیابی شد')
                    }}
                  />
                </div>
              ) : null}

              {vaultError ? (
                <div className="banner error" style={{ marginTop: 10 }}>
                  <span>{vaultError}</span>
                </div>
              ) : null}
              {vaultInfo ? (
                <div className="banner ok" style={{ marginTop: 10 }}>
                  <span>{vaultInfo}</span>
                </div>
              ) : null}
            </section>
          </div>
        )

      case 'sms':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="📩"
              title="هوشمندسازی پیامک‌های بانکی"
              subtitle="استخراج خودکار واریز و برداشت از پیامک‌های شتاب"
              onBack={() => setActiveSection(null)}
            />

            <div style={{ marginTop: 12 }}>
              <SmsSettingsSection />
            </div>
          </div>
        )

      case 'share':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🤝"
              title="کارت مشترک و دسترسی‌ها"
              subtitle="پیوستن به کارت‌های اشتراکی با کد امنیتی"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>پیوستن به کارت مشترک</h2>
              <p className="sheet-sub" style={{ marginTop: 4, lineHeight: 1.7 }}>
                کد اشتراکی که مالک حساب به شما داده را وارد کنید. دسترسی تنها در صورتی تایید می‌شود که ایمیل شما در لیست افراد مجاز ثبت شده باشد.
              </p>

              {shareError ? (
                <div className="banner error" style={{ margin: '10px 0', fontSize: 11 }}>
                  <span>{shareError}</span>
                </div>
              ) : null}

              <div className="field-stack" style={{ marginTop: 12 }}>
                <input
                  className="field-input"
                  dir="ltr"
                  placeholder="مثال: AB12-CD34"
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                  aria-label="کد اشتراک"
                  style={{ textAlign: 'center', letterSpacing: 2, fontFamily: 'monospace', fontWeight: 800 }}
                />
                <button
                  className="cta-confirm"
                  type="button"
                  disabled={joining || shareCode.trim().length < 4}
                  style={{ height: 44 }}
                  onClick={() => {
                    setJoining(true)
                    setShareError(null)
                    void joinSharedCode(shareCode)
                      .then(() => {
                        setShareCode('')
                        notifyUser('با موفقیت به حساب مشترک متصل شدید!')
                        window.dispatchEvent(new Event('hy-share-refresh'))
                      })
                      .catch((err: unknown) => {
                        setShareError(err instanceof Error ? err.message : 'پیوستن انجام نشد')
                      })
                      .finally(() => setJoining(false))
                  }}
                >
                  {joining ? 'در حال بررسی مجوز دسترسی…' : 'پیوستن امن به کارت'}
                </button>
              </div>
            </section>
          </div>
        )

      case 'backup':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="💾"
              title="پشتیبان‌گیری و خروجی داده‌ها"
              subtitle="دانلود فایل پشتیبان آفلاین JSON و خروجی اکسل CSV"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>دریافت نسخه پشتیبان (خروجی)</h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                داده‌های مالی شما کاملاً متعلق به خودتان است و همیشه می‌توانید فایل پشتیبان دانلود کنید.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <button
                  className="home-pill ghost"
                  type="button"
                  onClick={() => void handleExportBackup()}
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontWeight: 700 }}
                >
                  📥 دانلود فایل پشتیبان کامل (JSON)
                </button>
                <button
                  className="home-pill ghost"
                  type="button"
                  onClick={handleExportCsv}
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontWeight: 700 }}
                >
                  📊 خروجی استاندارد اکسل تمام تراکنش‌ها (CSV)
                </button>
              </div>
            </section>

            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>بازیابی اطلاعات از فایل پشتیبان</h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                انتخاب فایل JSON قبلی برای جایگزینی یا بازیابی اطلاعات برنامه
              </p>

              <label
                className="cta-confirm"
                style={{
                  width: '100%',
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginTop: 12,
                }}
              >
                <span>{restoring ? 'در حال بازیابی اطلاعات…' : '📤 انتخاب و بارگذاری فایل پشتیبان JSON'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  disabled={restoring}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleRestoreFile(file)
                  }}
                />
              </label>
            </section>
          </div>
        )

      case 'api':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🤖"
              title="اتصال به ChatGPT و API (MCP)"
              subtitle="پیکربندی اتصال مستقیم حساب شخصی شما به ChatGPT و ابزارهای هوش مصنوعی"
              onBack={() => setActiveSection(null)}
            />

            <ChatGPTApiSection onOpenCloud={() => setCloudPopup('cloud')} />
          </div>
        )

      case 'about':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="ℹ️"
              title="درباره حساب‌یار و نگارش ۰.۲.۰"
              subtitle="مشخصات نسخه ۰.۲.۰، امکانات و گزارش به‌روزرسانی"
              onBack={() => setActiveSection(null)}
            />

            <div style={{ marginTop: 12 }}>
              <AboutContent />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN SETTINGS HUB (Clean, categorized list of settings categories)
  // ══════════════════════════════════════════════════════════════════════════

  const SETTINGS_GROUPS = [
    {
      groupTitle: 'ظاهری و شخصی‌سازی',
      items: [
        {
          id: 'themes' as const,
          icon: '🎨',
          title: 'شخصی‌سازی و تم‌های ظاهری',
          subtitle: `انتخاب از بین ۷ استایل گرافیکی مجزا · واحد پول فعلی: ${currencyUnit === 'IRT' ? 'تومان' : 'ریال'}`,
          badge: currentTheme?.name ? currentTheme.name.split(' ')[0] : '۷ تم',
          badgeClass: 'theme',
        },
      ],
    },
    {
      groupTitle: 'امنیت و محرمانگی',
      items: [
        {
          id: 'security' as const,
          icon: '🛡️',
          title: 'امنیت، الگو و بیومتریک',
          subtitle: 'الگوی ترسیمی ورود، اثر انگشت و حسگر چهره گوشی',
          badge: lock.patternHash || lock.credentialId ? 'فعال' : 'خاموش',
          badgeClass: lock.patternHash || lock.credentialId ? 'ok' : 'pending',
        },
        {
          id: 'vault' as const,
          icon: '🔐',
          title: 'گاوصندوق کارت‌های محرمانه',
          subtitle: vaultConfigured ? 'رمز تنظیم شده و کارت‌ها محافظت‌شده‌اند' : 'تعیین رمز اختصاصی و قفل CVV2 کارت‌ها',
          badge: vaultConfigured ? 'محافظت‌شده' : 'تنظیم‌نشده',
          badgeClass: vaultConfigured ? 'ok' : 'pending',
        },
      ],
    },
    {
      groupTitle: 'اتصال، پیامک و همکاری',
      items: [
        {
          id: 'cloud' as const,
          icon: '☁️',
          title: 'اتصال ابری و همگام‌سازی (Supabase)',
          subtitle: session ? `متصل به کاربر: ${session.email}` : 'همگام‌سازی بین دستگاه‌ها و پایگاه‌داده اختصاصی',
          badge: session ? 'متصل' : 'آفلاین',
          badgeClass: session ? 'ok' : 'pending',
        },
        {
          id: 'sms' as const,
          icon: '📩',
          title: 'هوشمندسازی پیامک‌های بانکی',
          subtitle: 'استخراج خودکار تراکنش‌ها از پیامک‌های واریز و برداشت بانک‌های کشور',
          badge: 'هوشمند',
          badgeClass: 'accent',
        },
        {
          id: 'share' as const,
          icon: '🤝',
          title: 'کارت مشترک و دسترسی‌ها',
          subtitle: 'پیوستن به حساب‌ها و کارت‌های اشتراکی با کد امنیتی و تایید ایمیل',
          badge: 'همکاری',
          badgeClass: 'info',
        },
        {
          id: 'api' as const,
          icon: '🤖',
          title: 'اتصال به ChatGPT و API (MCP)',
          subtitle: 'اتصال هوشمند حسابیار به ChatGPT، دریافت توکن و مشخصات سرور MCP',
          badge: 'هوش مصنوعی',
          badgeClass: 'accent',
        },
      ],
    },
    {
      groupTitle: 'داده‌ها و درباره برنامه',
      items: [
        {
          id: 'backup' as const,
          icon: '💾',
          title: 'پشتیبان‌گیری و خروجی داده‌ها',
          subtitle: 'دانلود نسخه پشتیبان JSON، خروجی اکسل CSV و بازیابی فایل',
          badge: 'آفلاین',
          badgeClass: 'pending',
        },
        {
          id: 'about' as const,
          icon: 'ℹ️',
          title: 'درباره حساب‌یار و نگارش ۰.۲.۰',
          subtitle: 'مشاهده مشخصات کامل برنامه، امکانات و گزارش تغییرات نسخه ۰.۲.۰',
          badge: 'نسخه ۰.۲.۰',
          badgeClass: 'ok',
        },
      ],
    },
  ]

  return (
    <div className="app-scroll settings-page" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      {activeSection ? (
        renderSubPage()
      ) : (
        <div className="settings-hub">
          {/* Main Hub Top Bar */}
          <div className="top-row" style={{ marginBottom: 14 }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800 }}>تنظیمات حساب‌یار</h1>
              <p style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                مدیریت بخش‌ها، تم‌های ظاهری و امنیت اطلاعات
              </p>
            </div>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--hy-income)',
                fontWeight: 700,
              }}
            >
              نسخه {toFaDigits('0.2.0')}
            </span>
          </div>

          {/* Quick Active Theme Banner */}
          <div
            onClick={() => setActiveSection('themes')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActiveSection('themes')
            }}
            className="settings-hero-card lg"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="hero-theme-icon">{currentTheme?.icon || '🎨'}</span>
              <div>
                <div className="hero-theme-title">
                  تم ظاهری فعال: {currentTheme?.name || 'تاریک مات'}
                </div>
                <div className="hero-theme-sub">
                  واحد پول: {currencyUnit === 'IRT' ? 'تومان' : 'ریال'} · لمس برای انتخاب از بین ۷ تم
                </div>
              </div>
            </div>
            <span className="hero-chevron" aria-hidden="true">‹</span>
          </div>

          {/* Categorized Settings Navigation List */}
          <div className="settings-groups-wrap">
            {SETTINGS_GROUPS.map((group, gIdx) => (
              <div key={gIdx} className="settings-group">
                <div className="settings-group-title">{group.groupTitle}</div>
                <div className="settings-nav-list">
                  {group.items.map((sec) => (
                    <div
                      key={sec.id}
                      onClick={() => setActiveSection(sec.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveSection(sec.id)
                      }}
                      className="settings-nav-card lg"
                    >
                      <div className="settings-nav-left">
                        <div className="settings-nav-icon-wrap" aria-hidden="true">
                          {sec.icon}
                        </div>
                        <div className="settings-nav-text">
                          <div className="settings-nav-title">{sec.title}</div>
                          <div className="settings-nav-subtitle">{sec.subtitle}</div>
                        </div>
                      </div>

                      <div className="settings-nav-right">
                        {sec.badge ? (
                          <span className={`badge ${sec.badgeClass}`}>{sec.badge}</span>
                        ) : null}
                        <span className="fchev" aria-hidden="true">‹</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer credit */}
          <p className="settings-credit">
            حساب‌یار · سازنده محمد احمدی · نسخه {toFaDigits('0.2.0').replaceAll('.', '\u066b')}
          </p>
        </div>
      )}

      {/* Popups (when triggered by internal buttons) */}
      {cloudPopup === 'cloud' ? <SyncSheet onClose={() => setCloudPopup(null)} /> : null}
      {cloudPopup === 'supabase' ? <SupabaseConfigSheet onClose={() => setCloudPopup(null)} /> : null}
    </div>
  )
}
