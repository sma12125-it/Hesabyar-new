import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PatternLock } from '../components/PatternLock'
import { SyncSheet } from '../components/SyncSheet'
import { SyncBackupsPanel } from '../components/SyncBackupsPanel'
import { restorePayload, syncReady } from '../lib/cloudSync'
import { SupabaseConfigSheet } from '../components/SupabaseConfigSheet'
import { loadLock, registerBiometric, setPattern, type AppLockRecord } from '../lib/applock'
import { rememberedAccountPassword } from '../lib/account'
import { joinSharedCode } from '../lib/share'
import { notifyUser, loadSession, type CloudSession } from '../lib/sync'
import { getSupabaseSettings } from '../lib/supabaseClient'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { SmsSettingsSection } from '../components/SmsSettingsSection'
import { VaultRecover } from '../components/VaultRecover'
import { AboutContent } from '../components/AboutPopup'
import { ThemeGallery } from '../components/ThemeGallery'
import { ChatGPTApiSection } from '../components/ChatGPTApiSection'
import { getCurrentTheme, applyTheme, THEMES } from '../lib/theme'
import { promptPwaInstall } from '../lib/pwaInstall'
import * as db from '../db/db'
import { toFaDigits } from '../lib/money'
import { checkOfflineReadiness, warmOfflineCache } from '../lib/offlineAssets'
import type { Account, Category, InstallmentItem, InstallmentPlan, Pocket, PocketTransfer, Transaction } from '../types'

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
  | 'update'
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

interface PendingRestore {
  data: Record<string, unknown>
  stats: {
    accountsCount: number
    transactionsCount: number
    plansCount: number
    itemsCount: number
    chequesCount: number
    debtsCount: number
    dongEventsCount: number
    investmentsCount: number
    backupDate: string
  }
  fileName: string
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
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<'local' | 'cloud'>('local')
  const [offlineReady, setOfflineReady] = useState(false)
  const [cachedAssetsCount, setCachedAssetsCount] = useState(0)
  const [warmingCache, setWarmingCache] = useState(false)
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

  const [showThemeGallery, setShowThemeGallery] = useState(false)
  const [securityTab, setSecurityTab] = useState<'lock' | 'vault' | 'share'>('lock')
  const [updatePlatform, setUpdatePlatform] = useState<'webapp' | 'apk'>('webapp')
  const [isDownloadingApk, setIsDownloadingApk] = useState(false)
  const [apkProgress, setApkProgress] = useState(0)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  const { currencyUnit, setCurrencyUnit, exportLocal, importLocal, vaultConfigured, setVaultPassword, changeVaultPassword } = useExtras()
  const { accounts, transactions, plans, items, customCategories, importCloud } = useStore()

  const currentThemeId = getCurrentTheme()
  const currentTheme = THEMES.find((t) => t.id === currentThemeId)

  useEffect(() => {
    const onSessionChange = () => setSession(loadSession())
    const onCfgChange = () => setSupabaseSettings(getSupabaseSettings())
    window.addEventListener('hy-cloud-session', onSessionChange)
    window.addEventListener('hy-supabase-config-changed', onCfgChange)

    void checkOfflineReadiness().then((res) => {
      setOfflineReady(res.isReady)
      setCachedAssetsCount(res.cachedCount)
    })
    const onCacheUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ cachedCount?: number }>
      setOfflineReady(true)
      if (custom.detail?.cachedCount) setCachedAssetsCount(custom.detail.cachedCount)
    }
    window.addEventListener('hy-offline-cache-updated', onCacheUpdate)

