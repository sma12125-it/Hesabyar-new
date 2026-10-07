import { useEffect, useRef, useState } from 'react'
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
import { AboutPopup } from '../components/AboutPopup'
import { ThemeGallery } from '../components/ThemeGallery'
import type { Account, Category, Transaction } from '../types'

type Popup = 'cloud' | 'security' | 'vault' | 'supabase' | 'about' | null

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

export function SettingsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const [popup, setPopup] = useState<Popup>(null)
  const [shareCode, setShareCode] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [session, setSession] = useState<CloudSession | null>(() => loadSession())
  const [supabaseSettings, setSupabaseSettings] = useState(() => getSupabaseSettings())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { currencyUnit, setCurrencyUnit, exportLocal, importLocal, vaultConfigured } = useExtras()
  const { accounts, transactions, plans, items, customCategories, importCloud } = useStore()

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

  return (
    <div className="app-scroll settings-page" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      {/* Premium Header */}
      <div className="top-row" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>تنظیمات حساب‌یار</h1>
          <p style={{ fontSize: '11px', color: 'var(--hy-subtext)', marginTop: 2 }}>
            شخصی‌سازی، مدیریت ابری و امنیت اطلاعات
          </p>
        </div>
        <span style={{ width: 40 }} />
      </div>

      {/* Cloud & Supabase Hub */}
      <div
        className="lg"
        style={{
          borderRadius: 20,
          padding: '16px',
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%)',
          border: '1px solid rgba(15, 118, 110, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'rgba(15, 118, 110, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              ☁️
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--hy-text)' }}>
                مرکز اتصال ابری و Supabase
              </div>
              <div style={{ fontSize: '11px', color: 'var(--hy-subtext)', marginTop: 2 }}>
                {session ? `متصل به کاربر: ${session.email}` : 'همگام‌سازی لحظه‌ای بین چند دستگاه'}
              </div>
            </div>
          </div>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 600,
              background: session ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.12)',
              color: session ? '#059669' : '#dc2626',
            }}
          >
            {session ? '● فعال' : '○ غیرفعال'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <button
            className="home-pill ghost"
            type="button"
            onClick={() => setPopup('cloud')}
            style={{ justifyContent: 'center', height: 40, fontSize: '12px', fontWeight: 600 }}
          >
            👤 {session ? 'مدیریت حساب' : 'ورود / ثبت‌نام'}
          </button>
          <button
            className="home-pill ghost"
            type="button"
            onClick={() => setPopup('supabase')}
            style={{
              justifyContent: 'center',
              height: 40,
              fontSize: '12px',
              fontWeight: 600,
              borderColor: supabaseSettings.isCustom ? 'rgba(16, 185, 129, 0.4)' : undefined,
            }}
          >
            ⚡ {supabaseSettings.isCustom ? 'دیتابیس شخصی' : 'تنظیم Supabase'}
          </button>
        </div>
      </div>

      {/* App Preferences & Themes */}
      <section className="lg settings-block">
        <h2 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎨</span>
          <span>شخصی‌سازی و تم ظاهری</span>
        </h2>
        <p className="sheet-sub" style={{ marginTop: 4 }}>
          انتخاب از بین ۷ تم گرافیکی مجزا: تاریک مات بدون شیشه، مینیمال کاغذی، زمرد و طلا، سایبرپانک، نئوبروتالیسم، سرمه‌ای و شیشه‌ای.
        </p>

        <ThemeGallery />

        <div style={{ marginTop: 18 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--hy-text)' }}>
            واحد پول پیش‌فرض
          </span>
          <div className="seg" role="tablist">
            <button
              className={`seg-btn${currencyUnit === 'IRT' ? ' active' : ''}`}
              type="button"
              onClick={() => void setCurrencyUnit('IRT')}
            >
              تومان (رایج)
            </button>
            <button
              className={`seg-btn${currencyUnit === 'IRR' ? ' active' : ''}`}
              type="button"
              onClick={() => void setCurrencyUnit('IRR')}
            >
              ریال (بانکی)
            </button>
          </div>
        </div>
      </section>

      {/* Security & Vault */}
      <section className="lg settings-block">
        <h2 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🛡️</span>
          <span>امنیت و رمزنگاری</span>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <button
            className="settings-row"
            type="button"
            onClick={() => setPopup('security')}
            style={{ borderRadius: 14, padding: '12px 14px' }}
          >
            <span>
              <strong style={{ fontSize: '13px' }}>قفل برنامه و بیومتریک</strong>
              <small style={{ fontSize: '11px', color: 'var(--hy-subtext)' }}>
                الگوی ترسیمی، اثر انگشت و تشخیص چهره گوشی
              </small>
            </span>
            <span className="fchev">‹</span>
          </button>

          <button
            className="settings-row"
            type="button"
            onClick={() => setPopup('vault')}
            style={{ borderRadius: 14, padding: '12px 14px' }}
          >
            <span>
              <strong style={{ fontSize: '13px' }}>گاوصندوق کارت‌های محرمانه</strong>
              <small style={{ fontSize: '11px', color: 'var(--hy-subtext)' }}>
                {vaultConfigured ? 'رمز تنظیم شده و فعال است' : 'تعیین رمز اختصاصی و قفل کارت‌ها'}
              </small>
            </span>
            <span className="fchev">‹</span>
          </button>
        </div>
      </section>

      {/* SMS Bank Integration */}
      <SmsSettingsSection />

      {/* Secure Shared Account */}
      <section className="lg settings-block">
        <h2 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🤝</span>
          <span>پیوستن به کارت مشترک (محافظت‌شده با ایمیل)</span>
        </h2>
        <p className="sheet-sub" style={{ marginTop: 4 }}>
          کد اشتراکی که مالک کارت برای شما ارسال کرده است را وارد کنید. اتصال تنها در صورتی مجاز خواهد بود که ایمیل شما توسط مالک در لیست مجاز ثبت شده باشد.
        </p>

        {shareError ? (
          <div className="banner error" style={{ margin: '8px 0', fontSize: '11px' }}>
            <span>{shareError}</span>
          </div>
        ) : null}

        <div className="field-stack" style={{ marginTop: 10 }}>
          <input
            className="field-input"
            dir="ltr"
            placeholder="مثال: AB12-CD34"
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value.toUpperCase())}
            aria-label="کد اشتراک"
            style={{ textAlign: 'center', letterSpacing: 2, fontFamily: 'monospace', fontWeight: 700 }}
          />
          <button
            className="cta-confirm"
            type="button"
            disabled={joining || shareCode.trim().length < 4}
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

      {/* Backup and Data Export */}
      <section className="lg settings-block">
        <h2 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💾</span>
          <span>پشتیبان‌گیری و خروجی اکسل</span>
        </h2>
        <p className="sheet-sub" style={{ marginTop: 4 }}>
          داده‌های شما ۱۰۰٪ در اختیارتان است. می‌توانید همیشه پشتیبان آفلاین دانلود کنید.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <button
            className="home-pill ghost"
            type="button"
            onClick={() => void handleExportBackup()}
            style={{ width: '100%', justifyContent: 'center', height: 42 }}
          >
            📥 دانلود فایل پشتیبان کامل (JSON)
          </button>
          <button
            className="home-pill ghost"
            type="button"
            onClick={handleExportCsv}
            style={{ width: '100%', justifyContent: 'center', height: 42 }}
          >
            📊 خروجی استاندارد اکسل (CSV)
          </button>
          <label
            className="home-pill ghost"
            style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', height: 42 }}
          >
            <span>{restoring ? 'در حال بارگذاری فایل…' : '📤 بازیابی داده‌ها از فایل JSON'}</span>
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
        </div>
      </section>

      {/* About App & Version Section */}
      <section className="lg settings-block">
        <h2 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>ℹ️</span>
          <span>درباره برنامه و مشخصات نسخه</span>
        </h2>
        <p className="sheet-sub" style={{ marginTop: 4 }}>
          مشاهده اطلاعات کامل برنامه، امکانات، شماره نگارش و گزارش تغییرات نسخه ۰.۲.۰.
        </p>

        <div style={{ marginTop: 10 }}>
          <button
            className="settings-row"
            type="button"
            onClick={() => setPopup('about')}
            style={{ borderRadius: 14, padding: '12px 14px', width: '100%' }}
          >
            <span>
              <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>درباره حساب‌یار (نسخه {toFaDigits('0.2.0')})</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: 'var(--hy-income)',
                    fontWeight: 700,
                  }}
                >
                  به‌روزشده
                </span>
              </strong>
              <small style={{ fontSize: '11px', color: 'var(--hy-subtext)' }}>
                امکانات کامل، گزارش تغییرات نسخه ۰.۲.۰ و تاریخ آخرین آپدیت
              </small>
            </span>
            <span className="fchev">‹</span>
          </button>
        </div>
      </section>

      <p className="settings-credit" style={{ marginTop: 24, marginBottom: 12 }}>
        حساب‌یار · سازنده محمد احمدی · نسخه {toFaDigits('0.2.0').replaceAll('.', '\u066b')}
      </p>

      {/* Sheets / Popups */}
      {popup === 'cloud' ? <SyncSheet onClose={() => setPopup(null)} /> : null}
      {popup === 'supabase' ? <SupabaseConfigSheet onClose={() => setPopup(null)} /> : null}
      {popup === 'security' ? <SecurityPopup onClose={() => setPopup(null)} /> : null}
      {popup === 'vault' ? <VaultPopup onClose={() => setPopup(null)} /> : null}
      {popup === 'about' ? <AboutPopup onClose={() => setPopup(null)} /> : null}
    </div>
  )
}

function SecurityPopup({ onClose }: { onClose: () => void }) {
  const [pattern, setPatternValue] = useState<number[]>([])
  const [lock, setLock] = useState<AppLockRecord>(() => loadLock())
  const [info, setInfo] = useState<string | null>(null)

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="امنیت ورود">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>امنیت ورود</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">رمز ورود همان رمز حساب است. اثر انگشت و چهره از قفل خود گوشی خوانده می‌شود و داخل برنامه ذخیره نمی‌شود.</p>
          <p className="sheet-sub">الگو را با کشیدن انگشت روی نقطه‌ها بکشید، نه با کلیک جدا روی هر نقطه.</p>
          <PatternLock value={pattern} onChange={setPatternValue} />
          <button
            className="cat-mini"
            type="button"
            onClick={() => {
              if (pattern.length < 4) {
                setInfo('حداقل ۴ نقطه را به هم وصل کنید')
                return
              }
              void setPattern(pattern.join('-')).then(() => {
                setLock(loadLock())
                setPatternValue([])
                setInfo('الگو ذخیره شد')
              })
            }}
          >
            ثبت الگو
          </button>
          <button
            className="cta-confirm"
            type="button"
            onClick={() =>
              void registerBiometric()
                .then(() => {
                  setLock(loadLock())
                  setInfo('ورود با قفل گوشی روشن شد')
                })
                .catch((err) => setInfo(err instanceof Error ? err.message : 'قفل گوشی در دسترس نیست'))
            }
          >
            فعال کردن ورود با اثر انگشت یا چهره
          </button>
          <p className="sheet-sub">
            {lock.patternHash ? 'الگو روشن است. ' : ''}
            {lock.credentialId ? 'قفل گوشی روشن است.' : 'قفل گوشی خاموش است.'}
          </p>
          {info ? <p className="sheet-sub">{info}</p> : null}
        </div>
      </div>
    </>
  )
}