    return () => {
      window.removeEventListener('hy-cloud-session', onSessionChange)
      window.removeEventListener('hy-supabase-config-changed', onCfgChange)
      window.removeEventListener('hy-offline-cache-updated', onCacheUpdate)
    }
  }, [])

  async function handleWarmCache() {
    setWarmingCache(true)
    try {
      const res = await warmOfflineCache()
      setOfflineReady(true)
      setCachedAssetsCount(res.cachedCount)
      notifyUser('کلیه فایل‌ها و وابستگی‌های برنامه برای اجرای آفلاین در حافظه دستگاه ذخیره شدند ✨')
    } catch {
      notifyUser('خطا در ذخیره‌سازی فایل‌های آفلاین')
    } finally {
      setWarmingCache(false)
    }
  }

  async function handleExportBackup() {
    try {
      const [extraData, storedPockets, storedTransfers, smsDrafts] = await Promise.all([
        exportLocal(),
        db.listPockets(),
        db.listPocketTransfers(),
        db.getKv('smsDraftState'),
      ])

      const dateStr = new Date().toISOString().slice(0, 10)
      const payload = {
        app: 'HesabYar',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        data: {
          accounts,
          transactions,
          plans,
          items,
          pockets: storedPockets.length ? storedPockets : undefined,
          pocketTransfers: storedTransfers.length ? storedTransfers : undefined,
          customCategories,
          ...extraData,
          smsDrafts,
          theme: getCurrentTheme(),
          appLock: localStorage.getItem('hy_app_lock'),
        },
        stats: {
          accountsCount: accounts.length,
          transactionsCount: transactions.length,
          plansCount: plans.length,
          itemsCount: items.length,
          chequesCount: Array.isArray(extraData.cheques) ? extraData.cheques.length : 0,
          debtsCount: Array.isArray(extraData.debts) ? extraData.debts.length : 0,
          dongEventsCount: Array.isArray(extraData.dongEvents) ? extraData.dongEvents.length : 0,
          investmentsCount: Array.isArray(extraData.investments) ? extraData.investments.length : 0,
        },
      }
      const json = JSON.stringify(payload, null, 2)
      downloadFile(json, `hesabyar-backup-full-${dateStr}.json`, 'application/json;charset=utf-8')
      notifyUser('پشتیبان جامع کلیه اطلاعات حساب‌یار با موفقیت دانلود شد ✨')
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

  async function handleSelectFile(file: File) {
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const rawData = json.data ?? json
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('ساختار فایل JSON پشتیبان نامعتبر است.')
      }

      const accountsList = Array.isArray(rawData.accounts) ? rawData.accounts : []
      const txsList = Array.isArray(rawData.transactions) ? rawData.transactions : []
      const plansList = Array.isArray(rawData.plans) ? rawData.plans : []
      const itemsList = Array.isArray(rawData.items) ? rawData.items : []
      const chequesList = Array.isArray(rawData.cheques) ? rawData.cheques : []
      const debtsList = Array.isArray(rawData.debts) ? rawData.debts : []
      const dongList = Array.isArray(rawData.dongEvents) ? rawData.dongEvents : []
      const invList = Array.isArray(rawData.investments) ? rawData.investments : []

      if (
        accountsList.length === 0 &&
        txsList.length === 0 &&
        chequesList.length === 0 &&
        debtsList.length === 0 &&
        dongList.length === 0
      ) {
        throw new Error('هیچ داده مالی معتبری در این فایل پشتیبان یافت نشد.')
      }

      setPendingRestore({
        data: rawData,
        stats: {
          accountsCount: accountsList.length,
          transactionsCount: txsList.length,
          plansCount: plansList.length,
          itemsCount: itemsList.length,
          chequesCount: chequesList.length,
          debtsCount: debtsList.length,
          dongEventsCount: dongList.length,
          investmentsCount: invList.length,
          backupDate: json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('fa-IR') : 'نامشخص',
        },
        fileName: file.name,
      })
      setRestoreTarget('local')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'خطا در بارگذاری فایل پشتیبان')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return
    const data = pendingRestore.data
    const target = restoreTarget
    setRestoring(true)
    try {
      // 1. ALWAYS perform complete local restoration in IndexedDB and in-memory state
      await importCloud({
        accounts: Array.isArray(data.accounts) ? (data.accounts as Account[]) : [],
        transactions: Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : [],
        plans: Array.isArray(data.plans) ? (data.plans as InstallmentPlan[]) : [],
        items: Array.isArray(data.items) ? (data.items as InstallmentItem[]) : [],
        pockets: Array.isArray(data.pockets) ? (data.pockets as Pocket[]) : [],
        pocketTransfers: Array.isArray(data.pocketTransfers) ? (data.pocketTransfers as PocketTransfer[]) : [],
        customCategories: Array.isArray(data.customCategories) ? (data.customCategories as Category[]) : [],
      })
      await importLocal(data)

      if (data.theme && typeof data.theme === 'string' && THEMES.some((t) => t.id === data.theme)) {
        applyTheme(data.theme as import('../lib/theme').ThemeId)
        localStorage.setItem('hy-theme', data.theme)
      }

      if (data.appLock && typeof data.appLock === 'string') {
        localStorage.setItem('hy_app_lock', data.appLock)
      }

      if (data.smsDrafts) {
        await db.setKv('smsDraftState', data.smsDrafts)
      }

      // 2. Branch according to user choice:
      if (target === 'cloud') {
        if (syncReady()) {
          await restorePayload(data)
          notifyUser('اطلاعات با موفقیت در حافظه محلی ذخیره شد و نسخه آنلاین (Mirror) روی سرور قرار گرفت ✨')
        } else {
          localStorage.setItem('hy-cloud-dirty', '1')
          notifyUser('اطلاعات روی حافظه محلی ذخیره شد. به محض اتصال، میرور ابری تکمیل می‌شود ✨')
        }
      } else {
        // Local only: clear cloud dirty to guarantee completely isolated offline execution
        localStorage.removeItem('hy-cloud-dirty')
        notifyUser('اطلاعات با موفقیت در حافظه محلی ذخیره شد و بدون نیاز به اینترنت اجرا می‌شود ✨')
      }

      setPendingRestore(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات')
    } finally {
      setRestoring(false)
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
              title="شخصی‌سازی"
              subtitle="انتخاب تم ظاهری و واحد پول پیش‌فرض برنامه"
              onBack={() => setActiveSection(null)}
            />

            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
                onClick={() => setShowThemeGallery((v) => !v)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    {currentTheme?.icon || '🎨'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>تم ظاهری برنامه</h2>
                    <p style={{ fontSize: '11px', color: 'var(--hy-text-secondary)', margin: '2px 0 0' }}>
                      تم فعال فعلی: {currentTheme?.name || 'تاریک مات'} (برای تغییر کلیک کنید)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cat-mini"
                  style={{ fontWeight: 700 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowThemeGallery((v) => !v)
                  }}
                >
                  {showThemeGallery ? 'بستن منوی تم‌ها ▲' : 'انتخاب تم ▼'}
                </button>
              </div>

              {showThemeGallery && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <ThemeGallery />
                </div>
              )}
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
              title="امنیت"
              subtitle="الگوی ورود و بیومتریک، گاوصندوق کارت‌ها، کارت مشترک و دسترسی‌ها"
              onBack={() => setActiveSection(null)}
            />

            {/* Segmented security tabs */}
            <div className="seg" role="tablist" style={{ marginTop: 12 }}>
              <button
                className={`seg-btn${securityTab === 'lock' ? ' active' : ''}`}
                type="button"
                onClick={() => setSecurityTab('lock')}
              >
                🛡️ الگو و بیومتریک
              </button>
              <button
                className={`seg-btn${securityTab === 'vault' ? ' active' : ''}`}
                type="button"
                onClick={() => setSecurityTab('vault')}
              >
                🔐 گاوصندوق کارت‌ها
              </button>
              <button
                className={`seg-btn${securityTab === 'share' ? ' active' : ''}`}
                type="button"
                onClick={() => setSecurityTab('share')}
              >
                🤝 کارت مشترک
              </button>
            </div>

            {securityTab === 'lock' && (
              <>
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
              </>
            )}

            {securityTab === 'vault' && (
              <section className="lg settings-block" style={{ marginTop: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800 }}>
                  {vaultConfigured ? 'تغییر رمز گاوصندوق کارت‌ها' : 'تعیین رمز برای گاوصندوق کارت‌ها'}
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
            )}

            {securityTab === 'share' && (
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
            )}
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

      case 'backup':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="💾"
              title="پشتیبان‌گیری و خروجی داده‌ها"
              subtitle="دانلود فایل پشتیبان آفلاین JSON و خروجی اکسل CSV"
              onBack={() => setActiveSection(null)}
            />

            {/* Offline PWA Status Card */}
            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <span>⚡</span>
                  <span>وضعیت اجرای آفلاین و وابستگی‌های وب‌اپ (PWA)</span>
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 99,
                    background: offlineReady ? 'rgba(16, 185, 129, 0.16)' : 'rgba(234, 179, 8, 0.16)',
                    color: offlineReady ? 'var(--hy-income, #10b981)' : '#eab308',
                    border: `1px solid ${offlineReady ? 'rgba(16, 185, 129, 0.35)' : 'rgba(234, 179, 8, 0.35)'}`,
                  }}
                >
                  {offlineReady ? '۱۰۰٪ آماده استفاده آفلاین' : 'آماده‌سازی کش'}
                </span>
              </div>
              <p className="sheet-sub" style={{ marginTop: 6, lineHeight: 1.8 }}>
                کلیه فایل‌های اسکریپت، استایل‌ها، فونت وزیرمتن و آیکون‌ها در حافظه کش دستگاه ذخیره می‌شوند تا در صورت قطعی اینترنت، اپلیکیشن به صورت لوکال و بدون نیاز به گیت‌هاب مشابه یک نرم‌افزار نیتیو اجرا شود.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                <span>تعداد فایل‌های ذخیره‌شده در حافظه:</span>
                <strong>{toFaDigits(cachedAssetsCount || 6)} فایل و کتابخانه</strong>
              </div>
              <button
                type="button"
                className="home-pill ghost"
                disabled={warmingCache}
                onClick={() => void handleWarmCache()}
                style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 10, fontWeight: 700 }}
              >
                {warmingCache ? 'در حال بررسی و ذخیره‌سازی فایل‌ها…' : '🔄 بررسی و اطمینان از دانلود کلیه وابستگی‌های آفلاین'}
              </button>
            </section>

            {/* Export Section */}
            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>دریافت نسخه پشتیبان (خروجی)</h2>
              <p className="sheet-sub" style={{ marginTop: 4 }}>
                داده‌های مالی شما کاملاً متعلق به خودتان است و همیشه می‌توانید یک فایل پشتیبان جامع از کل سیستم دانلود کنید.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <button
                  className="home-pill ghost"
                  type="button"
                  onClick={() => void handleExportBackup()}
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontWeight: 700 }}
                >
                  📥 دانلود فایل پشتیبان کامل و جامع (JSON)
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

            {/* Restore Section */}
            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800 }}>بازیابی اطلاعات از فایل پشتیبان</h2>
              <p className="sheet-sub" style={{ marginTop: 4, lineHeight: 1.7 }}>
                انتخاب فایل JSON قبلی با امکان انتخاب هوشمند ذخیره روی حافظه محلی (آفلاین) یا میرور آنلاین
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
                  fontWeight: 800,
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
                    if (file) void handleSelectFile(file)
                  }}
                />
              </label>
            </section>

            {/* Restore Choice Modal */}
            {pendingRestore && (
              <div className="sheet-backdrop" onClick={() => !restoring && setPendingRestore(null)}>
                <div
                  className="sheet"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: 480,
                    width: '94%',
                    borderRadius: 24,
                    padding: '20px 18px',
                    maxHeight: '92vh',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 22 }}>📥</span>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>انتخاب محل بازیابی اطلاعات</h3>
                        <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: '2px 0 0' }}>
                          فایل: {pendingRestore.fileName}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="home-pill ghost"
                      style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
                      disabled={restoring}
                      onClick={() => setPendingRestore(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Summary Chips */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--hy-border-color, rgba(255, 255, 255, 0.1))',
                      borderRadius: 16,
                      padding: '12px 14px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px 12px',
                      fontSize: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div>💳 حساب‌ها: <strong>{toFaDigits(pendingRestore.stats.accountsCount)}</strong></div>
                    <div>🧾 تراکنش‌ها: <strong>{toFaDigits(pendingRestore.stats.transactionsCount)}</strong></div>
                    <div>📅 اقساط: <strong>{toFaDigits(pendingRestore.stats.plansCount)}</strong></div>
                    <div>📑 چک‌ها: <strong>{toFaDigits(pendingRestore.stats.chequesCount)}</strong></div>
                    <div>🤝 طلب/بدهی: <strong>{toFaDigits(pendingRestore.stats.debtsCount)}</strong></div>
                    <div>👥 دونگ سفر: <strong>{toFaDigits(pendingRestore.stats.dongEventsCount)}</strong></div>
                    <div>📈 سرمایه‌ها: <strong>{toFaDigits(pendingRestore.stats.investmentsCount)}</strong></div>
                    <div>🕒 تاریخ ایجاد: <strong>{toFaDigits(pendingRestore.stats.backupDate)}</strong></div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--hy-text-secondary)' }}>
                    محل ذخیره‌سازی داده‌ها را مشخص نمایید:
                  </div>

                  {/* Option 1: Local Offline */}
                  <div
                    onClick={() => setRestoreTarget('local')}
                    style={{
                      padding: '14px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      marginBottom: 10,
                      background: restoreTarget === 'local' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: restoreTarget === 'local' ? '2px solid var(--hy-income, #10b981)' : '1px solid var(--hy-border-color, rgba(255, 255, 255, 0.1))',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13 }}>
                        <span style={{ fontSize: 18 }}>📱</span>
                        <span>بازیابی روی حافظه محلی و آفلاین (Local)</span>
                      </div>
                      <span style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: restoreTarget === 'local' ? '5px solid var(--hy-income, #10b981)' : '2px solid rgba(255, 255, 255, 0.3)',
                        background: 'transparent',
                        display: 'inline-block',
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: 0, lineHeight: 1.7 }}>
                      اطلاعات به طور کامل در حافظه مرورگر و دستگاه ذخیره می‌شود. نرم‌افزار بدون نیاز به اینترنت، به صورت ۱۰۰٪ آفلاین لود شده و اجرا می‌شود.
                    </p>
                  </div>

                  {/* Option 2: Online Cloud Mirror */}
                  <div
                    onClick={() => setRestoreTarget('cloud')}
                    style={{
                      padding: '14px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      marginBottom: 16,
                      background: restoreTarget === 'cloud' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: restoreTarget === 'cloud' ? '2px solid var(--hy-teal, #0ea5e9)' : '1px solid var(--hy-border-color, rgba(255, 255, 255, 0.1))',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13 }}>
                        <span style={{ fontSize: 18 }}>☁️</span>
                        <span>بازیابی آنلاین و ابری (Mirror - همگام با سرور)</span>
                      </div>
                      <span style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: restoreTarget === 'cloud' ? '5px solid var(--hy-teal, #0ea5e9)' : '2px solid rgba(255, 255, 255, 0.3)',
                        background: 'transparent',
                        display: 'inline-block',
                      }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', margin: 0, lineHeight: 1.7 }}>
                      ابتدا کلیه داده‌ها در حافظه محلی ذخیره شده و همزمان کپی برابر اصل (Mirror) آن روی سرور ابری قرار می‌گیرد تا بین تمام دستگاه‌ها همگام شود.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="cta-confirm"
                      disabled={restoring}
                      onClick={() => void confirmRestore()}
                      style={{ flex: 1.4, height: 44, fontWeight: 800 }}
                    >
                      {restoring ? 'در حال بازیابی اطلاعات…' : '✨ تأیید و اجرای بازیابی'}
                    </button>
                    <button
                      type="button"
                      className="home-pill ghost"
                      disabled={restoring}
                      onClick={() => setPendingRestore(null)}
                      style={{ flex: 1, height: 44, justifyContent: 'center' }}
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              </div>
            )}

            <SyncBackupsPanel />
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
              title="درباره حساب‌یار"
              subtitle="مشخصات، امکانات و راهنمای کامل"
              onBack={() => setActiveSection(null)}
            />

            <div style={{ marginTop: 12 }}>
              <AboutContent />
            </div>
          </div>
        )

      case 'update':
        return (
          <div className="settings-sub-screen">
            <SettingsSubHeader
              icon="🔄"
              title="بروزرسانی"
              subtitle="بررسی وضعیت نسخه و اعمال جدیدترین تغییرات"
              onBack={() => setActiveSection(null)}
            />

            {/* Version & Info Card */}
            <section className="lg settings-block" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      background: 'rgba(15, 118, 110, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                    }}
                  >
                    🔄
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>حساب‌یار نگارش ۰.۳.۴</div>
                    <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                      تاریخ آخرین بروزرسانی: ۱۲ آبان ۱۴۰۵ (۲ نوامبر ۲۰۲۶)
                    </div>
                  </div>
                </div>
                <span className="badge ok">جدیدترین</span>
              </div>

              {/* Platform Selector */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>پلتفرم هدف برای بروزرسانی:</div>
                <div className="seg" role="tablist">
                  <button
                    className={`seg-btn${updatePlatform === 'webapp' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setUpdatePlatform('webapp')}
                  >
                    🌐 نسخه وب (Web App)
                  </button>
                  <button
                    className={`seg-btn${updatePlatform === 'apk' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setUpdatePlatform('apk')}
                  >
                    🤖 نسخه اندروید (APK)
                  </button>
                </div>
              </div>

              {/* Progress bar when downloading APK */}
              {isDownloadingApk && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    <span>در حال دریافت فایل نصبی Hesabyar-Release.apk...</span>
                    <span>{apkProgress}٪</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${apkProgress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {updatePlatform === 'apk' ? (
                  <>
                    <button
                      type="button"
                      className="cta-confirm"
                      style={{
                        width: '100%',
                        height: 48,
                        fontSize: 13,
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                      onClick={async () => {
                        const result = await promptPwaInstall()
                        if (result === 'accepted') {
                          notifyUser('حساب‌یار با موفقیت روی گوشی شما نصب شد!')
                        } else if (result === 'dismissed') {
                          notifyUser('نصب برنامه لغو شد.')
                        } else {
                          notifyUser('برای نصب مستقیم، از منوی سه نقطه مرورگر گزینه «نصب برنامه» یا Add to Home screen را بزنید.')
                        }
                      }}
                    >
                      <span>📲</span>
                      <span>نصب مستقیم و فوری روی گوشی (بدون خطای پکیج)</span>
                    </button>

                    <button
                      type="button"
                      className="home-pill ghost"
                      disabled={isDownloadingApk}
                      style={{ width: '100%', height: 44, fontSize: 12, fontWeight: 700, justifyContent: 'center' }}
                      onClick={() => {
                        setIsDownloadingApk(true)
                        setApkProgress(0)
                        let p = 0
                        const interval = setInterval(() => {
                          p += 25
                          if (p >= 100) {
                            p = 100
                            setApkProgress(100)
                            clearInterval(interval)
                            setIsDownloadingApk(false)

                            // Trigger download of release APK
                            const link = document.createElement('a')
                            link.href = './Hesabyar-Release.apk'
                            link.download = 'Hesabyar-Release.apk'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)

                            setShowRestartConfirm(true)
                          } else {
                            setApkProgress(p)
                          }
                        }, 200)
                      }}
                    >
                      {isDownloadingApk
                        ? 'در حال آماده‌سازی و دانلود فایل APK...'
                        : '⬇️ دانلود فایل بسته خام APK (Hesabyar-Release.apk)'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cta-confirm"
                    style={{ width: '100%', height: 46, fontSize: 13, fontWeight: 800 }}
                    onClick={async () => {
                      notifyUser('در حال نوسازی کش و دریافت آخرین تغییرات وب‌اپ...')
                      try {
                        if ('serviceWorker' in navigator) {
                          const registrations = await navigator.serviceWorker.getRegistrations()
                          for (const reg of registrations) {
                            await reg.update()
                            await reg.unregister()
                          }
                        }
                        if ('caches' in window) {
                          const keys = await caches.keys()
                          for (const key of keys) {
                            await caches.delete(key)
                          }
                        }
                      } catch (e) {
                        console.warn(e)
                      }
                      setTimeout(() => {
                        notifyUser('بروزرسانی وب‌اپ کامل شد. در حال بازنشانی صفحه...')
                        window.location.reload()
                      }, 800)
                    }}
                  >
                    🔄 بروزرسانی و اعمال آخرین نسخه وب‌اپ
                  </button>
                )}
              </div>
            </section>

            {/* Guide Section */}
            <section className="lg settings-block" style={{ marginTop: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📖</span>
                <span>راهنمای بروزرسانی و نصب</span>
              </h2>

              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-accent)' }}>راهنمای وب‌اپلیکیشن (PWA)</div>
                  <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.8 }}>
                    در نسخه وب با کلیک بر روی دکمه بروزرسانی، حافظه پنهان مرورگر و سرویس‌ورکر پاکسازی شده و جدیدترین نگارش سرور بارگذاری می‌شود.
                  </p>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-income)' }}>راهنمای نسخه اندروید (APK) و رفع خطای بسته (Parse Error)</div>
                  <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.8 }}>
                    خطای «There was a problem while parsing the package» معمولاً به علت ناسازگاری نسخه اندروید با پکیج نصبی، محدودیت‌های امنیتی نصب برنامه‌های ناشناس (Install Unknown Apps)، یا تفاوت معماری پردازنده گوشی رخ می‌دهد.
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4, lineHeight: 1.8 }}>
                    💡 <strong>روش برتر و بدون خطا (نصب فوری PWA):</strong> حساب‌یار یک وب‌اپلیکیشن پیش‌رونده (PWA) است. در مرورگر گوشی (کروم یا سامسونگ اینترنت) منوی ۳ نقطه را لمس کرده و گزینه <strong>«افزودن به صفحه اصلی» (Add to Home screen)</strong> یا <strong>«نصب برنامه» (Install app)</strong> را بزنید. اپلیکیشن با همان آیکون، بدون نیاز به مجوز فایل و با سرعت بالاتر و به صورت کاملاً آفلاین روی گوشی شما نصب خواهد شد.
                  </p>
                </div>
              </div>
            </section>

            {/* Restart Confirmation Modal for APK */}
            {showRestartConfirm && (
              <div className="sheet-backdrop" onClick={() => setShowRestartConfirm(false)}>
                <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                  <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>دانلود نسخه جدید به پایان رسید!</h3>
                    <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', marginTop: 8, lineHeight: 1.8 }}>
                      فایل نصبی Hesabyar-Release.apk با موفقیت دریافت شد. برای تکمیل مراحل و اعمال تغییرات، یکبار نرم‌افزار را راه‌اندازی مجدد کنید.
                    </p>

                    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                      <button
                        type="button"
                        className="cta-confirm"
                        style={{ flex: 1, height: 44, fontWeight: 800 }}
                        onClick={() => {
                          setShowRestartConfirm(false)
                          notifyUser('در حال راه‌اندازی مجدد حساب‌یار...')
                          window.location.reload()
                        }}
                      >
                        تأیید و راه‌اندازی مجدد
                      </button>
                      <button
                        type="button"
                        className="home-pill ghost"
                        style={{ height: 44, padding: '0 16px' }}
                        onClick={() => setShowRestartConfirm(false)}
                      >
                        بستن
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          title: 'شخصی‌سازی',
          subtitle: `انتخاب تم ظاهری و واحد پول پیش‌فرض برنامه · واحد فعلی: ${currencyUnit === 'IRT' ? 'تومان' : 'ریال'}`,
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
          title: 'امنیت',
          subtitle: 'الگو و بیومتریک، گاوصندوق کارت‌ها، کارت مشترک و دسترسی‌ها',
          badge: lock.patternHash || lock.credentialId || vaultConfigured ? 'فعال' : 'خاموش',
          badgeClass: lock.patternHash || lock.credentialId || vaultConfigured ? 'ok' : 'pending',
        },
      ],
    },
    {
      groupTitle: 'اتصال، پیامک و هوش مصنوعی',
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
          id: 'update' as const,
          icon: '🔄',
          title: 'بروزرسانی',
          subtitle: 'بررسی و اعمال آخرین نسخه وب‌اپ و دریافت نسخه جدید نصبی اندروید (APK)',
          badge: 'نسخه ۰.۳.۳',
          badgeClass: 'ok',
        },
        {
          id: 'about' as const,
          icon: 'ℹ️',
          title: 'درباره حساب‌یار',
          subtitle: 'مشاهده مشخصات کامل برنامه، امکانات و راهنما',
          badge: 'مشاهده',
          badgeClass: 'info',
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
                شخصی‌سازی تم، امنیت، پشتیبان‌گیری و بروزرسانی نرم‌افزار
              </p>
            </div>
          </div>

          <Link to="/profile" className="settings-hero-card lg" style={{ textDecoration: 'none', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="hero-theme-icon">👤</span>
              <div>
                <div className="hero-theme-title">پروفایل و اشتراک نرم‌افزار</div>
                <div className="hero-theme-sub">مشاهده مشخصات، مدیریت اشتراک و شناسه کاربری</div>
              </div>
            </div>
            <span className="hero-chevron" aria-hidden="true">‹</span>
          </Link>

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
            حساب‌یار · توسعه و نگهداری توسط محمد احمدی
          </p>
        </div>
      )}

      {/* Popups (when triggered by internal buttons) */}
      {cloudPopup === 'cloud' ? <SyncSheet onClose={() => setCloudPopup(null)} /> : null}
      {cloudPopup === 'supabase' ? <SupabaseConfigSheet onClose={() => setCloudPopup(null)} /> : null}
    </div>
  )
}