function VaultPopup({ onClose }: { onClose: () => void }) {
  const { vaultConfigured, setVaultPassword, changeVaultPassword } = useExtras()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [forgot, setForgot] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    setInfo(null)
    if (next.length < 4) {
      setError('رمز حداقل ۴ حرف است')
      return
    }
    if (next !== again) {
      setError('تکرار رمز یکسان نیست')
      return
    }
    try {
      const account = accountPassword || rememberedAccountPassword()
      const code = vaultConfigured
        ? await changeVaultPassword(current, next, account)
        : await setVaultPassword(next, account)
      setRecoveryCode(code)
      setInfo(vaultConfigured ? 'رمز گاوصندوق عوض شد' : 'رمز گاوصندوق تعیین شد')
      notifyUser('رمز گاوصندوق ذخیره شد')
      setCurrent('')
      setNext('')
      setAgain('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'رمز ذخیره نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="گاوصندوق کارت">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>گاوصندوق کارت</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">
            {vaultConfigured
              ? 'رمز فعلی و رمز تازه را بنویسید. کارت‌ها با رمز تازه دوباره قفل می‌شوند.'
              : 'یک رمز برای گاوصندوق بگذارید. کد بازیابی را نگه دارید تا اگر رمز را فراموش کردید کارت‌ها بمانند.'}
          </p>
          {vaultConfigured ? (
            <input
              className="field-input"
              type="password"
              placeholder="رمز فعلی گاوصندوق"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          ) : null}
          <input
            className="field-input"
            type="password"
            placeholder="رمز گاوصندوق"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <input
            className="field-input"
            type="password"
            placeholder="تکرار رمز"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
          {rememberedAccountPassword() ? null : (
            <input
              className="field-input"
              type="password"
              placeholder="رمز حساب، برای بازیابی بعدی"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
            />
          )}
          <button className="cta-confirm" type="button" onClick={() => void save()}>
            ثبت رمز
          </button>
          {recoveryCode ? (
            <>
              <p className="sheet-sub">
                کد بازیابی گاوصندوق را نگه دارید. با این کد یا با رمز حساب می‌توانید رمز گاوصندوق را عوض کنید.
              </p>
              <p className="recovery-code">{recoveryCode}</p>
            </>
          ) : null}
          {vaultConfigured ? (
            <button className="link" type="button" onClick={() => setForgot((value) => !value)}>
              رمز گاوصندوق را فراموش کرده‌ام
            </button>
          ) : null}
          {forgot ? (
            <VaultRecover
              onDone={(code) => {
                setRecoveryCode(code)
                setForgot(false)
                setInfo('رمز گاوصندوق بازیابی شد')
              }}
            />
          ) : null}
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          {info ? <p className="sheet-sub">{info}</p> : null}
        </div>
      </div>
    </>
  )
}
